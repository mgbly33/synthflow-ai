from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.models import WorkflowRun
from app.schemas.schemas import WorkflowRunDetailResponse, WorkflowRunSummaryResponse

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("", response_model=list[WorkflowRunSummaryResponse])
async def list_runs(
    workflow_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[WorkflowRun]:
    stmt = select(WorkflowRun).order_by(WorkflowRun.started_at.desc()).limit(limit)
    if workflow_id:
        stmt = stmt.where(WorkflowRun.workflow_id == workflow_id)
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.get("/{run_id}", response_model=WorkflowRunDetailResponse)
async def get_run_detail(run_id: str, db: AsyncSession = Depends(get_db)) -> WorkflowRun:
    stmt = (
        select(WorkflowRun)
        .options(selectinload(WorkflowRun.node_logs))
        .where(WorkflowRun.id == run_id)
    )
    res = await db.execute(stmt)
    run = res.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run record not found")
    return run


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_run(run_id: str, db: AsyncSession = Depends(get_db)) -> None:
    run = await db.get(WorkflowRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run record not found")
    await db.delete(run)
    await db.commit()
