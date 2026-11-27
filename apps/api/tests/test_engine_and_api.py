from __future__ import annotations

import json
from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.security import decrypt_secret, encrypt_secret, mask_api_key
from app.db.seed import seed_database
from app.db.session import Base, get_db
from app.engine.code_transform import SafeCodeError, execute_code_transform
from app.engine.dag_executor import DAGValidationError, render_template, validate_dag
from app.engine.http_tool import SSRFBlockedError, execute_http_node, validate_url_ssrf
from app.engine.knowledge_retriever import chunk_document, retrieve_top_k
from app.main import create_app


@pytest_asyncio.fixture()
async def test_app(tmp_path):
    db_file = tmp_path / "test_synthflow.db"
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with session_factory() as session:
        await seed_database(session)

    app = create_app()
    app.state.skip_default_init = True
    app.state.session_factory = session_factory
    app.state.demo_delay_ms = 0

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    yield app
    await engine.dispose()


@pytest_asyncio.fixture()
async def client(test_app):
    transport = httpx.ASGITransport(app=test_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


def _parse_sse(raw_text: str) -> list[dict]:
    events: list[dict] = []
    cur_event = "message"
    cur_data_lines: list[str] = []

    for line in raw_text.splitlines():
        if not line.strip():
            if cur_data_lines:
                raw_data = "\n".join(cur_data_lines)
                try:
                    parsed = json.loads(raw_data)
                except json.JSONDecodeError:
                    parsed = raw_data
                events.append({"event": cur_event, "data": parsed})
                cur_event = "message"
                cur_data_lines = []
            continue
        if line.startswith("event:"):
            cur_event = line[len("event:") :].strip()
        elif line.startswith("data:"):
            cur_data_lines.append(line[len("data:") :].strip())

    if cur_data_lines:
        raw_data = "\n".join(cur_data_lines)
        try:
            parsed = json.loads(raw_data)
        except json.JSONDecodeError:
            parsed = raw_data
        events.append({"event": cur_event, "data": parsed})
    return events


# ---------------------------------------------------------------------------
# 1. DAG Validation & Topological Sorting Tests
# ---------------------------------------------------------------------------
def test_dag_cycle_detection():
    cyclic_graph = {
        "nodes": [
            {"id": "in_1", "type": "input", "data": {}},
            {"id": "a", "type": "llm", "data": {}},
            {"id": "b", "type": "llm", "data": {}},
        ],
        "edges": [
            {"id": "e1", "source": "in_1", "target": "a"},
            {"id": "e2", "source": "a", "target": "b"},
            {"id": "e3", "source": "b", "target": "a"},
        ],
    }
    with pytest.raises(DAGValidationError) as exc_info:
        validate_dag(cyclic_graph)
    assert any("环路" in e or "Cycle" in e for e in exc_info.value.errors)


def test_dag_missing_input_and_dangling_edge():
    bad_graph = {
        "nodes": [{"id": "llm_1", "type": "llm", "data": {}}],
        "edges": [{"id": "e1", "source": "llm_1", "target": "ghost_node"}],
    }
    with pytest.raises(DAGValidationError) as exc_info:
        validate_dag(bad_graph)
    joined = " ".join(exc_info.value.errors)
    assert "Input" in joined
    assert "ghost_node" in joined


def test_template_interpolation():
    rendered = render_template(
        "Product={{input.product}}; Upstream={{llm_1.output}}; Field={{http_1.status}}",
        inputs={"product": "SynthFlow"},
        node_outputs={"llm_1": "Great Moat", "http_1": json.dumps({"status": 200})},
    )
    assert "Product=SynthFlow" in rendered
    assert "Upstream=Great Moat" in rendered
    assert "Field=200" in rendered


# ---------------------------------------------------------------------------
# 2. BM25 Knowledge Retrieval Tests
# ---------------------------------------------------------------------------
def test_bm25_bilingual_retrieval():
    docs = [
        {
            "id": "d1",
            "title": "品牌手册",
            "content": "小红书种草笔记需要强调真实职场痛点和对比反差。\n\n公众号文章讲究逻辑严密。",
            "chunks_json": chunk_document(
                "小红书种草笔记需要强调真实职场痛点和对比反差。\n\n公众号文章讲究逻辑严密。",
                max_chars=30,
            ),
        },
        {
            "id": "d2",
            "title": "SaaS SLA SOP",
            "content": "Production 504 timeout incidents require P1 escalation within 15 minutes and X-Request-Id tracing.",
            "chunks_json": chunk_document(
                "Production 504 timeout incidents require P1 escalation within 15 minutes and X-Request-Id tracing."
            ),
        },
    ]
    res_zh = retrieve_top_k("小红书 痛点 种草", docs, top_k=1)
    assert len(res_zh) == 1
    assert res_zh[0]["doc_id"] == "d1"
    assert res_zh[0]["score"] > 0

    res_en = retrieve_top_k("504 timeout P1 escalation", docs, top_k=1)
    assert len(res_en) == 1
    assert res_en[0]["doc_id"] == "d2"
    assert res_en[0]["score"] > 0


# ---------------------------------------------------------------------------
# 3. SSRF Protection & Encryption Tests
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "blocked_url",
    [
        "http://example.com/api",
        "https://localhost/secret",
        "https://127.0.0.1/admin",
        "https://169.254.169.254/latest/meta-data/",
        "https://10.0.0.5/internal",
        "https://192.168.1.10/db",
        "https://172.16.0.1/metrics",
        "https://[::1]/local",
        "https://service.internal/v1",
    ],
)
def test_ssrf_blocks_internal_and_insecure_urls(blocked_url: str):
    with pytest.raises(SSRFBlockedError):
        validate_url_ssrf(blocked_url, resolve_dns=False)


@pytest.mark.asyncio
async def test_http_node_sandbox_allows_public_https():
    out = await execute_http_node("https://api.example.com/v1/benchmark", method="GET", sandbox_mode=True)
    parsed = json.loads(out)
    assert parsed["status"] == 200
    assert parsed["mode"] == "sandbox_mock"


def test_fernet_encryption_and_masking():
    raw = "sk-proj-1234567890abcdef89ab"
    enc = encrypt_secret(raw)
    assert enc != raw
    assert decrypt_secret(enc) == raw
    masked = mask_api_key(raw)
    assert masked.endswith("89ab")
    assert "1234567890" not in masked
    assert "****" in masked


# ---------------------------------------------------------------------------
# 4. End-to-End API, Demo SSE Streaming, Condition Skipping & Persistence
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_seeded_templates_and_knowledge(client: httpx.AsyncClient):
    wf_resp = await client.get("/api/workflows")
    assert wf_resp.status_code == 200
    workflows = wf_resp.json()
    assert len(workflows) == 9

    kb_resp = await client.get("/api/knowledge")
    assert kb_resp.status_code == 200
    assert len(kb_resp.json()) == 3


@pytest.mark.asyncio
async def test_demo_mode_sse_streaming_and_condition_branch_skipping(client: httpx.AsyncClient):
    # Contract template has Condition node routing True (high risk) vs False (low risk)
    resp = await client.post(
        "/api/workflows/tpl-contract-review/run",
        json={
            "inputs": {
                "contract_title": "AI 定制开发协议",
                "contract_text": "若违约，乙方须承担无限连带赔偿责任并支付 50% 违约金，甲方可单方解除。",
            },
            "language": "zh",
        },
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")

    events = _parse_sse(resp.text)
    event_names = [e["event"] for e in events]
    assert "run_started" in event_names
    assert "node_started" in event_names
    assert "node_token" in event_names
    assert "node_completed" in event_names
    assert "node_skipped" in event_names
    assert "run_completed" in event_names

    skipped_ids = [e["data"]["node_id"] for e in events if e["event"] == "node_skipped"]
    assert "llm_low_risk" in skipped_ids
    assert "llm_high_risk" not in skipped_ids

    completed_evt = [e for e in events if e["event"] == "run_completed"][-1]["data"]
    assert completed_evt["status"] == "COMPLETED"
    assert "高风险" in completed_evt["final_output"] or "红灯" in completed_evt["final_output"]

    # Verify persistence in /api/runs/{run_id}
    run_id = completed_evt["run_id"]
    run_detail = await client.get(f"/api/runs/{run_id}")
    assert run_detail.status_code == 200
    detail_json = run_detail.json()
    assert detail_json["status"] == "COMPLETED"
    assert len(detail_json["node_logs"]) == 6
    status_by_node = {n["node_id"]: n["status"] for n in detail_json["node_logs"]}
    assert status_by_node["llm_high_risk"] == "COMPLETED"
    assert status_by_node["llm_low_risk"] == "SKIPPED"
    assert status_by_node["output_legal"] == "COMPLETED"


@pytest.mark.asyncio
async def test_real_openai_compatible_streaming_and_encrypted_key(test_app, client: httpx.AsyncClient):
    # Save encrypted key via settings API
    put_resp = await client.put(
        "/api/settings/provider",
        json={
            "name": "Mock OpenAI",
            "provider_mode": "OPENAI_COMPAT",
            "base_url": "https://mock.openai.local/v1",
            "api_key": "sk-test-secret-9988",
            "default_model": "gpt-4o-mini",
        },
    )
    assert put_resp.status_code == 200
    cfg = put_resp.json()
    assert cfg["provider_mode"] == "OPENAI_COMPAT"
    assert cfg["has_api_key"] is True
    assert cfg["masked_api_key"] == "sk-****9988"

    # Inject a mocked httpx transport returning OpenAI SSE token chunks
    def mock_handler(request: httpx.Request) -> httpx.Response:
        assert request.headers.get("authorization") == "Bearer sk-test-secret-9988"
        sse_body = (
            'data: {"choices":[{"delta":{"content":"Real "}}]}\n\n'
            'data: {"choices":[{"delta":{"content":"Streamed "}}]}\n\n'
            'data: {"choices":[{"delta":{"content":"Token!"}}]}\n\n'
            "data: [DONE]\n\n"
        )
        return httpx.Response(200, text=sse_body, headers={"content-type": "text/event-stream"})

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(mock_handler))
    test_app.state.llm_http_client = mock_client

    try:
        # Run a compact 3-node workflow override against the mocked OpenAI server
        simple_graph = {
            "nodes": [
                {"id": "in_1", "type": "input", "data": {"label": "Input"}},
                {
                    "id": "llm_1",
                    "type": "llm",
                    "data": {
                        "label": "Agent",
                        "systemPrompt": "Be concise.",
                        "userPrompt": "Say hi to {{input.name}}",
                        "model": "gpt-4o-mini",
                        "temperature": 0.2,
                    },
                },
                {"id": "out_1", "type": "output", "data": {"label": "Output", "template": "{{llm_1.output}}"}},
            ],
            "edges": [
                {"id": "e1", "source": "in_1", "target": "llm_1"},
                {"id": "e2", "source": "llm_1", "target": "out_1"},
            ],
        }
        run_resp = await client.post(
            "/api/workflows/tpl-competitor-report/run",
            json={"inputs": {"name": "SynthFlow"}, "graph_override": simple_graph},
        )
        assert run_resp.status_code == 200
        events = _parse_sse(run_resp.text)
        tokens = "".join(e["data"]["token"] for e in events if e["event"] == "node_token")
        assert tokens == "Real Streamed Token!"
        completed = [e["data"] for e in events if e["event"] == "run_completed"][-1]
        assert completed["final_output"] == "Real Streamed Token!"
    finally:
        await mock_client.aclose()
        test_app.state.llm_http_client = None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "template_id",
    [
        "tpl-competitor-report",
        "tpl-marketing-studio",
        "tpl-contract-review",
        "tpl-ticket-triage",
        "tpl-arch-review",
        "tpl-intent-router",
        "tpl-market-intel",
        "tpl-global-listing",
    ],
)
async def test_all_eight_seeded_templates_stream_successfully(
    client: httpx.AsyncClient, template_id: str
):
    wf_resp = await client.get(f"/api/workflows/{template_id}")
    assert wf_resp.status_code == 200
    wf = wf_resp.json()
    input_node = next(n for n in wf["graph_json"]["nodes"] if n["type"] == "input")
    sample_inputs = input_node["data"].get("sampleInputs", {})

    run_resp = await client.post(
        f"/api/workflows/{template_id}/run",
        json={"inputs": sample_inputs, "language": "zh"},
    )
    assert run_resp.status_code == 200
    events = _parse_sse(run_resp.text)
    completed = [e["data"] for e in events if e["event"] == "run_completed"]
    assert len(completed) == 1
    assert completed[0]["status"] == "COMPLETED"
    assert len(completed[0]["final_output"]) > 80


def test_code_transform_safe_expression_and_sandbox():
    out = execute_code_transform(
        mode="expression",
        source_text='{"score": 92}',
        expression="round(data['score'] * 1.1, 1)",
    )
    assert out == "101.2"

    with pytest.raises(SafeCodeError):
        execute_code_transform(
            mode="expression",
            source_text="hello",
            expression="__import__('os').system('echo pwn')",
        )


@pytest.mark.asyncio
async def test_single_node_debug_versioning_kb_search_and_analytics(client: httpx.AsyncClient):
    # 1. Single-node test
    t_resp = await client.post(
        "/api/workflows/tpl-market-intel/nodes/test",
        json={
            "node": {
                "id": "code_1",
                "type": "code",
                "data": {
                    "label": "Code Test",
                    "transformMode": "json_extract",
                    "sourceTemplate": "{{http_1.output}}",
                    "jsonPath": "data.growth",
                },
            },
            "inputs": {},
            "upstream_outputs": {"http_1": '{"data": {"growth": "+38.6%"}}'},
        },
    )
    assert t_resp.status_code == 200
    assert t_resp.json()["output_text"] == "+38.6%"

    # 2. Versioning create + list + restore
    v_create = await client.post(
        "/api/workflows/tpl-competitor-report/versions",
        json={"tag": "v1.0-release", "note": "Initial production baseline"},
    )
    assert v_create.status_code == 201
    ver_id = v_create.json()["id"]
    v_list = await client.get("/api/workflows/tpl-competitor-report/versions")
    assert v_list.status_code == 200
    assert len(v_list.json()) == 1
    v_restore = await client.post(
        f"/api/workflows/tpl-competitor-report/versions/{ver_id}/restore"
    )
    assert v_restore.status_code == 200

    # 3. Live KB BM25 search endpoint
    kb_s = await client.post(
        "/api/knowledge/search",
        json={"query": "小红书 种草 痛点", "top_k": 3},
    )
    assert kb_s.status_code == 200
    assert kb_s.json()["total_matches"] >= 1

    # 4. Run one template and check analytics summary
    await client.post(
        "/api/workflows/tpl-intent-router/run",
        json={
            "inputs": {"customer_name": "周总", "message": "请问企业私有化报价套餐怎么买？"},
            "language": "zh",
        },
    )
    an_resp = await client.get("/api/analytics/summary")
    assert an_resp.status_code == 200
    an = an_resp.json()
    assert an["total_workflows"] == 9
    assert an["total_runs"] >= 1
    assert an["success_rate"] == 100.0


@pytest.mark.asyncio
async def test_copilot_text_to_dag_and_execute_generated_workflow(client: httpx.AsyncClient):
    gen = await client.post(
        "/api/copilot/generate",
        json={
            "prompt": "搭建一个简历智能筛选、知识库匹配并包含外部API和人工审批的面试工作流",
            "language": "zh",
            "save_as_workflow": True,
        },
    )
    assert gen.status_code == 200
    bp = gen.json()
    assert bp["saved_workflow_id"]
    node_types = {n["type"] for n in bp["graph_json"]["nodes"]}
    assert "input" in node_types
    assert "output" in node_types
    assert "approval" in node_types
    assert "note" in node_types

    # Test Graph Optimizer injects QA Critic
    opt = await client.post("/api/copilot/optimize", json={"graph_json": bp["graph_json"]})
    assert opt.status_code == 200
    assert len(opt.json()["graph_json"]["nodes"]) >= len(bp["graph_json"]["nodes"])


@pytest.mark.asyncio
async def test_arena_ab_comparison_and_eval_suite(client: httpx.AsyncClient):
    # Arena parallel A/B benchmark
    arena = await client.post(
        "/api/arena/compare",
        json={
            "workflow_id": "tpl-competitor-report",
            "inputs": {"company": "Linear", "industry": "研发协作 SaaS", "audience": "工程团队"},
            "variant_a": {"label": "Precise A", "model": "deepseek-chat", "temperature": 0.2},
            "variant_b": {
                "label": "Creative B",
                "model": "gpt-4o-mini",
                "temperature": 0.85,
                "system_prompt_suffix": "增加量化ROI与优先级矩阵",
            },
        },
    )
    assert arena.status_code == 200
    ar = arena.json()
    assert ar["winner"] in {"A", "B", "TIE"}
    assert ar["variant_a"]["scores"]["overall_score"] > 50
    assert ar["variant_b"]["scores"]["overall_score"] > 50

    # Eval Suite regression runner on contract review (both High Risk & Low Risk cases)
    ev = await client.post(
        "/api/evals/run",
        json={"workflow_id": "tpl-contract-review", "language": "zh"},
    )
    assert ev.status_code == 200
    ev_data = ev.json()
    assert ev_data["total_cases"] == 2
    assert ev_data["pass_rate"] == 100.0


@pytest.mark.asyncio
async def test_hitl_approval_live_pause_edit_and_resume():
    import asyncio
    from app.engine.approval_gate import approval_registry
    from app.engine.dag_executor import WorkflowExecutor

    graph = {
        "nodes": [
            {"id": "in_1", "type": "input", "data": {"label": "In"}},
            {"id": "ap_1", "type": "approval", "data": {"label": "Gate", "sourceTemplate": "{{in_1.output}}"}},
            {"id": "out_1", "type": "output", "data": {"label": "Out", "template": "FINAL: {{ap_1.output}}"}},
            {"id": "note_1", "type": "note", "data": {"label": "Sticky", "content": "Ignored by DAG"}},
        ],
        "edges": [
            {"id": "e1", "source": "in_1", "target": "ap_1"},
            {"id": "e2", "source": "ap_1", "target": "out_1"},
        ],
    }
    q: asyncio.Queue = asyncio.Queue()
    exe = WorkflowExecutor(graph_json=graph, inputs={"item": "Draft"}, knowledge_docs=[], demo_delay_ms=0)
    task = asyncio.create_task(exe.run("hitl-run-1", q))

    # Wait until node_waiting_approval fires
    waiting_evt = None
    for _ in range(20):
        evt = await asyncio.wait_for(q.get(), timeout=2.0)
        if evt and evt["event"] == "node_waiting_approval":
            waiting_evt = evt
            break
    assert waiting_evt is not None
    assert waiting_evt["data"]["node_id"] == "ap_1"

    # Human edits & approves mid-flight
    ok = approval_registry.resolve(
        "hitl-run-1",
        "ap_1",
        approved=True,
        edited_output="Human Approved & Edited Text",
    )
    assert ok is True

    result = await asyncio.wait_for(task, timeout=3.0)
    assert result.status == "COMPLETED"
    assert "Human Approved & Edited Text" in result.final_output


@pytest.mark.asyncio
async def test_schedules_and_webhook_trigger(client: httpx.AsyncClient):
    sch_list = await client.get("/api/schedules")
    assert sch_list.status_code == 200
    assert len(sch_list.json()) >= 1
    sch_id = sch_list.json()[0]["id"]

    trig = await client.post(
        "/api/webhooks/tpl-market-intel/trigger",
        json={"inputs": {"company": "SynthFlow", "industry": "AI Agent"}, "schedule_id": sch_id},
    )
    assert trig.status_code == 200
    assert trig.json()["ok"] is True
    assert len(trig.json()["final_output"]) > 80


@pytest.mark.asyncio
async def test_aggregator_escaped_newline_and_hitl_reject_and_cancel():
    import asyncio
    from app.engine.approval_gate import approval_registry
    from app.engine.dag_executor import WorkflowExecutor

    # 1. Aggregator escaped \n\n---\n\n must unescape to real newlines
    agg_graph = {
        "nodes": [
            {"id": "in_1", "type": "input", "data": {"label": "In"}},
            {"id": "c1", "type": "code", "data": {"label": "C1", "transformMode": "expression", "sourceTemplate": "A", "expression": "text"}},
            {"id": "c2", "type": "code", "data": {"label": "C2", "transformMode": "expression", "sourceTemplate": "B", "expression": "text"}},
            {"id": "agg", "type": "aggregator", "data": {"label": "Agg", "strategy": "markdown_merge", "separator": "\\n\\n---\\n\\n"}},
            {"id": "out", "type": "output", "data": {"label": "Out", "template": "{{agg.output}}"}},
        ],
        "edges": [
            {"id": "e1", "source": "in_1", "target": "c1"},
            {"id": "e2", "source": "in_1", "target": "c2"},
            {"id": "e3", "source": "c1", "target": "agg"},
            {"id": "e4", "source": "c2", "target": "agg"},
            {"id": "e5", "source": "agg", "target": "out"},
        ],
    }
    q1: asyncio.Queue = asyncio.Queue()
    res1 = await WorkflowExecutor(graph_json=agg_graph, inputs={}, knowledge_docs=[], demo_delay_ms=0).run("agg-test", q1)
    assert res1.status == "COMPLETED"
    assert "\n\n---\n\n" in res1.final_output
    assert "\\n" not in res1.final_output

    # 2. HITL rejection stops downstream and marks FAILED
    rej_graph = {
        "nodes": [
            {"id": "in_1", "type": "input", "data": {"label": "In"}},
            {"id": "ap_1", "type": "approval", "data": {"label": "Gate"}},
            {"id": "out_1", "type": "output", "data": {"label": "Out", "template": "{{ap_1.output}}"}},
        ],
        "edges": [
            {"id": "e1", "source": "in_1", "target": "ap_1"},
            {"id": "e2", "source": "ap_1", "target": "out_1"},
        ],
    }
    q2: asyncio.Queue = asyncio.Queue()
    task = asyncio.create_task(
        WorkflowExecutor(graph_json=rej_graph, inputs={"x": "1"}, knowledge_docs=[], demo_delay_ms=0).run("hitl-rej", q2)
    )
    for _ in range(15):
        evt = await asyncio.wait_for(q2.get(), timeout=2.0)
        if evt and evt["event"] == "node_waiting_approval":
            break
    assert approval_registry.cancel_run("hitl-rej") == 1
    res2 = await asyncio.wait_for(task, timeout=2.0)
    assert res2.status == "FAILED"
    assert len(approval_registry.pending_keys()) == 0



