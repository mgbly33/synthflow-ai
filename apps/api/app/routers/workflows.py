from __future__ import annotations

import asyncio
import copy
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.core.config import get_settings
from app.core.security import decrypt_secret
from app.db.session import get_db
from app.engine.approval_gate import approval_registry
from app.engine.dag_executor import DAGValidationError, ExecutionResult, WorkflowExecutor, validate_dag
from app.models.models import (
    KnowledgeDoc,
    NodeRunLog,
    ProviderConfig,
    Workflow,
    WorkflowRun,
    WorkflowVersion,
)
from app.schemas.schemas import (
    SingleNodeTestRequest,
    SingleNodeTestResponse,
    WorkflowCreate,
    WorkflowResponse,
    WorkflowRunRequest,
    WorkflowUpdate,
    WorkflowValidateResponse,
    WorkflowVersionCreate,
    WorkflowVersionResponse,
)

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.get("", response_model=list[WorkflowResponse])
async def list_workflows(
    is_template: bool | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Workflow]:
    stmt = select(Workflow).order_by(Workflow.is_template.desc(), Workflow.updated_at.desc())
    if is_template is not None:
        stmt = stmt.where(Workflow.is_template == is_template)
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)) -> Workflow:
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(payload: WorkflowCreate, db: AsyncSession = Depends(get_db)) -> Workflow:
    wf = Workflow(
        id=str(uuid.uuid4()),
        name=payload.name,
        name_en=payload.name_en or payload.name,
        description=payload.description,
        description_en=payload.description_en or payload.description,
        category=payload.category,
        is_template=payload.is_template,
        graph_json=payload.graph_json,
    )
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return wf


@router.post("/{workflow_id}/clone", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def clone_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)) -> Workflow:
    src = await db.get(Workflow, workflow_id)
    if src is None:
        raise HTTPException(status_code=404, detail="Template or workflow not found")
    clone = Workflow(
        id=str(uuid.uuid4()),
        name=f"{src.name}（副本）",
        name_en=f"{src.name_en or src.name} (Copy)",
        description=src.description,
        description_en=src.description_en,
        category=src.category,
        is_template=False,
        graph_json=copy.deepcopy(src.graph_json),
    )
    db.add(clone)
    await db.commit()
    await db.refresh(clone)
    return clone


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str, payload: WorkflowUpdate, db: AsyncSession = Depends(get_db)
) -> Workflow:
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if payload.name is not None:
        wf.name = payload.name
    if payload.name_en is not None:
        wf.name_en = payload.name_en
    if payload.description is not None:
        wf.description = payload.description
    if payload.description_en is not None:
        wf.description_en = payload.description_en
    if payload.category is not None:
        wf.category = payload.category
    if payload.graph_json is not None:
        wf.graph_json = payload.graph_json
    wf.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(wf)
    return wf


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)) -> None:
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete(wf)
    await db.commit()


@router.post("/{workflow_id}/validate", response_model=WorkflowValidateResponse)
async def validate_workflow_endpoint(
    workflow_id: str,
    graph_override: dict[str, Any] | None = None,
    db: AsyncSession = Depends(get_db),
) -> WorkflowValidateResponse:
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    graph = graph_override if graph_override is not None else wf.graph_json
    try:
        layers = validate_dag(graph)
        return WorkflowValidateResponse(valid=True, errors=[], execution_layers=layers)
    except DAGValidationError as exc:
        return WorkflowValidateResponse(valid=False, errors=exc.errors, execution_layers=[])


@router.get("/{workflow_id}/versions", response_model=list[WorkflowVersionResponse])
async def list_workflow_versions(
    workflow_id: str, db: AsyncSession = Depends(get_db)
) -> list[WorkflowVersion]:
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    stmt = (
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
        .order_by(WorkflowVersion.version_number.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


@router.post(
    "/{workflow_id}/versions",
    response_model=WorkflowVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_workflow_version(
    workflow_id: str,
    payload: WorkflowVersionCreate,
    db: AsyncSession = Depends(get_db),
) -> WorkflowVersion:
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    existing = list(
        (
            await db.execute(
                select(WorkflowVersion.version_number).where(
                    WorkflowVersion.workflow_id == workflow_id
                )
            )
        )
        .scalars()
        .all()
    )
    next_num = (max(existing) + 1) if existing else 1
    snapshot = copy.deepcopy(payload.graph_override if payload.graph_override is not None else wf.graph_json)
    ver = WorkflowVersion(
        id=str(uuid.uuid4()),
        workflow_id=workflow_id,
        version_number=next_num,
        tag=payload.tag.strip() or f"v{next_num}.0",
        note=payload.note.strip() or "Snapshot checkpoint",
        graph_json=snapshot,
        node_count=len(snapshot.get("nodes") or []),
        edge_count=len(snapshot.get("edges") or []),
    )
    db.add(ver)
    await db.commit()
    await db.refresh(ver)
    return ver


@router.post("/{workflow_id}/versions/{version_id}/restore", response_model=WorkflowResponse)
async def restore_workflow_version(
    workflow_id: str, version_id: str, db: AsyncSession = Depends(get_db)
) -> Workflow:
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    ver = await db.get(WorkflowVersion, version_id)
    if ver is None or ver.workflow_id != workflow_id:
        raise HTTPException(status_code=404, detail="Version snapshot not found")

    wf.graph_json = copy.deepcopy(ver.graph_json)
    wf.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wf)
    return wf


@router.post("/{workflow_id}/nodes/test", response_model=SingleNodeTestResponse)
async def test_single_node(
    workflow_id: str,
    payload: SingleNodeTestRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SingleNodeTestResponse:
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    cfg = await db.get(ProviderConfig, "default")
    provider_mode = cfg.provider_mode if cfg else "DEMO"
    base_url = cfg.base_url if cfg else ""
    api_key = decrypt_secret(cfg.encrypted_api_key) if cfg and cfg.encrypted_api_key else ""
    default_model = cfg.default_model if cfg and cfg.default_model else "synthflow-demo-v1"
    if provider_mode == "OPENAI_COMPAT" and not base_url.strip():
        provider_mode = "DEMO"

    kb_rows = (await db.execute(select(KnowledgeDoc))).scalars().all()
    kb_docs = [
        {"id": d.id, "title": d.title, "content": d.content, "chunks_json": d.chunks_json}
        for d in kb_rows
    ]

    executor = WorkflowExecutor(
        graph_json={"nodes": [payload.node], "edges": []},
        inputs=dict(payload.inputs),
        knowledge_docs=kb_docs,
        provider_mode=provider_mode,
        base_url=base_url,
        api_key=api_key,
        default_model=default_model,
        language=payload.language,
        demo_delay_ms=0,
        http_client=getattr(request.app.state, "llm_http_client", None),
    )
    rec = await executor.execute_isolated_node(payload.node, payload.upstream_outputs)
    return SingleNodeTestResponse(
        node_id=rec.node_id,
        node_type=rec.node_type,
        status=rec.status,
        input_snapshot=rec.input_snapshot,
        output_text=rec.output_text,
        duration_ms=rec.duration_ms,
        tokens_used=rec.tokens_used,
        error_message=rec.error_message,
    )


@router.post("/{workflow_id}/run")
async def run_workflow_sse(
    workflow_id: str,
    payload: WorkflowRunRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> EventSourceResponse:
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    graph = payload.graph_override if payload.graph_override is not None else wf.graph_json
    try:
        validate_dag(graph)
    except DAGValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": exc.errors[0], "errors": exc.errors},
        ) from exc

    # Load active provider config
    cfg = await db.get(ProviderConfig, "default")
    provider_mode = payload.provider_mode_override or (cfg.provider_mode if cfg else "DEMO")
    base_url = cfg.base_url if cfg else ""
    api_key = decrypt_secret(cfg.encrypted_api_key) if cfg and cfg.encrypted_api_key else ""
    default_model = (cfg.default_model if cfg and cfg.default_model else "synthflow-demo-v1")

    if provider_mode == "OPENAI_COMPAT" and not base_url.strip():
        provider_mode = "DEMO"

    # Load knowledge docs snapshot
    kb_rows = (await db.execute(select(KnowledgeDoc))).scalars().all()
    kb_docs = [
        {
            "id": d.id,
            "title": d.title,
            "content": d.content,
            "chunks_json": d.chunks_json,
        }
        for d in kb_rows
    ]

    run_id = str(uuid.uuid4())
    run_row = WorkflowRun(
        id=run_id,
        workflow_id=wf.id,
        workflow_name=wf.name,
        status="RUNNING",
        provider_mode=provider_mode,
        inputs_json=payload.inputs,
        final_output="",
        total_duration_ms=0,
        total_tokens=0,
        started_at=datetime.now(timezone.utc),
    )
    db.add(run_row)
    await db.commit()

    settings = get_settings()
    demo_delay_ms = getattr(request.app.state, "demo_delay_ms", settings.demo_stream_delay_ms)
    session_factory = request.app.state.session_factory
    http_client = getattr(request.app.state, "llm_http_client", None)

    executor = WorkflowExecutor(
        graph_json=graph,
        inputs=dict(payload.inputs),
        knowledge_docs=kb_docs,
        provider_mode=provider_mode,
        base_url=base_url,
        api_key=api_key,
        default_model=default_model,
        language=payload.language,
        demo_delay_ms=demo_delay_ms,
        http_client=http_client,
    )

    async def event_generator():
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        exec_result: ExecutionResult | None = None
        exec_error: str | None = None

        async def _worker():
            nonlocal exec_result, exec_error
            try:
                exec_result = await executor.run(run_id, queue)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                exec_error = str(exc)
                await queue.put(
                    {
                        "event": "run_error",
                        "data": {"run_id": run_id, "error": exec_error},
                    }
                )
            finally:
                await queue.put(None)

        worker_task = asyncio.create_task(_worker())
        cancelled = False
        try:
            while True:
                if await request.is_disconnected():
                    cancelled = True
                    worker_task.cancel()
                    break
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=0.5)
                except asyncio.TimeoutError:
                    continue
                if item is None:
                    break
                yield {
                    "event": item["event"],
                    "data": json.dumps(item["data"], ensure_ascii=False),
                }
        except asyncio.CancelledError:
            cancelled = True
            worker_task.cancel()
            raise
        finally:
            if cancelled:
                approval_registry.cancel_run(run_id)
            if not worker_task.done():
                worker_task.cancel()
                try:
                    await worker_task
                except BaseException:
                    pass

            # Persist run completion & node logs in a dedicated async session
            async with session_factory() as persist_db:
                persisted_run = await persist_db.get(WorkflowRun, run_id)
                if persisted_run is not None:
                    persisted_run.finished_at = datetime.now(timezone.utc)
                    if exec_result is not None:
                        persisted_run.status = "CANCELLED" if cancelled else exec_result.status
                        persisted_run.final_output = exec_result.final_output
                        persisted_run.total_duration_ms = exec_result.total_duration_ms
                        persisted_run.total_tokens = exec_result.total_tokens
                        for rec in exec_result.node_records:
                            persist_db.add(
                                NodeRunLog(
                                    id=str(uuid.uuid4()),
                                    run_id=run_id,
                                    node_id=rec.node_id,
                                    node_type=rec.node_type,
                                    node_label=rec.node_label,
                                    status=rec.status,
                                    input_snapshot=rec.input_snapshot,
                                    output_text=rec.output_text,
                                    duration_ms=rec.duration_ms,
                                    offset_ms=rec.offset_ms,
                                    tokens_used=rec.tokens_used,
                                    error_message=rec.error_message,
                                )
                            )
                    else:
                        persisted_run.status = "CANCELLED" if cancelled else "FAILED"
                        if exec_error:
                            persisted_run.final_output = f"Execution error: {exec_error}"
                    await persist_db.commit()

    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
