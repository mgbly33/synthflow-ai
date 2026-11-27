from __future__ import annotations

import json
import re
import uuid
from typing import Any

import httpx


def _slug(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:4]}"


def _build_blueprint_from_prompt(prompt: str, language: str = "zh") -> dict[str, Any]:
    """Deterministic high-craft domain architect that synthesizes rich multi-branch DAGs from natural language."""
    text = prompt.strip()
    lower = text.lower()

    # Detect architectural ingredients mentioned in the user's goal
    wants_rag = any(k in lower for k in ("知识库", "文档", "rag", "手册", "规范", "资料", "knowledge", "doc", "sop"))
    wants_http = any(k in lower for k in ("api", "行情", "抓取", "webhook", "外部", "数据", "http", "slack", "crm", "fetch"))
    wants_approval = any(k in lower for k in ("审批", "审核", "人工", "风控", "合规", "放行", "approval", "review", "hitl", "human"))
    wants_loop = any(k in lower for k in ("批量", "多个", "列表", "多语言", "多平台", "batch", "loop", "multi-market"))
    wants_classifier = any(k in lower for k in ("分流", "分类", "路由", "多专家", "客服", "工单", "route", "classify", "triage", "intent"))
    wants_code = any(k in lower for k in ("清洗", "json", "统计", "代码", "提取", "transform", "code", "score", "parse"))

    # Domain detection for tailored prompts & sample inputs
    if any(k in lower for k in ("简历", "面试", "招聘", "hr", "resume", "candidate", "interview")):
        wf_name = "AI 简历智能评估与面试出题流" if language == "zh" else "AI Resume Screening & Interview Copilot"
        category = "hr"
        fields = [
            {"name": "role", "label": "目标招聘岗位", "labelEn": "Target Role", "type": "text", "required": True},
            {"name": "resume_text", "label": "候选人简历摘要", "labelEn": "Candidate Resume", "type": "textarea", "required": True},
        ]
        samples = {
            "role": "高级 AI 全栈架构师",
            "resume_text": "7 年全栈与分布式系统经验，主导过日活 200W SaaS 平台重构，熟悉 Python FastAPI、React、RAG 向量检索与多智能体编排。",
        }
        a_label, b_label = "技术深度评估官", "岗位匹配与面试出题官"
        a_sys = "你是资深技术总监，深度评估候选人架构能力、项目含金量与潜在短板。"
        b_sys = "你是面试官教练，针对简历薄弱点生成 5 道高区分度追问面试题与评分标准。"
        out_title = "候选人综合评估与面试指南"
    elif any(k in lower for k in ("播客", "视频", "脚本", "公众号", "小红书", "内容", "podcast", "video", "content", "social")):
        wf_name = "AI 爆款内容拆解与全渠道分发流" if language == "zh" else "AI Viral Content Repurposing Pipeline"
        category = "marketing"
        fields = [
            {"name": "topic", "label": "核心内容主题", "labelEn": "Content Topic", "type": "text", "required": True},
            {"name": "source_notes", "label": "原始素材 / 逐字稿", "labelEn": "Source Notes / Transcript", "type": "textarea", "required": True},
        ]
        samples = {
            "topic": "2026 企业如何用可视化 Agent 工作流实现 10 倍降本增效",
            "source_notes": "结合私有知识库、条件路由、人工审批门控与 SSE 实时观测，让非技术业务团队也能安全构建生产级 AI 应用。",
        }
        a_label, b_label = "爆款金句与结构提炼师", "多平台传播改写专家"
        a_sys = "提炼核心金句、高钩子开头与结构化干货大纲。"
        b_sys = "将素材同步改编为小红书笔记、公众号推文与 X 推文串。"
        out_title = "全渠道宣发内容包"
    elif any(k in lower for k in ("流失", "客户", "续费", "churn", "saas", "crm", "sales", "线索")):
        wf_name = "SaaS 客户流失预警与挽留自动化流" if language == "zh" else "SaaS Churn Risk & Automated Retention Flow"
        category = "sales"
        fields = [
            {"name": "company", "label": "客户企业名称", "labelEn": "Account Name", "type": "text", "required": True},
            {"name": "signals", "label": "近期活跃与工单信号", "labelEn": "Usage & Ticket Signals", "type": "textarea", "required": True},
        ]
        samples = {
            "company": "星云智造科技有限公司",
            "signals": "近 14 天 API 调用量下降 48%，关键管理员提交了 2 次关于价格与性能的紧急工单，距离续费仅剩 21 天。",
        }
        a_label, b_label = "流失根因诊断专家", "专属挽留与权益方案师"
        a_sys = "根据活跃度与工单信号量化评估客户流失风险等级与核心根因。"
        b_sys = "设计个性化高层拜访话术、技术护航方案与续费激励策略。"
        out_title = "大客户流失挽留行动案"
    else:
        short_title = re.sub(r"[，。！？,.!?\n]+", " ", text).strip()[:22]
        wf_name = f"AI {short_title}工作流" if language == "zh" else f"AI {short_title} Workflow"
        category = "custom"
        fields = [
            {"name": "topic", "label": "核心任务主题", "labelEn": "Task Topic", "type": "text", "required": True},
            {"name": "context", "label": "背景资料与目标要求", "labelEn": "Context & Goals", "type": "textarea", "required": True},
        ]
        samples = {
            "topic": text[:50] or "企业级 AI 自动化方案",
            "context": f"目标：{text}。请输出结构化、可直接落地的专业分析与行动计划。",
        }
        a_label, b_label = "深度策略分析智能体", "风险校验与落地规划师"
        a_sys = f"你是该领域首席专家，围绕「{text[:60]}」展开结构化深度分析与方案设计。"
        b_sys = f"你是严苛的评审专家，针对「{text[:60]}」识别潜在风险、边界条件并补充量化落地里程碑。"
        out_title = f"{short_title} · 交付报告"

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []

    in_id = _slug("input")
    nodes.append(
        {
            "id": in_id,
            "type": "input",
            "position": {"x": 40, "y": 210},
            "data": {
                "label": "业务参数输入",
                "labelEn": "Workflow Input",
                "fields": fields,
                "sampleInputs": samples,
            },
        }
    )

    col_x = 380
    upstream_for_agents = [in_id]

    # Optional enrichment wave (Knowledge / HTTP / Code)
    enrichment_nodes: list[str] = []
    if wants_rag or not wants_http:
        kb_id = _slug("kb")
        nodes.append(
            {
                "id": kb_id,
                "type": "knowledge",
                "position": {"x": col_x, "y": 90 if wants_http else 210},
                "data": {
                    "label": "企业知识库召回",
                    "labelEn": "Enterprise RAG",
                    "queryTemplate": "{{input}}",
                    "topK": 3,
                    "docIds": [],
                },
            }
        )
        edges.append({"id": _slug("e"), "source": in_id, "target": kb_id, "type": "glow"})
        enrichment_nodes.append(kb_id)

    if wants_http:
        http_id = _slug("http")
        nodes.append(
            {
                "id": http_id,
                "type": "http",
                "position": {"x": col_x, "y": 330 if enrichment_nodes else 210},
                "data": {
                    "label": "外部数据 API 拉取",
                    "labelEn": "External API Tool",
                    "method": "GET",
                    "url": "https://api.enterprise.example.com/v1/context-signals",
                    "sandboxMode": True,
                },
            }
        )
        edges.append({"id": _slug("e"), "source": in_id, "target": http_id, "type": "glow"})
        enrichment_nodes.append(http_id)

    if enrichment_nodes:
        upstream_for_agents = enrichment_nodes
        col_x += 360

    # Core Reasoning Wave: either Classifier 3-way OR Parallel Specialist LLMs (+ optional Loop)
    branch_outputs: list[str] = []
    if wants_classifier:
        cls_id = _slug("cls")
        nodes.append(
            {
                "id": cls_id,
                "type": "classifier",
                "position": {"x": col_x, "y": 210},
                "data": {
                    "label": "智能意图路由分类器",
                    "labelEn": "Intent Classifier",
                    "sourceTemplate": "{{input}}",
                    "categories": [
                        {"id": "high_priority", "label": "高优紧急", "keywords": "紧急,故障,流失,退款,高风险,urgent"},
                        {"id": "standard", "label": "标准业务", "keywords": "方案,咨询,分析,评估,报价,plan"},
                    ],
                },
            }
        )
        for u in upstream_for_agents:
            edges.append({"id": _slug("e"), "source": u, "target": cls_id, "type": "glow"})
        col_x += 370

        llm_a = _slug("llm")
        llm_b = _slug("llm")
        nodes.append(
            {
                "id": llm_a,
                "type": "llm",
                "position": {"x": col_x, "y": 80},
                "data": {
                    "label": f"{a_label}（高优通道）",
                    "labelEn": "Priority Specialist",
                    "role": "competitor_risks",
                    "model": "deepseek-chat",
                    "temperature": 0.4,
                    "systemPrompt": a_sys,
                    "userPrompt": "上下文输入：\n{{input}}",
                },
            }
        )
        nodes.append(
            {
                "id": llm_b,
                "type": "llm",
                "position": {"x": col_x, "y": 340},
                "data": {
                    "label": f"{b_label}（标准通道）",
                    "labelEn": "Standard Specialist",
                    "role": "competitor_strengths",
                    "model": "deepseek-chat",
                    "temperature": 0.5,
                    "systemPrompt": b_sys,
                    "userPrompt": "上下文输入：\n{{input}}",
                },
            }
        )
        edges.append({"id": _slug("e"), "source": cls_id, "sourceHandle": "high_priority", "target": llm_a, "type": "glow", "label": "高优紧急"})
        edges.append({"id": _slug("e"), "source": cls_id, "sourceHandle": "standard", "target": llm_b, "type": "glow", "label": "标准业务"})
        branch_outputs = [llm_a, llm_b]
    else:
        llm_a = _slug("llm")
        llm_b = _slug("llm")
        kb_ref = f"\n\n【参考上下文】\n{{{{{upstream_for_agents[0]}.output}}}}" if upstream_for_agents[0] != in_id else ""
        nodes.append(
            {
                "id": llm_a,
                "type": "llm",
                "position": {"x": col_x, "y": 70},
                "data": {
                    "label": a_label,
                    "labelEn": "Primary Analyst Agent",
                    "role": "competitor_strengths",
                    "model": "deepseek-chat",
                    "temperature": 0.5,
                    "systemPrompt": a_sys,
                    "userPrompt": f"请分析以下输入：\n{{{{input}}}}{kb_ref}",
                },
            }
        )
        nodes.append(
            {
                "id": llm_b,
                "type": "llm",
                "position": {"x": col_x, "y": 350},
                "data": {
                    "label": b_label,
                    "labelEn": "Critic & Risk Agent",
                    "role": "competitor_risks",
                    "model": "deepseek-chat",
                    "temperature": 0.5,
                    "systemPrompt": b_sys,
                    "userPrompt": f"请从风险与落地角度补充审查：\n{{{{input}}}}{kb_ref}",
                },
            }
        )
        for u in upstream_for_agents:
            edges.append({"id": _slug("e"), "source": u, "target": llm_a, "type": "glow"})
            edges.append({"id": _slug("e"), "source": u, "target": llm_b, "type": "glow"})
        branch_outputs = [llm_a, llm_b]

        if wants_loop:
            lp_id = _slug("loop")
            nodes.append(
                {
                    "id": lp_id,
                    "type": "loop",
                    "position": {"x": col_x, "y": 560},
                    "data": {
                        "label": "批量多维衍生器",
                        "labelEn": "Batch Iterator",
                        "sourceTemplate": "执行摘要,核心亮点,行动清单",
                        "delimiter": ",",
                        "itemTemplate": "#### 模块 #{{index}} · {{item}}\n基于输入自动生成的结构化模块内容。",
                    },
                }
            )
            edges.append({"id": _slug("e"), "source": upstream_for_agents[0], "target": lp_id, "type": "glow"})
            branch_outputs.append(lp_id)

    col_x += 360

    # Aggregator node to merge parallel / routed branches
    agg_id = _slug("agg")
    nodes.append(
        {
            "id": agg_id,
            "type": "aggregator",
            "position": {"x": col_x, "y": 210},
            "data": {
                "label": "多路结果汇聚器",
                "labelEn": "Branch Aggregator",
                "strategy": "first_non_empty" if wants_classifier else "markdown_merge",
                "separator": "\n\n---\n\n",
            },
        }
    )
    for b_id in branch_outputs:
        edges.append({"id": _slug("e"), "source": b_id, "target": agg_id, "type": "glow"})
    last_id = agg_id
    col_x += 340

    if wants_code:
        code_id = _slug("code")
        nodes.append(
            {
                "id": code_id,
                "type": "code",
                "position": {"x": col_x, "y": 210},
                "data": {
                    "label": "结构化指标清洗",
                    "labelEn": "Code Formatter",
                    "transformMode": "markdown_summary",
                    "sourceTemplate": f"{{{{{last_id}.output}}}}",
                },
            }
        )
        edges.append({"id": _slug("e"), "source": last_id, "target": code_id, "type": "glow"})
        last_id = code_id
        col_x += 340

    if wants_approval:
        ap_id = _slug("approval")
        nodes.append(
            {
                "id": ap_id,
                "type": "approval",
                "position": {"x": col_x, "y": 210},
                "data": {
                    "label": "人工复核审批门控",
                    "labelEn": "Human Approval Gate",
                    "sourceTemplate": f"{{{{{last_id}.output}}}}",
                    "instructions": "请确认上游 AI 产出内容合规无误，可在线微调后点击放行继续执行。",
                },
            }
        )
        edges.append({"id": _slug("e"), "source": last_id, "target": ap_id, "type": "glow"})
        last_id = ap_id
        col_x += 340

    # Final Synthesis / Output
    out_id = _slug("output")
    nodes.append(
        {
            "id": out_id,
            "type": "output",
            "position": {"x": col_x, "y": 210},
            "data": {
                "label": "高管级成品输出",
                "labelEn": "Executive Output",
                "title": out_title,
                "template": f"# {out_title}\n\n{{{{{last_id}.output}}}}",
                "format": "markdown",
            },
        }
    )
    edges.append({"id": _slug("e"), "source": last_id, "target": out_id, "type": "glow"})

    # Add an architectural sticky note explaining the generated pipeline
    nodes.append(
        {
            "id": _slug("note"),
            "type": "note",
            "position": {"x": 40, "y": 30},
            "data": {
                "label": "AI 架构师设计说明",
                "content": f"由 SynthFlow Copilot 根据需求「{text[:45]}」自动编排，共 {len(nodes)} 个可执行节点，支持直接一键运行。",
                "color": "violet",
            },
        }
    )

    rationale = (
        f"已根据您的业务目标自动编排 {len(nodes) - 1} 个可执行节点与 {len(edges)} 条数据连线，"
        f"包含{'企业 RAG 知识召回、' if any(n['type']=='knowledge' for n in nodes) else ''}"
        f"{'外部 HTTPS 工具、' if wants_http else ''}"
        f"{'多路意图路由、' if wants_classifier else '多智能体并行分析、'}"
        f"{'人工审批门控、' if wants_approval else ''}多路聚合与 Markdown 报告输出。"
    )

    return {
        "name": wf_name,
        "description": f"AI Copilot 自动构建：{text[:120]}",
        "category": category,
        "rationale": rationale,
        "graph_json": {"nodes": nodes, "edges": edges},
    }


async def generate_workflow_with_copilot(
    *,
    prompt: str,
    language: str = "zh",
    provider_mode: str = "DEMO",
    base_url: str = "",
    api_key: str = "",
    model: str = "deepseek-chat",
) -> dict[str, Any]:
    """Generate a valid SynthFlow DAG from natural language using Demo Architect or Live OpenAI LLM."""
    baseline = _build_blueprint_from_prompt(prompt, language=language)
    if provider_mode != "OPENAI_COMPAT" or not base_url.strip():
        return baseline

    # Attempt real LLM enrichment of node labels & prompts while guaranteeing valid DAG structure
    endpoint = base_url.rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint = f"{endpoint}/chat/completions"

    sys_msg = (
        "You are SynthFlow AI Workflow Architect. Given a user goal, return ONLY valid JSON with keys: "
        '"name" (string), "description" (string), "rationale" (string), and "agent_prompts" (list of 2 objects with "label", "systemPrompt", "userPrompt").'
    )
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                endpoint,
                headers=headers,
                json={
                    "model": model or "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": sys_msg},
                        {"role": "user", "content": f"Goal ({language}): {prompt}"},
                    ],
                    "temperature": 0.4,
                },
            )
            if resp.status_code < 400:
                raw = resp.json()["choices"][0]["message"]["content"]
                match = re.search(r"\{[\s\S]*\}", raw)
                if match:
                    enriched = json.loads(match.group(0))
                    if enriched.get("name"):
                        baseline["name"] = str(enriched["name"])[:120]
                    if enriched.get("description"):
                        baseline["description"] = str(enriched["description"])[:280]
                    if enriched.get("rationale"):
                        baseline["rationale"] = str(enriched["rationale"])
                    llm_nodes = [n for n in baseline["graph_json"]["nodes"] if n["type"] == "llm"]
                    for node, spec in zip(llm_nodes, enriched.get("agent_prompts") or []):
                        if isinstance(spec, dict):
                            if spec.get("label"):
                                node["data"]["label"] = str(spec["label"])[:60]
                            if spec.get("systemPrompt"):
                                node["data"]["systemPrompt"] = str(spec["systemPrompt"])
    except Exception:
        pass  # Gracefully fall back to deterministic high-craft blueprint

    return baseline


def optimize_workflow_graph(graph_json: dict[str, Any]) -> dict[str, Any]:
    """Analyze a workflow DAG and auto-inject a Quality Assurance & Fact-Check Critic node before Output."""
    nodes = json.loads(json.dumps(graph_json.get("nodes") or []))
    edges = json.loads(json.dumps(graph_json.get("edges") or []))
    suggestions: list[str] = []

    out_node = next((n for n in nodes if n.get("type") == "output"), None)
    has_critic = any("质检" in str(n.get("data", {}).get("label", "")) or "Critic" in str(n.get("data", {}).get("labelEn", "")) for n in nodes)

    if out_node and not has_critic:
        incoming = [e for e in edges if e.get("target") == out_node["id"]]
        if incoming:
            critic_id = _slug("critic")
            out_x = float(out_node.get("position", {}).get("x", 1000))
            out_y = float(out_node.get("position", {}).get("y", 200))
            upstream_refs = "\n\n".join(f"{{{{{e['source']}.output}}}}" for e in incoming)

            critic_node = {
                "id": critic_id,
                "type": "llm",
                "position": {"x": out_x, "y": out_y},
                "data": {
                    "label": "AI 质量复核与事实质检官",
                    "labelEn": "QA & Fact-Check Critic",
                    "role": "executive_report",
                    "model": "deepseek-chat",
                    "temperature": 0.25,
                    "systemPrompt": "你是严格的质量审校官，负责检查上游输出的逻辑一致性、数据严谨性与排版可读性，输出精炼升华后的终稿。",
                    "userPrompt": f"请复核并润色以下上游产出，消除冗余并补全关键结论：\n\n{upstream_refs}",
                },
            }
            out_node["position"] = {"x": out_x + 360, "y": out_y}
            out_node["data"]["template"] = f"{{{{{critic_id}.output}}}}"
            nodes.append(critic_node)

            # Rewire incoming edges -> critic -> output
            for e in incoming:
                e["target"] = critic_id
            edges.append({"id": _slug("e"), "source": critic_id, "target": out_node["id"], "type": "glow"})
            suggestions.append("已自动在终态输出前注入「AI 质量复核与事实质检官」节点，提升交付稳定性与严谨度。")
    else:
        suggestions.append("当前工作流已包含完整质检链路或无需额外注入，拓扑结构处于最优状态。")

    if not any(n.get("type") == "knowledge" for n in nodes):
        suggestions.append("建议：可按需挂载 Knowledge RAG 节点，为智能体注入企业私有规范与历史案例。")

    return {
        "suggestions": suggestions,
        "graph_json": {"nodes": nodes, "edges": edges},
    }
