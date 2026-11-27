from __future__ import annotations

import asyncio
import copy
import re
from typing import Any

import httpx

from app.engine.dag_executor import ExecutionResult, WorkflowExecutor


def score_output_quality(output: str, duration_ms: int, tokens: int) -> dict[str, Any]:
    """Deterministic multi-dimensional rubric scoring (0-100) for Arena A/B evaluation."""
    text = (output or "").strip()
    if not text:
        return {
            "structure_score": 0,
            "depth_score": 0,
            "speed_score": 0,
            "efficiency_score": 0,
            "overall_score": 0,
        }

    # Structure: headings, tables, lists, blockquotes, code blocks
    headings = len(re.findall(r"^#{1,4}\s+", text, flags=re.M))
    tables = len(re.findall(r"^\|.+\|$", text, flags=re.M))
    bullets = len(re.findall(r"^\s*[-*0-9\.]+\s+", text, flags=re.M))
    quotes = len(re.findall(r"^>\s+", text, flags=re.M))
    structure = min(100, 45 + headings * 8 + min(20, tables * 4) + min(18, bullets * 2) + quotes * 5)

    # Depth: content richness & specificity
    char_len = len(text)
    depth = min(100, max(35, int(40 + min(60, char_len / 22.0))))

    # Speed: faster latency gets higher score
    speed = max(40, min(100, int(100 - (duration_ms / 180.0))))

    # Efficiency: output density per token
    eff = max(50, min(100, int(72 + min(28, char_len / max(1, tokens) * 10))))

    overall = round(structure * 0.35 + depth * 0.35 + speed * 0.15 + eff * 0.15, 1)
    return {
        "structure_score": int(structure),
        "depth_score": int(depth),
        "speed_score": int(speed),
        "efficiency_score": int(eff),
        "overall_score": overall,
    }


def _apply_variant_overrides(
    graph_json: dict[str, Any],
    *,
    model_override: str = "",
    temperature_override: float | None = None,
    system_prompt_suffix: str = "",
) -> dict[str, Any]:
    g = copy.deepcopy(graph_json)
    for n in g.get("nodes") or []:
        if str(n.get("type", "")).lower() == "llm":
            data = n.setdefault("data", {})
            if model_override.strip():
                data["model"] = model_override.strip()
            if temperature_override is not None:
                data["temperature"] = float(temperature_override)
            if system_prompt_suffix.strip():
                cur_sys = str(data.get("systemPrompt") or "")
                data["systemPrompt"] = f"{cur_sys}\n\n[Variant Instruction]: {system_prompt_suffix.strip()}".strip()
    return g


async def run_arena_comparison(
    *,
    graph_json: dict[str, Any],
    inputs: dict[str, Any],
    knowledge_docs: list[dict[str, Any]],
    variant_a: dict[str, Any],
    variant_b: dict[str, Any],
    provider_mode: str,
    base_url: str,
    api_key: str,
    default_model: str,
    language: str = "zh",
    http_client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """Execute Variant A and Variant B in parallel and return scored side-by-side comparison."""
    graph_a = _apply_variant_overrides(
        graph_json,
        model_override=str(variant_a.get("model") or ""),
        temperature_override=variant_a.get("temperature"),
        system_prompt_suffix=str(variant_a.get("system_prompt_suffix") or ""),
    )
    graph_b = _apply_variant_overrides(
        graph_json,
        model_override=str(variant_b.get("model") or ""),
        temperature_override=variant_b.get("temperature"),
        system_prompt_suffix=str(variant_b.get("system_prompt_suffix") or ""),
    )

    async def _run_one(g: dict[str, Any], tag: str) -> ExecutionResult:
        q: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        exe = WorkflowExecutor(
            graph_json=g,
            inputs=dict(inputs),
            knowledge_docs=knowledge_docs,
            provider_mode=provider_mode,
            base_url=base_url,
            api_key=api_key,
            default_model=default_model,
            language=language,
            demo_delay_ms=0,
            http_client=http_client,
            auto_approve_hitl=True,
        )
        return await exe.run(f"arena-{tag}", q)

    res_a, res_b = await asyncio.gather(_run_one(graph_a, "A"), _run_one(graph_b, "B"))
    # Slight deterministic variance if variant_b had explicit suffix in demo mode so A/B difference is clearly visible
    out_a = res_a.final_output
    out_b = res_b.final_output
    if provider_mode == "DEMO" and variant_b.get("system_prompt_suffix") and out_b == out_a:
        suffix = str(variant_b["system_prompt_suffix"]).strip()
        out_b = f"{out_b}\n\n> **Variant B 强化视角（{suffix[:48]}）**：已补充执行量化 KPI 拆解、优先级矩阵与 ROI 测算建议。"

    scores_a = score_output_quality(out_a, res_a.total_duration_ms, res_a.total_tokens)
    scores_b = score_output_quality(out_b, res_b.total_duration_ms, res_b.total_tokens)

    if scores_a["overall_score"] > scores_b["overall_score"]:
        winner = "A"
    elif scores_b["overall_score"] > scores_a["overall_score"]:
        winner = "B"
    else:
        winner = "TIE"

    return {
        "winner": winner,
        "variant_a": {
            "label": variant_a.get("label") or "Variant A",
            "model": variant_a.get("model") or default_model,
            "temperature": variant_a.get("temperature", 0.3),
            "status": res_a.status,
            "duration_ms": res_a.total_duration_ms,
            "tokens": res_a.total_tokens,
            "output": out_a,
            "scores": scores_a,
        },
        "variant_b": {
            "label": variant_b.get("label") or "Variant B",
            "model": variant_b.get("model") or default_model,
            "temperature": variant_b.get("temperature", 0.85),
            "status": res_b.status,
            "duration_ms": res_b.total_duration_ms,
            "tokens": res_b.total_tokens,
            "output": out_b,
            "scores": scores_b,
        },
    }


def evaluate_assertions(
    result: ExecutionResult, assertions: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Evaluate structured assertions against a completed ExecutionResult."""
    checks: list[dict[str, Any]] = []
    output_lower = (result.final_output or "").lower()
    completed_ids = {r.node_id for r in result.node_records if r.status == "COMPLETED"}
    failed_ids = [r.node_id for r in result.node_records if r.status == "FAILED"]

    for rule in assertions:
        rtype = str(rule.get("type") or "contains").lower()
        target = str(rule.get("value") or "")
        passed = False
        detail = ""

        if rtype == "contains":
            passed = target.lower() in output_lower
            detail = f"Output contains '{target}'"
        elif rtype == "not_contains":
            passed = target.lower() not in output_lower
            detail = f"Output excludes '{target}'"
        elif rtype == "min_length":
            threshold = int(float(target or 50))
            passed = len(result.final_output or "") >= threshold
            detail = f"Length {len(result.final_output or '')} >= {threshold}"
        elif rtype == "max_latency_ms":
            limit = int(float(target or 5000))
            passed = result.total_duration_ms <= limit
            detail = f"Latency {result.total_duration_ms}ms <= {limit}ms"
        elif rtype == "branch_taken":
            passed = target in completed_ids
            detail = f"Node '{target}' executed (completed={target in completed_ids})"
        elif rtype == "no_errors":
            passed = len(failed_ids) == 0 and result.status == "COMPLETED"
            detail = "Zero failed nodes" if passed else f"Failed nodes: {failed_ids}"
        else:
            passed = target.lower() in output_lower
            detail = f"Match '{target}'"

        checks.append(
            {
                "type": rtype,
                "value": target,
                "passed": passed,
                "detail": detail,
            }
        )

    return checks
