from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_secret
from app.db.session import get_db
from app.engine.approval_gate import approval_registry
from app.engine.arena_eval import evaluate_assertions, run_arena_comparison
from app.engine.copilot import generate_workflow_with_copilot, optimize_workflow_graph
from app.engine.dag_executor import DAGValidationError, WorkflowExecutor, validate_dag
from app.models.models import (
    EvalCase,
    KnowledgeDoc,
    NodeRunLog,
    ProviderConfig,
    Workflow,
    WorkflowRun,
    WorkflowSchedule,
)

router = APIRouter(tags=["studio-pro"])


# ---------- Pydantic Schemas ----------
class CopilotGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=2000)
    language: Literal["zh", "en"] = "zh"
    save_as_workflow: bool = False


class CopilotOptimizeRequest(BaseModel):
    graph_json: dict[str, Any]


class ArenaVariantConfig(BaseModel):
    label: str = "Variant"
    model: str = ""
    temperature: float | None = 0.5
    system_prompt_suffix: str = ""


class ArenaCompareRequest(BaseModel):
    workflow_id: str
    inputs: dict[str, Any] = Field(default_factory=dict)
    graph_override: dict[str, Any] | None = None
    language: Literal["zh", "en"] = "zh"
    variant_a: ArenaVariantConfig
    variant_b: ArenaVariantConfig


class EvalCaseCreate(BaseModel):
    workflow_id: str
    name: str = Field(..., min_length=1, max_length=180)
    inputs_json: dict[str, Any] = Field(default_factory=dict)
    assertions_json: list[dict[str, Any]] = Field(default_factory=list)


class EvalCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workflow_id: str
    name: str
    inputs_json: dict[str, Any]
    assertions_json: list[dict[str, Any]]
    created_at: datetime


class EvalRunRequest(BaseModel):
    workflow_id: str
    case_ids: list[str] = Field(default_factory=list)
    graph_override: dict[str, Any] | None = None
    language: Literal["zh", "en"] = "zh"


class ApprovalActionRequest(BaseModel):
    node_id: str
    approved: bool = True
    edited_output: str | None = None
    comment: str = ""


class ScheduleCreate(BaseModel):
    workflow_id: str
    name: str = Field(..., min_length=1, max_length=180)
    cron_expression: str = Field(default="0 9 * * *", max_length=64)
    inputs_json: dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True


class ScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workflow_id: str
    name: str
    cron_expression: str
    inputs_json: dict[str, Any]
    webhook_token: str
    is_enabled: bool
    last_triggered_at: datetime | None
    trigger_count: int
    created_at: datetime


class WebhookTriggerRequest(BaseModel):
    inputs: dict[str, Any] = Field(default_factory=dict)
    language: Literal["zh", "en"] = "zh"
    schedule_id: str | None = None


async def _load_runtime_context(db: AsyncSession):
    cfg = await db.get(ProviderConfig, "default")
    provider_mode = cfg.provider_mode if cfg else "DEMO"
    base_url = cfg.base_url if cfg else ""
    api_key = decrypt_secret(cfg.encrypted_api_key) if cfg and cfg.encrypted_api_key else ""
    default_model = cfg.default_model if cfg and cfg.default_model else "deepseek-chat"
    if provider_mode == "OPENAI_COMPAT" and not base_url.strip():
        provider_mode = "DEMO"

    kb_rows = (await db.execute(select(KnowledgeDoc))).scalars().all()
    kb_docs = [
        {"id": d.id, "title": d.title, "content": d.content, "chunks_json": d.chunks_json}
        for d in kb_rows
    ]
    return provider_mode, base_url, api_key, default_model, kb_docs


# ---------- 1. AI Copilot Text-to-DAG & Graph Optimizer ----------
@router.post("/api/copilot/generate")
async def copilot_generate_workflow(
    payload: CopilotGenerateRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    provider_mode, base_url, api_key, default_model, _ = await _load_runtime_context(db)
    blueprint = await generate_workflow_with_copilot(
        prompt=payload.prompt,
        language=payload.language,
        provider_mode=provider_mode,
        base_url=base_url,
        api_key=api_key,
        model=default_model,
    )
    # Validate synthesized graph guarantees 100% executable DAG
    validate_dag(blueprint["graph_json"])

    saved_workflow_id = None
    if payload.save_as_workflow:
        wf = Workflow(
            id=str(uuid.uuid4()),
            name=blueprint["name"],
            name_en=blueprint["name"],
            description=blueprint["description"],
            description_en=blueprint["description"],
            category=blueprint["category"],
            is_template=False,
            graph_json=blueprint["graph_json"],
        )
        db.add(wf)
        await db.commit()
        saved_workflow_id = wf.id

    return {**blueprint, "saved_workflow_id": saved_workflow_id}


@router.post("/api/copilot/optimize")
async def copilot_optimize(payload: CopilotOptimizeRequest) -> dict[str, Any]:
    return optimize_workflow_graph(payload.graph_json)


# ---------- 2. Multi-Variant A/B Arena Evaluator ----------
@router.post("/api/arena/compare")
async def arena_compare(
    payload: ArenaCompareRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    wf = await db.get(Workflow, payload.workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    graph = payload.graph_override if payload.graph_override is not None else wf.graph_json
    try:
        validate_dag(graph)
    except DAGValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.errors[0]) from exc

    provider_mode, base_url, api_key, default_model, kb_docs = await _load_runtime_context(db)
    return await run_arena_comparison(
        graph_json=graph,
        inputs=payload.inputs,
        knowledge_docs=kb_docs,
        variant_a=payload.variant_a.model_dump(),
        variant_b=payload.variant_b.model_dump(),
        provider_mode=provider_mode,
        base_url=base_url,
        api_key=api_key,
        default_model=default_model,
        language=payload.language,
        http_client=getattr(request.app.state, "llm_http_client", None),
    )


# ---------- 3. Automated Regression Eval Suite ----------
@router.get("/api/evals", response_model=list[EvalCaseResponse])
async def list_eval_cases(
    workflow_id: str | None = None, db: AsyncSession = Depends(get_db)
) -> list[EvalCase]:
    stmt = select(EvalCase).order_by(EvalCase.created_at.desc())
    if workflow_id:
        stmt = stmt.where(EvalCase.workflow_id == workflow_id)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/api/evals", response_model=EvalCaseResponse, status_code=status.HTTP_201_CREATED)
async def create_eval_case(
    payload: EvalCaseCreate, db: AsyncSession = Depends(get_db)
) -> EvalCase:
    wf = await db.get(Workflow, payload.workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    row = EvalCase(
        id=f"eval-{uuid.uuid4().hex[:8]}",
        workflow_id=payload.workflow_id,
        name=payload.name.strip(),
        inputs_json=payload.inputs_json,
        assertions_json=payload.assertions_json,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/api/evals/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_eval_case(case_id: str, db: AsyncSession = Depends(get_db)) -> None:
    row = await db.get(EvalCase, case_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Eval case not found")
    await db.delete(row)
    await db.commit()


@router.post("/api/evals/run")
async def run_eval_suite(
    payload: EvalRunRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    wf = await db.get(Workflow, payload.workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    stmt = select(EvalCase).where(EvalCase.workflow_id == payload.workflow_id)
    cases = list((await db.execute(stmt)).scalars().all())
    if payload.case_ids:
        id_set = set(payload.case_ids)
        cases = [c for c in cases if c.id in id_set]

    if not cases:
        raise HTTPException(status_code=400, detail="当前工作流暂无评测用例 / No eval cases found")

    graph = payload.graph_override if payload.graph_override is not None else wf.graph_json
    provider_mode, base_url, api_key, default_model, kb_docs = await _load_runtime_context(db)

    async def _run_case(case: EvalCase) -> dict[str, Any]:
        q: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        exe = WorkflowExecutor(
            graph_json=graph,
            inputs=dict(case.inputs_json),
            knowledge_docs=kb_docs,
            provider_mode=provider_mode,
            base_url=base_url,
            api_key=api_key,
            default_model=default_model,
            language=payload.language,
            demo_delay_ms=0,
            http_client=getattr(request.app.state, "llm_http_client", None),
            auto_approve_hitl=True,
        )
        res = await exe.run(f"eval-{case.id}", q)
        checks = evaluate_assertions(res, case.assertions_json)
        all_passed = all(c["passed"] for c in checks) and res.status == "COMPLETED"
        return {
            "case_id": case.id,
            "case_name": case.name,
            "passed": all_passed,
            "status": res.status,
            "duration_ms": res.total_duration_ms,
            "tokens": res.total_tokens,
            "output_preview": (res.final_output or "")[:360],
            "assertions": checks,
        }

    results = await asyncio.gather(*[_run_case(c) for c in cases])
    passed_count = sum(1 for r in results if r["passed"])
    pass_rate = round((passed_count / len(results)) * 100.0, 1)

    return {
        "workflow_id": wf.id,
        "workflow_name": wf.name,
        "total_cases": len(results),
        "passed_cases": passed_count,
        "pass_rate": pass_rate,
        "results": results,
    }


# ---------- 4. Human-in-the-Loop (HITL) Approval Gate Action ----------
@router.post("/api/runs/{run_id}/approve")
async def approve_hitl_gate(run_id: str, payload: ApprovalActionRequest) -> dict[str, Any]:
    resolved = approval_registry.resolve(
        run_id,
        payload.node_id,
        approved=payload.approved,
        edited_output=payload.edited_output,
        comment=payload.comment,
    )
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail="未找到等待中的人工审批节点（可能已超时或已处理） / No pending approval gate found",
        )
    return {
        "ok": True,
        "run_id": run_id,
        "node_id": payload.node_id,
        "approved": payload.approved,
    }


# ---------- 5. Cron Schedules & Webhook Trigger Simulator ----------
@router.get("/api/schedules", response_model=list[ScheduleResponse])
async def list_schedules(
    workflow_id: str | None = None, db: AsyncSession = Depends(get_db)
) -> list[WorkflowSchedule]:
    stmt = select(WorkflowSchedule).order_by(WorkflowSchedule.created_at.desc())
    if workflow_id:
        stmt = stmt.where(WorkflowSchedule.workflow_id == workflow_id)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/api/schedules", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    payload: ScheduleCreate, db: AsyncSession = Depends(get_db)
) -> WorkflowSchedule:
    wf = await db.get(Workflow, payload.workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    row = WorkflowSchedule(
        id=f"sch-{uuid.uuid4().hex[:8]}",
        workflow_id=payload.workflow_id,
        name=payload.name.strip(),
        cron_expression=payload.cron_expression.strip(),
        inputs_json=payload.inputs_json,
        webhook_token=f"whsec_{uuid.uuid4().hex[:20]}",
        is_enabled=payload.is_enabled,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/api/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(schedule_id: str, db: AsyncSession = Depends(get_db)) -> None:
    row = await db.get(WorkflowSchedule, schedule_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await db.delete(row)
    await db.commit()


@router.post("/api/webhooks/{workflow_id}/trigger")
async def trigger_workflow_webhook(
    workflow_id: str,
    payload: WebhookTriggerRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    provider_mode, base_url, api_key, default_model, kb_docs = await _load_runtime_context(db)
    run_id = str(uuid.uuid4())
    q: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    exe = WorkflowExecutor(
        graph_json=wf.graph_json,
        inputs=dict(payload.inputs),
        knowledge_docs=kb_docs,
        provider_mode=provider_mode,
        base_url=base_url,
        api_key=api_key,
        default_model=default_model,
        language=payload.language,
        demo_delay_ms=0,
        http_client=getattr(request.app.state, "llm_http_client", None),
        auto_approve_hitl=True,
    )
    res = await exe.run(run_id, q)

    run_row = WorkflowRun(
        id=run_id,
        workflow_id=wf.id,
        workflow_name=f"[Webhook] {wf.name}",
        status=res.status,
        provider_mode=provider_mode,
        inputs_json=payload.inputs,
        final_output=res.final_output,
        total_duration_ms=res.total_duration_ms,
        total_tokens=res.total_tokens,
        started_at=datetime.now(timezone.utc),
        finished_at=datetime.now(timezone.utc),
    )
    db.add(run_row)
    for rec in res.node_records:
        db.add(
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

    if payload.schedule_id:
        sch = await db.get(WorkflowSchedule, payload.schedule_id)
        if sch is not None:
            sch.trigger_count += 1
            sch.last_triggered_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "ok": res.status == "COMPLETED",
        "run_id": run_id,
        "workflow_id": wf.id,
        "status": res.status,
        "total_duration_ms": res.total_duration_ms,
        "total_tokens": res.total_tokens,
        "final_output": res.final_output,
    }
