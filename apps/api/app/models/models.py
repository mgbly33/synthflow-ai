from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_en: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_en: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    is_template: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    graph_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    runs: Mapped[list["WorkflowRun"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    versions: Mapped[list["WorkflowVersion"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowVersion.version_number.desc()",
    )


class WorkflowVersion(Base):
    __tablename__ = "workflow_versions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    workflow_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    tag: Mapped[str] = mapped_column(String(64), nullable=False, default="v1.0")
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    graph_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    node_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    edge_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    workflow: Mapped["Workflow"] = relationship(back_populates="versions")


class KnowledgeDoc(Base):
    __tablename__ = "knowledge_docs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunks_json: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    workflow_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("workflows.id", ondelete="SET NULL"), nullable=True
    )
    workflow_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="RUNNING")
    provider_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="DEMO")
    inputs_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    final_output: Mapped[str] = mapped_column(Text, nullable=False, default="")
    total_duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    workflow: Mapped["Workflow | None"] = relationship(back_populates="runs")
    node_logs: Mapped[list["NodeRunLog"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="NodeRunLog.created_at",
    )


class NodeRunLog(Base):
    __tablename__ = "node_run_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False
    )
    node_id: Mapped[str] = mapped_column(String(128), nullable=False)
    node_type: Mapped[str] = mapped_column(String(64), nullable=False)
    node_label: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="COMPLETED")
    input_snapshot: Mapped[str] = mapped_column(Text, nullable=False, default="")
    output_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    offset_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    run: Mapped["WorkflowRun"] = relationship(back_populates="node_logs")


class ProviderConfig(Base):
    __tablename__ = "provider_configs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default="default")
    name: Mapped[str] = mapped_column(String(128), nullable=False, default="Default Provider")
    provider_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="DEMO")
    base_url: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    encrypted_api_key: Mapped[str] = mapped_column(Text, nullable=False, default="")
    default_model: Mapped[str] = mapped_column(
        String(128), nullable=False, default="synthflow-demo-v1"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class WorkflowSchedule(Base):
    __tablename__ = "workflow_schedules"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    workflow_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    cron_expression: Mapped[str] = mapped_column(String(64), nullable=False, default="0 9 * * *")
    inputs_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    webhook_token: Mapped[str] = mapped_column(String(96), nullable=False, default=_uuid)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    trigger_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class EvalCase(Base):
    __tablename__ = "eval_cases"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    workflow_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    inputs_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    assertions_json: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
