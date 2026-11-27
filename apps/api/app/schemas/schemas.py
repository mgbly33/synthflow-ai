from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class GraphNode(BaseModel):
    id: str
    type: str
    position: dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})
    data: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: str | None = None
    targetHandle: str | None = None
    type: str | None = None
    label: str | None = None
    data: dict[str, Any] | None = None


class GraphPayload(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    name_en: str = Field(default="", max_length=200)
    description: str = Field(default="")
    description_en: str = Field(default="")
    category: str = Field(default="custom", max_length=64)
    is_template: bool = False
    graph_json: dict[str, Any] = Field(default_factory=lambda: {"nodes": [], "edges": []})


class WorkflowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    name_en: str | None = Field(default=None, max_length=200)
    description: str | None = None
    description_en: str | None = None
    category: str | None = Field(default=None, max_length=64)
    graph_json: dict[str, Any] | None = None


class WorkflowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    name_en: str
    description: str
    description_en: str
    category: str
    is_template: bool
    graph_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class WorkflowVersionCreate(BaseModel):
    tag: str = Field(default="", max_length=64)
    note: str = Field(default="", max_length=500)
    graph_override: dict[str, Any] | None = None


class WorkflowVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workflow_id: str
    version_number: int
    tag: str
    note: str
    graph_json: dict[str, Any]
    node_count: int
    edge_count: int
    created_at: datetime


class WorkflowValidateResponse(BaseModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)
    execution_layers: list[list[str]] = Field(default_factory=list)


class WorkflowRunRequest(BaseModel):
    inputs: dict[str, Any] = Field(default_factory=dict)
    graph_override: dict[str, Any] | None = None
    language: Literal["zh", "en"] = "zh"
    provider_mode_override: Literal["DEMO", "OPENAI_COMPAT"] | None = None


class SingleNodeTestRequest(BaseModel):
    node: dict[str, Any]
    inputs: dict[str, Any] = Field(default_factory=dict)
    upstream_outputs: dict[str, str] = Field(default_factory=dict)
    language: Literal["zh", "en"] = "zh"


class SingleNodeTestResponse(BaseModel):
    node_id: str
    node_type: str
    status: str
    input_snapshot: str
    output_text: str
    duration_ms: int
    tokens_used: int
    error_message: str | None = None


class KnowledgeDocCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)


class KnowledgeDocUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, min_length=1)


class KnowledgeDocResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    content: str
    chunks_json: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)
    doc_ids: list[str] = Field(default_factory=list)


class KnowledgeSearchMatch(BaseModel):
    doc_id: str
    doc_title: str
    chunk_index: int
    score: float
    text: str


class KnowledgeSearchResponse(BaseModel):
    query: str
    total_matches: int
    matches: list[KnowledgeSearchMatch]


class NodeRunLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    node_id: str
    node_type: str
    node_label: str
    status: str
    input_snapshot: str
    output_text: str
    duration_ms: int
    offset_ms: int
    tokens_used: int
    error_message: str | None
    created_at: datetime


class WorkflowRunSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workflow_id: str | None
    workflow_name: str
    status: str
    provider_mode: str
    inputs_json: dict[str, Any]
    final_output: str
    total_duration_ms: int
    total_tokens: int
    started_at: datetime
    finished_at: datetime | None


class WorkflowRunDetailResponse(WorkflowRunSummaryResponse):
    node_logs: list[NodeRunLogResponse] = Field(default_factory=list)


class NodeTypeStat(BaseModel):
    node_type: str
    executions: int
    avg_duration_ms: int
    total_tokens: int


class RunTrendPoint(BaseModel):
    run_id: str
    workflow_name: str
    duration_ms: int
    tokens: int
    status: str
    started_at: datetime


class AnalyticsSummaryResponse(BaseModel):
    total_workflows: int
    total_templates: int
    total_knowledge_docs: int
    total_runs: int
    completed_runs: int
    failed_runs: int
    success_rate: float
    avg_duration_ms: int
    total_tokens: int
    estimated_saved_usd: float
    node_type_stats: list[NodeTypeStat]
    recent_trend: list[RunTrendPoint]


class ProviderConfigUpdate(BaseModel):
    name: str = Field(default="Custom Provider", max_length=128)
    provider_mode: Literal["DEMO", "OPENAI_COMPAT"] = "DEMO"
    base_url: str = Field(default="", max_length=512)
    api_key: str | None = Field(
        default=None,
        description="Plaintext API key to encrypt and store. Omit or pass None to keep existing key.",
    )
    clear_api_key: bool = False
    default_model: str = Field(default="gpt-4o-mini", max_length=128)


class ProviderConfigResponse(BaseModel):
    id: str
    name: str
    provider_mode: Literal["DEMO", "OPENAI_COMPAT"]
    base_url: str
    masked_api_key: str
    has_api_key: bool
    default_model: str
    is_active: bool
    updated_at: datetime


class ProviderTestRequest(BaseModel):
    base_url: str = Field(..., min_length=1)
    api_key: str | None = None
    model: str = Field(default="gpt-4o-mini")


class ProviderTestResponse(BaseModel):
    ok: bool
    latency_ms: int
    message: str
    model_reply: str | None = None
