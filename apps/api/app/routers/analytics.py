from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import KnowledgeDoc, NodeRunLog, Workflow, WorkflowRun
from app.schemas.schemas import AnalyticsSummaryResponse, NodeTypeStat, RunTrendPoint

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(db: AsyncSession = Depends(get_db)) -> AnalyticsSummaryResponse:
    total_workflows = (await db.execute(select(func.count()).select_from(Workflow))).scalar_one()
    total_templates = (
        await db.execute(select(func.count()).select_from(Workflow).where(Workflow.is_template == True))  # noqa: E712
    ).scalar_one()
    total_kb = (await db.execute(select(func.count()).select_from(KnowledgeDoc))).scalar_one()

    runs = list(
        (await db.execute(select(WorkflowRun).order_by(WorkflowRun.started_at.desc()).limit(100)))
        .scalars()
        .all()
    )
    total_runs = len(runs)
    completed_runs = sum(1 for r in runs if r.status == "COMPLETED")
    failed_runs = sum(1 for r in runs if r.status == "FAILED")
    success_rate = round((completed_runs / total_runs) * 100.0, 1) if total_runs > 0 else 100.0
    avg_duration_ms = (
        int(sum(r.total_duration_ms for r in runs) / total_runs) if total_runs > 0 else 0
    )
    total_tokens = sum(r.total_tokens for r in runs)
    # Rough benchmark savings compared to $0.005 / 1K tokens blended commercial LLM API
    estimated_saved_usd = round((total_tokens / 1000.0) * 0.005, 4)

    # Aggregate node-type execution telemetry
    logs = list((await db.execute(select(NodeRunLog).limit(1000))).scalars().all())
    by_type: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0, "dur": 0, "tok": 0})
    for lg in logs:
        if lg.status == "SKIPPED":
            continue
        bucket = by_type[lg.node_type]
        bucket["count"] += 1
        bucket["dur"] += lg.duration_ms
        bucket["tok"] += lg.tokens_used

    node_type_stats = [
        NodeTypeStat(
            node_type=ntype,
            executions=vals["count"],
            avg_duration_ms=int(vals["dur"] / max(1, vals["count"])),
            total_tokens=vals["tok"],
        )
        for ntype, vals in sorted(by_type.items(), key=lambda kv: kv[1]["count"], reverse=True)
    ]

    recent_trend = [
        RunTrendPoint(
            run_id=r.id,
            workflow_name=r.workflow_name or "Workflow",
            duration_ms=r.total_duration_ms,
            tokens=r.total_tokens,
            status=r.status,
            started_at=r.started_at,
        )
        for r in reversed(runs[:16])
    ]

    return AnalyticsSummaryResponse(
        total_workflows=total_workflows,
        total_templates=total_templates,
        total_knowledge_docs=total_kb,
        total_runs=total_runs,
        completed_runs=completed_runs,
        failed_runs=failed_runs,
        success_rate=success_rate,
        avg_duration_ms=avg_duration_ms,
        total_tokens=total_tokens,
        estimated_saved_usd=estimated_saved_usd,
        node_type_stats=node_type_stats,
        recent_trend=recent_trend,
    )
