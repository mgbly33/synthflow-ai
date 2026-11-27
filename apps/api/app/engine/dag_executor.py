from __future__ import annotations

import asyncio
import json
import re
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.engine.approval_gate import approval_registry
from app.engine.code_transform import execute_code_transform
from app.engine.http_tool import execute_http_node
from app.engine.knowledge_retriever import retrieve_top_k, tokenize_bilingual
from app.engine.llm_provider import estimate_tokens, stream_llm_response

_VAR_PATTERN = re.compile(r"\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}")
_NON_EXECUTABLE_TYPES = {"note"}


class DAGValidationError(ValueError):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


@dataclass
class NodeExecutionRecord:
    node_id: str
    node_type: str
    node_label: str
    status: str  # COMPLETED | SKIPPED | FAILED
    input_snapshot: str = ""
    output_text: str = ""
    duration_ms: int = 0
    offset_ms: int = 0
    tokens_used: int = 0
    error_message: str | None = None


@dataclass
class ExecutionResult:
    status: str
    final_output: str
    total_duration_ms: int
    total_tokens: int
    node_records: list[NodeExecutionRecord] = field(default_factory=list)


def validate_dag(graph_json: dict[str, Any]) -> list[list[str]]:
    """Validate workflow DAG using Kahn's topological sort and return execution layers."""
    all_nodes = graph_json.get("nodes") or []
    nodes = [n for n in all_nodes if str(n.get("type", "")).lower() not in _NON_EXECUTABLE_TYPES]
    edges = graph_json.get("edges") or []
    errors: list[str] = []

    if not nodes:
        raise DAGValidationError(["工作流画布为空，请至少添加一个节点 / Workflow graph has no nodes"])

    node_map: dict[str, dict[str, Any]] = {}
    for n in nodes:
        nid = str(n.get("id", "")).strip()
        if not nid:
            errors.append("存在缺少 ID 的节点 / Found a node missing an id")
            continue
        if nid in node_map:
            errors.append(f"节点 ID 重复：{nid} / Duplicate node id: {nid}")
        node_map[nid] = n

    has_input = any(str(n.get("type", "")).lower() == "input" for n in nodes)
    if not has_input:
        errors.append("工作流缺少 Input（输入）节点 / Workflow must contain at least one Input node")

    in_degree: dict[str, int] = {nid: 0 for nid in node_map}
    adj: dict[str, list[str]] = defaultdict(list)

    for e in edges:
        src = str(e.get("source", "")).strip()
        tgt = str(e.get("target", "")).strip()
        if src not in node_map or tgt not in node_map:
            errors.append(
                f"检测到孤立失效连线 ({src} -> {tgt}) / Dangling edge references missing node ({src} -> {tgt})"
            )
            continue
        if src == tgt:
            errors.append(f"检测到节点自环：{src} -> {src} / Self-loop detected on node {src}")
            continue
        adj[src].append(tgt)
        in_degree[tgt] += 1

    if errors:
        raise DAGValidationError(errors)

    queue: deque[str] = deque([nid for nid, deg in in_degree.items() if deg == 0])
    layers: list[list[str]] = []
    visited_count = 0

    while queue:
        layer = list(queue)
        queue.clear()
        layers.append(layer)
        for nid in layer:
            visited_count += 1
            for nxt in adj[nid]:
                in_degree[nxt] -= 1
                if in_degree[nxt] == 0:
                    queue.append(nxt)

    if visited_count < len(node_map):
        cycle_nodes = [nid for nid, deg in in_degree.items() if deg > 0]
        raise DAGValidationError(
            [
                f"检测到工作流环路（DAG 不合法），涉及节点：{', '.join(cycle_nodes)} / "
                f"Cycle detected in workflow graph involving nodes: {', '.join(cycle_nodes)}"
            ]
        )

    return layers


def render_template(
    template: str,
    inputs: dict[str, Any],
    node_outputs: dict[str, str],
) -> str:
    """Resolve {{input.field}}, {{input}}, and {{nodeId.output}} expressions."""
    if not template:
        return ""

    def _replace(match: re.Match[str]) -> str:
        expr = match.group(1).strip()
        if expr == "input":
            return "\n".join(f"- {k}: {v}" for k, v in inputs.items())
        if expr.startswith("input."):
            field_name = expr[len("input.") :]
            val = inputs.get(field_name, "")
            return "" if val is None else str(val)
        if "." in expr:
            node_id, attr = expr.split(".", 1)
            if attr in {"output", "text", "result"}:
                return node_outputs.get(node_id, "")
            raw = node_outputs.get(node_id, "")
            if raw:
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict) and attr in parsed:
                        v = parsed[attr]
                        return json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)
                except Exception:
                    pass
            return raw
        if expr in node_outputs:
            return node_outputs[expr]
        if expr in inputs:
            return str(inputs[expr])
        # Return empty string for unknown/skipped node.output references instead of leaking raw {{...}}
        if "." in expr and expr.split(".", 1)[1] in {"output", "text", "result"}:
            return ""
        return match.group(0)

    return _VAR_PATTERN.sub(_replace, template)


def evaluate_condition(
    text: str,
    operator: str,
    value: str,
    case_sensitive: bool = False,
) -> tuple[bool, str]:
    """Evaluate Condition node expression and return (bool_result, explanation)."""
    op = (operator or "contains").lower()
    src = text or ""
    target = value or ""

    cmp_src = src if case_sensitive else src.lower()
    cmp_tgt = target if case_sensitive else target.lower()

    if op == "contains":
        res = cmp_tgt in cmp_src
        return res, f"contains('{target}') => {res}"
    if op == "not_contains":
        res = cmp_tgt not in cmp_src
        return res, f"not_contains('{target}') => {res}"
    if op == "contains_any":
        terms = [t.strip() for t in re.split(r"[,，|;；]", target) if t.strip()]
        matched = [t for t in terms if (t if case_sensitive else t.lower()) in cmp_src]
        res = len(matched) > 0
        return res, f"contains_any({terms}) matched={matched} => {res}"
    if op == "equals":
        res = cmp_src.strip() == cmp_tgt.strip()
        return res, f"equals('{target}') => {res}"
    if op == "length_gt":
        try:
            threshold = int(float(target))
        except ValueError:
            threshold = 0
        res = len(src) > threshold
        return res, f"length({len(src)}) > {threshold} => {res}"
    if op == "length_lt":
        try:
            threshold = int(float(target))
        except ValueError:
            threshold = 0
        res = len(src) < threshold
        return res, f"length({len(src)}) < {threshold} => {res}"
    if op == "regex":
        flags = 0 if case_sensitive else re.IGNORECASE
        res = bool(re.search(target, src, flags=flags))
        return res, f"regex('{target}') => {res}"
    if op == "json_field_equals":
        if "=" in target:
            key, expected = target.split("=", 1)
            key, expected = key.strip(), expected.strip()
            try:
                parsed = json.loads(src)
                actual = str(parsed.get(key, ""))
                res = (actual == expected) if case_sensitive else (actual.lower() == expected.lower())
                return res, f"json.{key}('{actual}') == '{expected}' => {res}"
            except Exception:
                return False, "json_field_equals failed: invalid JSON"
        return False, "json_field_equals requires 'field=value'"

    res = cmp_tgt in cmp_src
    return res, f"default_contains('{target}') => {res}"


def classify_intent_local(
    text: str,
    categories: list[dict[str, Any]],
) -> tuple[str, str, dict[str, float]]:
    """Multi-way bilingual intent scoring over category keywords & descriptions."""
    if not categories:
        return "default", "Default", {}

    lowered = (text or "").lower()
    src_tokens = set(tokenize_bilingual(lowered))
    scores: dict[str, float] = {}

    for cat in categories:
        cid = str(cat.get("id") or "cat_1")
        label = str(cat.get("label") or cid)
        keywords = str(cat.get("keywords") or "")
        desc = str(cat.get("description") or "")
        score = 0.0

        # Exact keyword substring boosts
        for kw in [k.strip().lower() for k in re.split(r"[,，|;；]", keywords) if k.strip()]:
            if kw in lowered:
                score += 3.5

        # Token overlap with label & description
        cat_tokens = set(tokenize_bilingual(f"{label} {desc} {keywords}"))
        if cat_tokens and src_tokens:
            overlap = len(cat_tokens & src_tokens)
            score += overlap * 0.8

        scores[cid] = round(score, 2)

    best_cat = max(categories, key=lambda c: scores.get(str(c.get("id") or "cat_1"), 0.0))
    best_id = str(best_cat.get("id") or "cat_1")
    best_label = str(best_cat.get("label") or best_id)
    return best_id, best_label, scores


class WorkflowExecutor:
    """Async DAG executor supporting 10 enterprise node types, parallel waves, and SSE streaming."""

    def __init__(
        self,
        *,
        graph_json: dict[str, Any],
        inputs: dict[str, Any],
        knowledge_docs: list[dict[str, Any]],
        provider_mode: str = "DEMO",
        base_url: str = "",
        api_key: str = "",
        default_model: str = "synthflow-demo-v1",
        language: str = "zh",
        demo_delay_ms: int = 28,
        http_client: httpx.AsyncClient | None = None,
        auto_approve_hitl: bool = False,
    ):
        self.graph_json = graph_json
        self.inputs = inputs
        self.knowledge_docs = knowledge_docs
        self.provider_mode = provider_mode
        self.base_url = base_url
        self.api_key = api_key
        self.default_model = default_model
        self.language = language
        self.demo_delay_ms = demo_delay_ms
        self.http_client = http_client
        self.auto_approve_hitl = auto_approve_hitl

    async def run(
        self,
        run_id: str,
        event_queue: asyncio.Queue[dict[str, Any] | None],
    ) -> ExecutionResult:
        layers = validate_dag(self.graph_json)
        all_nodes = self.graph_json.get("nodes") or []
        nodes = [n for n in all_nodes if str(n.get("type", "")).lower() not in _NON_EXECUTABLE_TYPES]
        edges = self.graph_json.get("edges") or []

        node_map: dict[str, dict[str, Any]] = {str(n["id"]): n for n in nodes}
        incoming_edges: dict[str, list[dict[str, Any]]] = defaultdict(list)
        outgoing_edges: dict[str, list[dict[str, Any]]] = defaultdict(list)

        for e in edges:
            src = str(e["source"])
            tgt = str(e["target"])
            if src in node_map and tgt in node_map:
                incoming_edges[tgt].append(e)
                outgoing_edges[src].append(e)

        node_outputs: dict[str, str] = {}
        active_edges: set[str] = set()
        records: list[NodeExecutionRecord] = []
        total_tokens = 0
        run_start = time.perf_counter()

        await event_queue.put(
            {
                "event": "run_started",
                "data": {
                    "run_id": run_id,
                    "provider_mode": self.provider_mode,
                    "layers": layers,
                    "total_nodes": len(nodes),
                },
            }
        )

        final_output = ""
        run_status = "COMPLETED"

        try:
            for layer in layers:
                tasks = [
                    self._execute_single_node(
                        run_id=run_id,
                        node=node_map[nid],
                        incoming=incoming_edges[nid],
                        outgoing=outgoing_edges[nid],
                        node_outputs=node_outputs,
                        active_edges=active_edges,
                        event_queue=event_queue,
                        run_start=run_start,
                    )
                    for nid in layer
                ]
                layer_results: list[NodeExecutionRecord] = await asyncio.gather(*tasks)
                for rec in layer_results:
                    records.append(rec)
                    total_tokens += rec.tokens_used
                    if rec.status == "FAILED":
                        run_status = "FAILED"
                    if rec.node_type == "output" and rec.status == "COMPLETED" and rec.output_text:
                        final_output = rec.output_text

                if run_status == "FAILED":
                    break

            if not final_output:
                for rec in reversed(records):
                    if rec.status == "COMPLETED" and rec.output_text:
                        final_output = rec.output_text
                        break

        except asyncio.CancelledError:
            run_status = "CANCELLED"
            raise

        total_duration_ms = int((time.perf_counter() - run_start) * 1000)

        await event_queue.put(
            {
                "event": "run_completed",
                "data": {
                    "run_id": run_id,
                    "status": run_status,
                    "final_output": final_output,
                    "total_duration_ms": total_duration_ms,
                    "total_tokens": total_tokens,
                },
            }
        )

        return ExecutionResult(
            status=run_status,
            final_output=final_output,
            total_duration_ms=total_duration_ms,
            total_tokens=total_tokens,
            node_records=records,
        )

    async def execute_isolated_node(
        self,
        node: dict[str, Any],
        upstream_outputs: dict[str, str],
    ) -> NodeExecutionRecord:
        """Run a single node in isolation for interactive node-level debugging."""
        dummy_queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        return await self._execute_single_node(
            run_id="debug-single-node",
            node=node,
            incoming=[],
            outgoing=[],
            node_outputs=dict(upstream_outputs),
            active_edges=set(),
            event_queue=dummy_queue,
            run_start=time.perf_counter(),
        )

    async def _execute_single_node(
        self,
        *,
        run_id: str,
        node: dict[str, Any],
        incoming: list[dict[str, Any]],
        outgoing: list[dict[str, Any]],
        node_outputs: dict[str, str],
        active_edges: set[str],
        event_queue: asyncio.Queue[dict[str, Any] | None],
        run_start: float,
    ) -> NodeExecutionRecord:
        node_id = str(node["id"])
        node_type = str(node.get("type", "llm")).lower()
        data = node.get("data") or {}
        label = str(
            (data.get("labelEn") if self.language == "en" and data.get("labelEn") else data.get("label"))
            or node_id
        )

        if incoming and not any(str(e.get("id", f"{e['source']}->{e['target']}")) in active_edges for e in incoming):
            offset_ms = int((time.perf_counter() - run_start) * 1000)
            node_outputs[node_id] = ""
            await event_queue.put(
                {
                    "event": "node_skipped",
                    "data": {
                        "run_id": run_id,
                        "node_id": node_id,
                        "node_type": node_type,
                        "node_label": label,
                        "reason": "Upstream branch not routed",
                    },
                }
            )
            return NodeExecutionRecord(
                node_id=node_id,
                node_type=node_type,
                node_label=label,
                status="SKIPPED",
                input_snapshot="",
                output_text="",
                duration_ms=0,
                offset_ms=offset_ms,
                tokens_used=0,
            )

        offset_ms = int((time.perf_counter() - run_start) * 1000)
        t0 = time.perf_counter()

        await event_queue.put(
            {
                "event": "node_started",
                "data": {
                    "run_id": run_id,
                    "node_id": node_id,
                    "node_type": node_type,
                    "node_label": label,
                    "offset_ms": offset_ms,
                },
            }
        )

        input_snapshot = ""
        output_text = ""
        tokens_used = 0
        activated_handles: set[str | None] | None = None

        try:
            if node_type == "input":
                fields = data.get("fields") or []
                resolved_inputs: dict[str, Any] = dict(self.inputs)
                for f in fields:
                    fname = f.get("name")
                    if fname and (fname not in resolved_inputs or resolved_inputs[fname] == ""):
                        if f.get("defaultValue"):
                            resolved_inputs[fname] = f["defaultValue"]
                self.inputs.update(resolved_inputs)
                input_snapshot = json.dumps(resolved_inputs, ensure_ascii=False, indent=2)
                output_text = "\n".join(f"**{k}**: {v}" for k, v in resolved_inputs.items())
                if self.demo_delay_ms > 0:
                    await asyncio.sleep(min(0.14, self.demo_delay_ms * 3 / 1000.0))

            elif node_type == "knowledge":
                query_tpl = str(data.get("queryTemplate") or "{{input}}")
                query = render_template(query_tpl, self.inputs, node_outputs).strip()
                if not query:
                    query = " ".join(str(v) for v in self.inputs.values())
                top_k = int(data.get("topK") or 3)
                doc_ids = set(data.get("docIds") or [])
                scoped_docs = (
                    [d for d in self.knowledge_docs if d.get("id") in doc_ids]
                    if doc_ids
                    else self.knowledge_docs
                )
                matches = retrieve_top_k(query, scoped_docs, top_k=top_k)
                input_snapshot = f"Query: {query} (Top-{top_k})"
                if matches:
                    sections = [
                        f"#### [{i + 1}] {m['doc_title']} (BM25: {m['score']})\n{m['text']}"
                        for i, m in enumerate(matches)
                    ]
                    output_text = "\n\n".join(sections)
                else:
                    output_text = "未检索到相关知识片段 / No matching knowledge chunks found."
                if self.demo_delay_ms > 0:
                    await asyncio.sleep(min(0.22, self.demo_delay_ms * 5 / 1000.0))

            elif node_type == "llm":
                sys_prompt = render_template(str(data.get("systemPrompt") or ""), self.inputs, node_outputs)
                user_prompt = render_template(str(data.get("userPrompt") or "{{input}}"), self.inputs, node_outputs)
                model = str(data.get("model") or self.default_model)
                temperature = float(data.get("temperature") if data.get("temperature") is not None else 0.7)
                role = str(data.get("role") or "general")

                input_snapshot = f"[Model: {model} | Temp: {temperature}]\nSystem: {sys_prompt[:300]}\nUser: {user_prompt[:600]}"
                chunks: list[str] = []
                async for token in stream_llm_response(
                    provider_mode=self.provider_mode,
                    base_url=self.base_url,
                    api_key=self.api_key,
                    model=model,
                    temperature=temperature,
                    system_prompt=sys_prompt,
                    user_prompt=user_prompt,
                    node_role=role,
                    node_label=label,
                    inputs=self.inputs,
                    language=self.language,
                    demo_delay_ms=self.demo_delay_ms,
                    http_client=self.http_client,
                ):
                    chunks.append(token)
                    await event_queue.put(
                        {
                            "event": "node_token",
                            "data": {
                                "run_id": run_id,
                                "node_id": node_id,
                                "token": token,
                            },
                        }
                    )
                output_text = "".join(chunks)
                tokens_used = estimate_tokens(sys_prompt + user_prompt) + estimate_tokens(output_text)

            elif node_type == "condition":
                src_tpl = str(data.get("sourceTemplate") or "")
                if not src_tpl and incoming:
                    src_tpl = "{{" + str(incoming[0]["source"]) + ".output}}"
                evaluated_text = render_template(src_tpl, self.inputs, node_outputs)
                operator = str(data.get("operator") or "contains")
                match_value = str(data.get("value") or "")
                case_sensitive = bool(data.get("caseSensitive", False))

                passed, detail = evaluate_condition(evaluated_text, operator, match_value, case_sensitive)
                branch = "true" if passed else "false"
                activated_handles = {branch}
                input_snapshot = f"Source: {evaluated_text[:400]}\nRule: {operator} ({match_value})"
                output_text = json.dumps(
                    {"matched": passed, "branch": branch, "detail": detail},
                    ensure_ascii=False,
                    indent=2,
                )
                if self.demo_delay_ms > 0:
                    await asyncio.sleep(min(0.18, self.demo_delay_ms * 4 / 1000.0))

            elif node_type == "classifier":
                src_tpl = str(data.get("sourceTemplate") or "{{input}}")
                evaluated_text = render_template(src_tpl, self.inputs, node_outputs)
                categories = data.get("categories") or [
                    {"id": "tech", "label": "技术支持", "keywords": "500,504,api,bug,报错,故障,timeout"},
                    {"id": "sales", "label": "商务报价", "keywords": "价格,报价,采购,企业版,pricing,quote,demo"},
                    {"id": "refund", "label": "退款维权", "keywords": "退款,投诉,取消,退订,refund,cancel"},
                ]
                best_id, best_label, scores = classify_intent_local(evaluated_text, categories)
                activated_handles = {best_id}
                input_snapshot = f"Text: {evaluated_text[:400]}\nCategories: {[c.get('id') for c in categories]}"
                output_text = json.dumps(
                    {
                        "selected_intent": best_id,
                        "selected_label": best_label,
                        "scores": scores,
                    },
                    ensure_ascii=False,
                    indent=2,
                )
                if self.demo_delay_ms > 0:
                    await asyncio.sleep(min(0.2, self.demo_delay_ms * 4 / 1000.0))

            elif node_type == "code":
                src_tpl = str(data.get("sourceTemplate") or "")
                if not src_tpl and incoming:
                    src_tpl = "{{" + str(incoming[0]["source"]) + ".output}}"
                source_text = render_template(src_tpl, self.inputs, node_outputs)
                mode = str(data.get("transformMode") or "markdown_summary")
                expression = str(data.get("expression") or "")
                json_path = str(data.get("jsonPath") or "")
                regex_pattern = str(data.get("regexPattern") or "")
                regex_replacement = str(data.get("regexReplacement") or "")
                input_snapshot = f"Mode: {mode}\nSource ({len(source_text)} chars): {source_text[:300]}"
                output_text = execute_code_transform(
                    mode=mode,
                    source_text=source_text,
                    expression=expression,
                    json_path=json_path,
                    regex_pattern=regex_pattern,
                    regex_replacement=regex_replacement,
                    inputs=self.inputs,
                )
                if self.demo_delay_ms > 0:
                    await asyncio.sleep(min(0.16, self.demo_delay_ms * 3 / 1000.0))

            elif node_type == "aggregator":
                strategy = str(data.get("strategy") or "markdown_merge")
                raw_sep = str(data.get("separator") or "\n\n---\n\n")
                separator = raw_sep.replace("\\n", "\n").replace("\\t", "\t")
                active_parts: list[tuple[str, str]] = []
                for e in incoming:
                    eid = str(e.get("id", f"{e['source']}->{e['target']}"))
                    if eid in active_edges:
                        val = node_outputs.get(str(e["source"]), "").strip()
                        if val:
                            active_parts.append((str(e["source"]), val))
                # If run in isolation without incoming edges, use any upstream_outputs
                if not incoming and node_outputs:
                    for k, v in node_outputs.items():
                        if v.strip():
                            active_parts.append((k, v.strip()))

                input_snapshot = f"Strategy: {strategy} · Merged {len(active_parts)} active branch(es)"
                if strategy == "first_non_empty":
                    output_text = active_parts[0][1] if active_parts else ""
                elif strategy == "json_bundle":
                    output_text = json.dumps(
                        {src: val for src, val in active_parts},
                        ensure_ascii=False,
                        indent=2,
                    )
                else:
                    output_text = separator.join(val for _, val in active_parts)
                if self.demo_delay_ms > 0:
                    await asyncio.sleep(min(0.14, self.demo_delay_ms * 3 / 1000.0))

            elif node_type == "loop":
                src_tpl = str(data.get("sourceTemplate") or "{{input.markets}}")
                raw_list = render_template(src_tpl, self.inputs, node_outputs)
                delimiter = str(data.get("delimiter") or ",")
                split_pat = r"[\n,，;；]+" if delimiter == "," else re.escape(delimiter)
                items = [it.strip() for it in re.split(split_pat, raw_list) if it.strip()][:8]
                if not items:
                    items = ["EN-US", "JA-JP", "DE-DE"]
                item_tpl = str(
                    data.get("itemTemplate")
                    or "### 市场站点：{{item}}\n- **本地化爆款标题**：专为 {{item}} 买家定制的高转化标题\n- **核心五点卖点**：突出 {{input.product}} 核心优势与本地售后保障\n- **搜索热词 Tag**：`#{{item}}` `#BestSeller`"
                )
                input_snapshot = f"Iterating {len(items)} items: {items}"
                rendered_items: list[str] = []
                for idx, item in enumerate(items, start=1):
                    item_inputs = {**self.inputs, "item": item, "index": str(idx)}
                    block = render_template(item_tpl, item_inputs, node_outputs)
                    rendered_items.append(block)
                    await event_queue.put(
                        {
                            "event": "node_token",
                            "data": {
                                "run_id": run_id,
                                "node_id": node_id,
                                "token": (("\n\n" if idx > 1 else "") + block),
                            },
                        }
                    )
                    if self.demo_delay_ms > 0:
                        await asyncio.sleep(min(0.18, self.demo_delay_ms * 4 / 1000.0))
                output_text = "\n\n".join(rendered_items)
                tokens_used = estimate_tokens(output_text)

            elif node_type == "http":
                raw_url = render_template(str(data.get("url") or ""), self.inputs, node_outputs)
                method = str(data.get("method") or "GET")
                headers = data.get("headers") if isinstance(data.get("headers"), dict) else None
                body = render_template(str(data.get("bodyTemplate") or ""), self.inputs, node_outputs)
                sandbox_mode = bool(data.get("sandboxMode", True))
                input_snapshot = f"{method.upper()} {raw_url} (sandbox={sandbox_mode})"
                output_text = await execute_http_node(
                    url=raw_url,
                    method=method,
                    headers=headers,
                    body=body or None,
                    sandbox_mode=sandbox_mode,
                )
                if self.demo_delay_ms > 0:
                    await asyncio.sleep(min(0.22, self.demo_delay_ms * 4 / 1000.0))

            elif node_type == "approval":
                src_tpl = str(data.get("sourceTemplate") or "")
                if not src_tpl and incoming:
                    src_tpl = "{{" + str(incoming[0]["source"]) + ".output}}"
                pending_text = render_template(src_tpl, self.inputs, node_outputs)
                instructions = str(
                    data.get("instructions")
                    or "请复核上游输出内容，确认无误后点击放行，或在线编辑后继续执行。"
                )
                input_snapshot = f"HITL Gate Instructions: {instructions}\nPending Payload ({len(pending_text)} chars)"

                if self.auto_approve_hitl:
                    output_text = pending_text
                else:
                    approval_registry.register(run_id, node_id)
                    await event_queue.put(
                        {
                            "event": "node_waiting_approval",
                            "data": {
                                "run_id": run_id,
                                "node_id": node_id,
                                "node_label": label,
                                "instructions": instructions,
                                "pending_output": pending_text,
                            },
                        }
                    )
                    decision = await approval_registry.wait_for_decision(run_id, node_id)
                    if not decision.approved:
                        raise RuntimeError(
                            f"人工审批驳回 / Rejected by reviewer: {decision.comment or 'No reason provided'}"
                        )
                    output_text = (
                        decision.edited_output
                        if decision.edited_output is not None and decision.edited_output.strip() != ""
                        else pending_text
                    )

            elif node_type == "output":
                tpl = str(data.get("template") or "")
                if tpl.strip():
                    output_text = render_template(tpl, self.inputs, node_outputs).strip()
                else:
                    parts = []
                    for e in incoming:
                        eid = str(e.get("id", f"{e['source']}->{e['target']}"))
                        if eid in active_edges:
                            val = node_outputs.get(str(e["source"]), "").strip()
                            if val:
                                parts.append(val)
                    output_text = "\n\n---\n\n".join(parts)
                output_text = re.sub(r"(\n\s*---\s*\n){2,}", "\n\n---\n\n", output_text).strip()
                output_text = re.sub(r"^(\s*---\s*\n)+", "", output_text).strip()
                output_text = re.sub(r"(\n\s*---\s*)+$", "", output_text).strip()
                input_snapshot = f"Aggregated from {len(incoming)} upstream connection(s)"
                if self.demo_delay_ms > 0:
                    await asyncio.sleep(min(0.12, self.demo_delay_ms * 3 / 1000.0))

            else:
                output_text = f"Unsupported node type: {node_type}"

            node_outputs[node_id] = output_text

            activated_edge_ids: list[str] = []
            for e in outgoing:
                eid = str(e.get("id", f"{e['source']}->{e['target']}"))
                src_handle = e.get("sourceHandle")
                if activated_handles is None or (src_handle or "true").lower() in {
                    str(h).lower() for h in activated_handles
                }:
                    active_edges.add(eid)
                    activated_edge_ids.append(eid)

            duration_ms = int((time.perf_counter() - t0) * 1000)

            await event_queue.put(
                {
                    "event": "node_completed",
                    "data": {
                        "run_id": run_id,
                        "node_id": node_id,
                        "node_type": node_type,
                        "node_label": label,
                        "duration_ms": duration_ms,
                        "offset_ms": offset_ms,
                        "tokens_used": tokens_used,
                        "output_text": output_text,
                        "input_snapshot": input_snapshot,
                        "activated_edges": activated_edge_ids,
                    },
                }
            )

            return NodeExecutionRecord(
                node_id=node_id,
                node_type=node_type,
                node_label=label,
                status="COMPLETED",
                input_snapshot=input_snapshot,
                output_text=output_text,
                duration_ms=duration_ms,
                offset_ms=offset_ms,
                tokens_used=tokens_used,
            )

        except Exception as exc:
            duration_ms = int((time.perf_counter() - t0) * 1000)
            err_msg = str(exc)
            await event_queue.put(
                {
                    "event": "node_error",
                    "data": {
                        "run_id": run_id,
                        "node_id": node_id,
                        "node_type": node_type,
                        "node_label": label,
                        "duration_ms": duration_ms,
                        "error": err_msg,
                    },
                }
            )
            return NodeExecutionRecord(
                node_id=node_id,
                node_type=node_type,
                node_label=label,
                status="FAILED",
                input_snapshot=input_snapshot,
                output_text=output_text,
                duration_ms=duration_ms,
                offset_ms=offset_ms,
                tokens_used=tokens_used,
                error_message=err_msg,
            )
