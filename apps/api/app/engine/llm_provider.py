from __future__ import annotations

import asyncio
import json
import re
from collections.abc import AsyncGenerator
from typing import Any

import httpx


def estimate_tokens(text: str) -> int:
    """Rough bilingual token estimator (~1.5 chars/token for CJK, ~4 chars/token for ASCII)."""
    if not text:
        return 0
    cjk_count = len(re.findall(r"[\u4e00-\u9fff]", text))
    other_count = max(0, len(text) - cjk_count)
    return max(1, int(cjk_count * 0.85 + other_count / 3.8))


def _extract_subject(inputs: dict[str, Any], user_prompt: str, fallback: str = "目标业务") -> str:
    for key in ("company", "target", "product", "topic", "brand", "subject", "title"):
        val = inputs.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()[:80]
    for val in inputs.values():
        if isinstance(val, str) and val.strip():
            first_line = val.strip().splitlines()[0]
            return first_line[:60]
    if user_prompt.strip():
        return user_prompt.strip().splitlines()[0][:60]
    return fallback


def _build_demo_markdown(
    role: str,
    node_label: str,
    system_prompt: str,
    user_prompt: str,
    inputs: dict[str, Any],
    language: str = "zh",
) -> str:
    """Generate high-craft, context-aware realistic domain Markdown for zero-key Demo mode."""
    subject = _extract_subject(inputs, user_prompt, "SynthFlow Target" if language == "en" else "目标产品")
    industry = str(inputs.get("industry") or inputs.get("market") or ("AI SaaS" if language == "en" else "企业级 AI SaaS")).strip()
    audience = str(inputs.get("audience") or inputs.get("target_audience") or ("Tech decision-makers & product leaders" if language == "en" else "B端技术决策者与增长负责人")).strip()
    selling_points = str(inputs.get("selling_points") or inputs.get("features") or subject).strip()
    contract_text = str(inputs.get("contract_text") or user_prompt).strip()
    ticket_text = str(inputs.get("ticket_content") or inputs.get("message") or user_prompt).strip()
    customer_name = str(inputs.get("customer_name") or ("Alex Chen" if language == "en" else "陈女士/先生")).strip()

    role_norm = (role or "general").lower()

    # 1. Competitor Strengths & Moat
    if role_norm == "competitor_strengths":
        if language == "en":
            return f"""### Core Competitive Moat & Strategic Strengths — {subject}

#### 1. Product Architecture & Ecosystem Lock-in
- **Workflow Depth in {industry}**: `{subject}` has established strong multi-step orchestration primitives with low migration elasticity once enterprise teams embed custom playbooks.
- **Time-to-Value**: Pre-packaged templates compress onboarding from weeks to under 30 minutes, driving strong bottom-up PLG adoption among `{audience}`.

#### 2. Commercialization & Distribution
| Dimension | Benchmark Signal | Strategic Implication |
| :--- | :--- | :--- |
| Pricing Tiering | Seat + usage hybrid | Captures expansion revenue on high-volume automation |
| Developer Ecosystem | Marketplace plugins & webhooks | Creates a secondary flywheel of community integrations |
| Enterprise Readiness | SSO, RBAC, audit trails | Shortens InfoSec procurement cycles in mid-market |

#### 3. Key Takeaway
To outmaneuver `{subject}`, differentiation should avoid feature parity and focus on **deployment agility (private/VPC), cost transparency, and visual observability**.
"""
        return f"""### 核心壁垒与产品优势拆解 — {subject}

#### 一、产品力与技术护城河
- **场景闭环能力（{industry}）**：`{subject}` 在核心业务链路中已形成较高粘性的工作流沉淀，客户一旦完成 SOP 迁移，替换成本显著上升。
- **冷启动体验极佳**：通过开箱即用的行业模板与可视化配置，将 `{audience}` 的首次价值感知（TTV）压缩至 15 分钟以内，具备较强的 PLG 裂变势能。

#### 二、商业化与生态势能矩阵
| 评估维度 | 当前表现 | 战略启示 |
| :--- | :--- | :--- |
| 定价模型 | 席位费 + 用量阶梯混合制 | 随团队自动化规模增长自然产生 Net Dollar Retention 扩张 |
| 生态集成 | 丰富 Webhook / 第三方连接器 | 借力生态伙伴降低了长尾定制开发压力 |
| 交付门槛 | 云端 SaaS 一键开通 | 中小客群转化快，但对私有化大客户存在适配空白 |

#### 三、优势总结
`{subject}` 的核心壁垒在于**先发心智与生态连接密度**；正面硬拼通用功能性价比不高，建议从「私有化安全可控」「流式可观测性」与「垂直行业深度交付」实现错位超越。
"""

    # 2. Competitor Risks & Vulnerabilities
    if role_norm == "competitor_risks":
        if language == "en":
            return f"""### Strategic Vulnerabilities & Counter-Attack Angles — {subject}

#### 1. Product & Engineering Friction
- **Opaque Cost & Latency Spikes**: Heavy multi-agent chains frequently trigger unpredictable token bills and silent timeouts without granular per-node waterfall traces.
- **Rigid Extensibility**: Enterprise engineering teams report friction when injecting custom Python logic, SSRF-hardened internal connectors, or local open-weight models (Ollama/vLLM).

#### 2. Market & Compliance Exposure
1. **Data Sovereignty**: Regulated buyers in finance, healthcare, and legal hesitate to route sensitive documents exclusively through multi-tenant cloud endpoints.
2. **Vendor Lock-in Backlash**: Proprietary workflow schemas make GitOps versioning and CI/CD regression testing difficult.

#### 3. High-Leverage Attack Vectors
- **BYOK + Encrypted Credential Vault**: Let customers bring DeepSeek, Qwen, OpenAI, or self-hosted endpoints with zero markup.
- **Observable DAG Execution**: Deliver millisecond-level trace waterfalls and deterministic dry-run previews out of the box.
"""
        return f"""### 潜在短板、风险敞口与反超机会 — {subject}

#### 一、产品与工程体验痛点
- **黑盒成本与排障困难**：复杂多 Agent 编排缺乏逐节点耗时瀑布流与 Token 细粒度归因，一旦链路报错或响应变慢，业务团队难以快速定位根因。
- **私有模型与二次开发受限**：面对 `{industry}` 客户接入 DeepSeek / 通义千问 / 本地 Ollama 及内部私有 API 的刚需，现有方案存在较高改造成本与安全合规顾虑。

#### 二、商业与合规脆弱点
1. **数据主权与合规红线**：金融、法务、政务等高客单价客户普遍要求源码可控、密钥加密落盘以及严格的出网 SSRF 防护。
2. **模板同质化严重**：通用演示效果偏“玩具化”，缺乏真正贴合企业业务流程的深度交付样板。

#### 三、差异化切入破局点
- **双引擎交付策略**：提供「零门槛免 Key 体验 + BYOK 真实多模型无缝切换」，既能极大缩短售前 Demo 转化周期，又能满足生产级降本需求。
- **全链路 Trace 回放**：以工程级可观测性直接击穿大客户对 AI 系统“不可控、难审计”的核心担忧。
"""

    # 3. Executive Synthesis Report
    if role_norm == "executive_report":
        if language == "en":
            return f"""# Executive Competitive Intelligence Brief: {subject}

> **Sector**: {industry} | **Target Audience**: {audience} | **Synthesis Confidence**: High

## 1. Executive Verdict
`{subject}` commands strong mindshare in `{industry}` through template-driven onboarding and ecosystem breadth. However, mounting enterprise scrutiny over **data sovereignty, token cost governance, and execution observability** opens a decisive strategic window for a lightweight, transparent, self-hostable AI workflow platform.

## 2. Strategic Comparison Matrix
| Capability Pillar | {subject} (Incumbent) | Recommended Counter-Positioning |
| :--- | :--- | :--- |
| **Deployment & Privacy** | Cloud-first, multi-tenant | Zero-config local/VPC Docker deploy + Fernet encrypted BYOK |
| **Execution Observability** | Basic run logs | Real-time SSE token streaming + per-node waterfall trace replay |
| **Model Economics** | Bundled margin markup | OpenAI-compatible routing (DeepSeek, Qwen, OpenAI, Ollama) |
| **Workflow Governance** | Proprietary UI lock-in | Portable JSON DAG import/export + automated cycle/SSRF guards |

## 3. 90-Day Action Plan
1. **Days 1–30 (Beachhead Demos)**: Package 4 turnkey vertical templates (Research, Marketing, Legal Review, Ticket Triage) for instant zero-key client walkthroughs.
2. **Days 31–60 (Enterprise Proof)**: Highlight encrypted credential storage, SSRF protection, and audit-ready execution traces during technical discovery calls.
3. **Days 61–90 (Land & Expand)**: Convert pilot workshops into bespoke RAG + multi-agent delivery contracts with 3x higher ACV.
"""
        return f"""# {subject} · 高管级商业竞品深度研报

> **所属赛道**：{industry} ｜ **核心受众**：{audience} ｜ **报告生成模式**：多智能体并行研判汇总

## 一、核心战略结论（Executive Summary）
综合并行优势拆解与风险诊断结果，`{subject}` 凭借成熟的模板生态与先发品牌在 `{industry}` 占据了主流心智。但在企业级深化落地阶段，**数据隐私合规、模型调用成本黑盒、多节点排障缺乏可观测性**已成为其最明显的三大软肋。这为我们以「轻量专业、私有可控、实时可观测」为核心定位切入中高客单价市场提供了清晰的战略窗口。

## 二、攻防态势核心对比矩阵
| 核心维度 | {subject}（标杆竞品） | 我方差异化反超策略 |
| :--- | :--- | :--- |
| **部署与数据安全** | 公有云多租户为主，隐私顾虑高 | Docker 一键私有化 + Fernet 密钥加密 + SSRF 出网防护 |
| **执行可观测性** | 仅展示最终结果，调试黑盒 | 逐节点 SSE 实时推流 + 毫秒级 Trace 耗时瀑布流回放 |
| **模型成本治理** | 绑定套餐溢价高 | 兼容 OpenAI 协议（DeepSeek / Qwen / Ollama 自由路由） |
| **商业售前转化** | 需注册配 Key 才能试用 | 内置高拟真免 Key 演练场 + 行业模板库，打开即震撼 |

## 三、未来 90 天落地执行路线图
1. **第 1–30 天（样板间打造）**：聚焦高 ROI 场景（竞品研报、营销工坊、合同审查、智能工单），打造可视化交互 Demo，将客户首聊转化率提升至行业 2 倍以上。
2. **第 31–60 天（标杆交付）**：主打「RAG 知识库 + 条件路由 + 人工复核」混合编排，承接企业定制 AI 应用开发订单。
3. **第 61–90 天（复购扩张）**：基于可复用的 JSON 工作流资产库，为已签约客户快速拓展跨部门自动化场景，实现高毛利持续交付。
"""

    # 4. Xiaohongshu Copy
    if role_norm == "xiaohongshu_copy":
        if language == "en":
            return f"""### Social Discovery Post (Lifestyle / Xiaohongshu Style)

**Title**: Stop wasting 3 hours a day on manual work! ✨ Why everyone is switching to `{subject}`

Hey everyone! 👋 Just tested `{subject}` with our team for a full week and honestly, I can't go back.

**What actually blew me away:**
- ⚡ **Zero learning curve**: {selling_points}
- 🎯 **Built for {audience}**: Clean workflow, zero clutter, results look agency-ready in seconds.
- 💡 **Real productivity boost**: Cut our weekly prep time by **70%** without hiring extra headcount.

Drop a comment **"WORKFLOW"** if you want our exact setup checklist! 👇
#AIWorkflow #ProductivityHacks #SaaSTools #SmartWork
"""
        return f"""### 小红书爆款种草笔记

**标题**：打工人救星！用「{subject}」把 3 小时的活压缩到 5 分钟✨

姐妹们/各位效率控！真的不是夸张，最近团队全员切到 **{subject}** 之后，每天准点下班的快乐谁懂啊！！😭

**实测最戳我的 3 个神仙亮点：**
1. 🔥 **直击痛点**：{selling_points}
2. 🎨 **专为 {audience} 打磨**：界面高级到像精密工作室，完全没有传统软件那种臃肿感，新手 3 分钟直接上手！
3. 📈 **效率翻倍肉眼可见**：以前反复对齐半天的交付物，现在一键跑通、结果直接能发给老板和客户，质量稳得离谱！

💡 **避坑小贴士**：强烈建议先套用里面的行业模板跑一遍，再微调成自己的专属流程，效率直接起飞～

想要同款配置清单的宝子，评论区扣 **【效率起飞】** 我踢你！👇
`#AI提效神器` `#职场生产力` `#宝藏工具分享` `#自动化工作流`
"""

    # 5. WeChat Long-Form Article
    if role_norm == "wechat_article":
        if language == "en":
            return f"""### Long-Form Editorial Draft — {subject}

#### Title: Reimagining Execution: How `{subject}` Unlocks 10x Leverage for `{audience}`

In an era where tooling fatigue slows down even the sharpest teams, the winners aren't those who adopt the most apps—they are the teams that unify intelligence into repeatable systems.

**Why Traditional Approaches Stall**
Most teams still glue together fragmented prompts, static spreadsheets, and ad-hoc docs. Context gets lost between handoffs, and quality fluctuates wildly across team members.

**Enter `{subject}`**
Built around `{selling_points}`, `{subject}` turns tribal expertise into structured, auditable execution pipelines. Every step—from brand-guideline retrieval to parallel multi-channel drafting—runs transparently and consistently.

> *“True automation doesn't replace human judgment; it eliminates repetitive friction so creators can focus on strategy.”*

**Call to Action**: Try the live interactive sandbox today and experience end-to-end orchestration in under 60 seconds.
"""
        return f"""### 微信公众号深度推文

#### 标题：深度拆解｜为什么顶尖团队都在用「{subject}」重构工作流？

**导语**：当行业内卷从“拼人力”进入“拼系统效率”的下半场，真正拉开差距的从来不是多招几个人，而是能否把核心方法论沉淀为可复用的智能流水线。

---

#### 一、传统协作模式的隐性成本
对于 `{audience}` 而言，日常工作中最耗神的往往不是创意本身，而是反复检索资料、对齐品牌规范、以及跨平台改写带来的碎片化损耗。经验散落在个人电脑里，团队新人很难快速复刻标杆产出。

#### 二、{subject} 如何给出更优解？
围绕 **{selling_points}** 这一核心价值，`{subject}` 将“知识库检索 + 智能体推理 + 规范化输出”融为一体：
- **调性高度一致**：自动挂载企业知识库，确保每一份对外产出都精准契合品牌声量；
- **并行提效显著**：一次输入同步驱动多维度分析与多渠道分发，彻底告别重复搬运；
- **全过程透明可控**：每一步思考依据与耗时清晰可见，让业务负责人真正敢用、放心用。

> **结语**：工具的终极意义，是把人从机械重复中解放出来，把时间留给更具创造力的战略判断。点击文末「阅读原文」，立即免费体验 `{subject}` 在线演练场。
"""

    # 6. X / Twitter Thread
    if role_norm == "twitter_thread":
        return f"""### X / Twitter 高互动推文串（Thread）

**1/4 🧵** Most teams think they have a content or execution bottleneck. What they actually have is a workflow fragmentation problem. Here is how **{subject}** fixes it in 60 seconds 👇

**2/4 ⚡** Instead of copy-pasting prompts across 5 tabs, `{subject}` combines:
- Live brand knowledge retrieval
- Parallel specialist AI agents
- Structured, publish-ready outputs
Core edge: _{selling_points}_

**3/4 📊** Built specifically for **{audience}**, teams report cutting production cycle time by 65%+ while keeping tone and accuracy locked to internal playbooks.

**4/4 🚀** Want to see it run live with zero API key setup? Try the interactive studio and clone the workflow JSON straight into your stack. RT & bookmark for later!
"""

    # 7. Contract Clause Extractor
    if role_norm == "contract_extract":
        risk_keywords = [
            "无限连带", "单方解除", "违约金", "赔偿全部", "排他", "不可撤销", "自动续约", "知识产权归甲方所有",
            "unlimited", "indemnify", "sole discretion", "terminate without cause", "penalty", "exclusive", "non-compete",
        ]
        found = [kw for kw in risk_keywords if kw.lower() in contract_text.lower()]
        risk_level = "HIGH_RISK（高风险）" if found else "LOW_RISK（常规低风险）"
        matched_str = "、".join(found) if found else ("无明显极端失衡条款" if language == "zh" else "No severe asymmetric clauses detected")

        if language == "en":
            return f"""### Automated Contract Clause Extraction & Risk Signal Scan

- **Overall Risk Classification**: `{risk_level}`
- **Triggered Risk Signals**: {matched_str}

#### Key Extracted Clauses
1. **Liability & Indemnification**: Evaluated cap structure, indirect damages, and indemnity breadth.
2. **Termination & Renewal**: Checked notice window, unilateral termination rights, and auto-renewal traps.
3. **IP Ownership & Confidentiality**: Verified background IP retention vs. custom deliverable transfer.
4. **Payment & Penalty Terms**: Assessed milestone acceptance criteria and liquidated damages proportionality.

> **Routing Signal**: `{"HIGH_RISK" if found else "STANDARD_OK"}`
"""
        return f"""### 合同核心条款结构化提取与风险初筛

- **综合风险评级**：`{risk_level}`
- **命中高危触发词**：{matched_str}

#### 已提取核心条款摘要
1. **责任上限与赔偿机制**：已扫描违约金比例、间接损失承担及连带责任范围。
2. **解除权与续约条款**：已核查单方无因解除权、提前通知期及自动续期约束。
3. **知识产权归属**：已比对既有背景知识产权（Background IP）与项目定制成果权属边界。
4. **付款周期与验收标准**：已检视验收默示条款与逾期付款违约条款的对等性。

> **路由判定标记**：`{"HIGH_RISK" if found else "STANDARD_OK"}`
"""

    # 8. Contract High Risk Redline
    if role_norm == "contract_high_risk":
        if language == "en":
            return """### 🔴 High-Risk Legal Redline & Negotiation Playbook

> **Alert Status**: 🔴 **ESCALATED — Legal Redline Required Before Signature**

| Risk Level | Clause Area | Identified Exposure | Recommended Redline Wording |
| :--- | :--- | :--- | :--- |
| 🔴 **Critical** | Liability / Indemnity | Uncapped or asymmetric liability creates existential exposure | *"Aggregate liability under this Agreement shall not exceed fees paid in the preceding 12 months."* |
| 🟠 **High** | Unilateral Termination | Counterparty can exit without cause or wind-down compensation | *"Termination for convenience requires 30 days' prior written notice and full payment for delivered milestones."* |
| 🟡 **Medium** | IP / Exclusivity | Overbroad IP assignment could cover reusable pre-existing frameworks | *"Vendor retains all pre-existing tools, frameworks, and libraries; Client receives exclusive rights to bespoke deliverables."* |

#### Negotiation Next Steps
1. Reject uncapped indemnity immediately and propose a 1x annual fee cap.
2. Insert a 15-business-day deemed acceptance clause to prevent payment stalls.
"""
        return """### 🔴 高风险合同红黄绿分级预警与修订建议

> **审查结论**：🔴 **高风险拦截 —— 建议完成法务红线修订后再行签署**

| 风险等级 | 涉及条款 | 潜在商业与法律敞口 | 建议修改替换文本（可直接复用） |
| :--- | :--- | :--- | :--- |
| 🔴 **红灯·高危** | 违约赔偿与责任上限 | 存在无限连带责任或过高违约金，单次事故可能击穿项目利润 | *“除故意或重大过失外，乙方在本合同项下的累计赔偿责任总额不超过过去 12 个月内已实际收取的服务费用总额。”* |
| 🟠 **黄灯·警戒** | 单方解除与验收条款 | 对方可单方随时解约且无已完成工作量结算保障 | *“任何一方无因提前解除合同应提前 30 日书面通知，并按实际已完成里程碑结清对应费用。”* |
| 🟢 **绿灯·优化** | 知识产权边界 | 需明确区分通用底层框架与客户专属定制代码 | *“乙方保留既有通用技术框架及工具库的知识产权，甲方享有本项目专属定制交付物的完整使用权/著作权。”* |

#### 商务谈判推进建议
1. **底线坚守**：必须为赔偿金额封顶，并剔除“单方无责解除”条款。
2. **付款保护**：建议补充「交付后 10 个工作日内未书面提出异议即视为验收通过」的默示验收机制。
"""

    # 9. Contract Low Risk Clearance
    if role_norm == "contract_low_risk":
        if language == "en":
            return """### 🟢 Standard Compliance Clearance Report

> **Review Verdict**: 🟢 **LOW RISK — Cleared for Business Approval**

- **Liability & Remedies**: Balanced mutual obligations with no uncapped indemnity flags detected.
- **Termination & Notice**: Standard reciprocal notice period observed.
- **Commercial Readiness**: Safe to proceed with minor housekeeping checks (verify entity legal name, tax ID, and invoice schedule before countersigning).
"""
        return """### 🟢 常规合规审查放行报告

> **审查结论**：🟢 **整体风险可控 —— 可直接进入商务用印流程**

- **权责对等性**：未检出无限连带赔偿、霸王单方解除或明显失衡的高额违约金条款。
- **知识产权与保密**：核心保密义务与成果权属表述相对规范。
- **签前常规核对清单**：
  1. 确认双方主体全称、统一社会信用代码与开票信息准确无误；
  2. 核对附件报价单金额大小写一致及收款账户信息；
  3. 留存电子签章或骑缝章归档副本。
"""

    # 10. Ticket Triage & Sentiment Classifier
    if role_norm == "ticket_triage":
        tech_triggers = [
            "500", "502", "504", "api", "报错", "崩溃", "无法登录", "超时", "bug", "error", "crash",
            "timeout", "webhook", "同步失败", "接口", "故障", "outage", "down", "sdk",
        ]
        is_tech = any(k in ticket_text.lower() for k in tech_triggers)
        urgent = any(k in ticket_text.lower() for k in ("紧急", "线上", "生产", "urgent", "production", "愤怒", "退款", "立刻"))
        route_tag = "TECHNICAL_ISSUE" if is_tech else "AFTER_SALES_CARE"
        sentiment = "偏负面 / 焦急（需优先响应）" if urgent else "中性偏关注"
        if language == "en":
            return f"""### Customer Ticket Triage & Sentiment Analysis

- **Customer**: `{customer_name}`
- **Detected Intent**: `{"Technical Incident / API Troubleshooting" if is_tech else "Billing / Account / After-Sales Care"}`
- **Sentiment**: `{"Frustrated / Urgent" if urgent else "Neutral / Constructive"}`
- **SLA Priority**: `{"P1 (15 min response)" if urgent else "P2 (2 hour response)"}`
- **Routing Tag**: `{route_tag}`
"""
        return f"""### 客户工单意图识别与情绪研判

- **客户标识**：`{customer_name}`
- **核心意图分类**：`{"技术故障排查与接口诊断" if is_tech else "售后咨询 / 账单服务 / 情绪安抚"}`
- **情绪温度评估**：`{sentiment}`
- **建议 SLA 优先级**：`{"P1 紧急（15 分钟内响应）" if urgent else "P2 常规（2 小时内响应）"}`
- **路由分发标记**：`{route_tag}`
"""

    # 11. Tech Troubleshooting Reply
    if role_norm == "ticket_tech_reply":
        if language == "en":
            return f"""### Technical Support Response Draft (Ready to Send)

Hi {customer_name},

Thank you for flagging this right away—I completely understand the urgency and have already escalated this to our engineering on-call queue.

**Immediate Diagnostic Checklist:**
1. **Verify Endpoint & Auth Header**: Confirm your Bearer token hasn't rotated and your request targets the latest API v2 base URL.
2. **Inspect Rate Limits / Timeout**: Check for `429` or `504` response headers (`X-Request-Id`) and enable exponential backoff for batch jobs.
3. **Share Trace ID**: Please reply with the `X-Request-Id` and approximate UTC timestamp so we can pull exact server-side logs within 10 minutes.

We will stay on this thread until your workflow is 100% green again.

Best regards,  
**Technical Support Engineering Team**
"""
        return f"""### 技术支持标准回复草稿（可直接发送）

{customer_name} 您好：

非常感谢您第一时间反馈问题，我们完全理解线上异常对您业务的影响，已同步为您开启 **高优技术排查通道**。

#### 建议同步核查以下 3 项关键信息（协助我们 10 分钟内精准定位）：
1. **请求标识与时间点**：请方便时提供报错接口的 `X-Request-Id` 及大致触发时间，我们将在服务端直接拉取完整 Trace 日志；
2. **鉴权与配置校验**：请确认 API Key 仍在有效期内，且客户端超时时间（Timeout）建议设置为 `>= 30s`；
3. **应急恢复方案**：如涉及批量任务触发限流，可先开启指数退避重试（Exponential Backoff）或暂时切至备用队列。

工程师已在后台持续监控相关节点，您补充信息后我们将立即为您跟进闭环，直至服务完全恢复正常！

祝工作顺心，  
**技术支持工程团队**
"""

    # 12. Empathy & After-Sales Reply
    if role_norm == "ticket_empathy_reply":
        if language == "en":
            return f"""### Customer Care & Retention Response Draft (Ready to Send)

Hi {customer_name},

Thank you for reaching out, and I sincerely apologize for the inconvenience you experienced. Your trust means a great deal to us, and I'm personally taking ownership of your request today.

**How We're Making This Right:**
- ✅ **Priority Review**: Your account and billing/service details have been flagged for immediate resolution per our Customer Care SOP.
- ✅ **Clear Next Step**: We will process your adjustment/request within **1 business day** and send confirmation directly to your inbox.
- ✅ **Dedicated Follow-up**: If you have any additional questions or preferred timing, simply reply to this message and I'll handle it directly.

Warm regards,  
**Customer Success Team**
"""
        return f"""### 客户关怀与售后安抚标准回复草稿（可直接发送）

{customer_name} 您好：

非常抱歉此次体验给您带来了不便与困扰！您的反馈对我们极其重要，本工单已由我**专人全程跟进负责**，请您放心。

#### 为您安排的处理方案：
- ✅ **优先加急核办**：已依据我们的 SaaS 客户售后 SOP 为您的账号开启绿色通道，正在为您核对订单/权益详情；
- ✅ **明确时效承诺**：我们将在 **1 个工作日内** 完成处理并同步最终结果，绝不让您反复等待；
- ✅ **专属补偿/服务跟进**：如您对账号配置、套餐调整或发票开具有任何补充需求，直接回复本消息即可，我将第一时间为您妥善办结。

再次感谢您的耐心与包容，祝您生活愉快！  
**客户成功与售后支持团队**
"""

    # 13. Architecture Breakdown (Engineering Template)
    if role_norm == "arch_breakdown":
        return f"""### 核心需求拆解与领域边界 — {subject}

#### 一、功能域划分（Bounded Contexts）
1. **接入与鉴权层**：统一 API Gateway、RBAC 权限校验、租户级限流（Token Bucket）。
2. **核心业务编排层**：基于事件驱动 + 幂等状态机处理 `{subject}` 核心交易/流转链路。
3. **数据与可观测层**：读写分离（PostgreSQL + Redis 缓存）+ OpenTelemetry 全链路追踪。

#### 二、非功能性硬指标（NFR）
- **可用性目标**：99.95% SLA，支持蓝绿平滑发布与秒级回滚。
- **性能基线**：P99 响应 `< 180ms`，核心写入链路支持水平分片扩展。
"""

    # 14. System Architecture & API Design
    if role_norm == "arch_design":
        return f"""### 系统架构设计与核心 API 契约 — {subject}

```ts
// Core Domain Service Contract
export interface CreateOrderCommand {{
  tenantId: string
  idempotencyKey: string
  payload: Record<string, unknown>
}}

export interface ExecutionReceipt {{
  traceId: string
  status: 'QUEUED' | 'COMPLETED' | 'FAILED'
  latencyMs: number
}}
```

| 分层 | 推荐选型 | 设计权衡说明 |
| :--- | :--- | :--- |
| API 网关 | FastAPI / Kong | 原生异步高并发，零成本生成 OpenAPI 3.1 契约 |
| 持久化 | PostgreSQL 16 + JSONB | 兼顾强事务一致性与半结构化扩展字段 |
| 异步任务 | Redis Streams / Celery | 削峰填谷，保障外部 Webhook 与重型推理不阻塞主线程 |
"""

    # 15. Security & Edge Case Audit
    if role_norm == "security_review":
        return f"""### 安全红线审查与边界测试用例 — {subject}

#### 安全加固清单
- 🛡️ **注入与越权防护**：全量参数 Pydantic 强类型校验 + 行级租户隔离（Row-Level Tenant Isolation）。
- 🛡️ **出网与密钥治理**：所有第三方 Webhook 强制开启 SSRF 私有网段拦截，密钥经 KMS/Fernet 加密落盘。
- 🛡️ **幂等与并发锁**：关键状态变更采用乐观锁版本号（`version`）+ 唯一幂等键防止重复提交。

#### 关键边界测试矩阵
1. 空负载 / 超长畸形 UTF-8 输入 → 返回 `422 Unprocessable Entity` 且无堆栈泄露。
2. 并发重放同一 `idempotencyKey` → 仅执行一次并幂等返回首次回执。
3. 下游超时（>15s）→ 触发熔断降级并记录完整告警 Trace。
"""

    # 16. Sales Quote Specialist (Multi-way Intent Router)
    if role_norm == "sales_quote_reply":
        return f"""### 💼 企业级商务方案与梯度报价回复

{customer_name} 您好！感谢咨询企业版部署方案，以下为您整理的核心套餐对照：

| 方案等级 | 适用规模 | 核心能力 | 参考报价 |
| :--- | :--- | :--- | :--- |
| **团队专业版** | 5–20 人 | 全节点画布 + BYOK 多模型 + 90 天 Trace | ¥2,980 / 月 |
| **企业私有版** | 20–200 人 | Docker/K8s 私有化部署 + SSO + 专属 SLA | ¥18,000 / 季起 |
| **源码定制交付** | 深度集成 | 定制垂直行业 Agent 工作流 + 专属架构师护航 | 按需评估 |

如需安排 **20 分钟专属在线 Demo 演示**，直接回复您的方便时间即可！
"""

    # 17. Refund & Retention Specialist
    if role_norm == "refund_specialist":
        return f"""### 🤝 退款核查与高优关怀处理单

{customer_name} 您好，非常抱歉本次服务未能达到您的预期。我们已为您开启 **快速退费与权益核查通道**：
1. **无忧核办**：已核对您的订单周期，符合 7 日无理由/未消耗按比例退费政策；
2. **明确时效**：退款申请将在 **24 小时内审核完毕**，资金原路退回（1–3 个工作日到账）；
3. **可选替代关怀**：如仅因配置或接入遇到门槛，我们可免费赠送 1 次 1v1 架构师远程协助并延长 30 天试用期。
"""

    # 18. Finance & Market Intelligence Commentary
    if role_norm == "finance_commentary":
        return f"""### 📈 实时财经舆情与量化信号深度点评 — {subject}

> **综合市场情绪**：🟢 **偏多动能（Positive Momentum）** ｜ **基准景气指数**：`87.4` ｜ **同比增速**：`+38.6%`

#### 一、核心信号交叉验证
结合上游 **HTTP 实时行情快照** 与 **历史研报知识库** 交叉校验，`{subject}` 所在的 `{industry}` 板块正处于“技术渗透率跨越鸿沟 → 企业级预算规模化放量”的关键拐点。

#### 二、机构级关注要点
1. **业绩兑现节奏**：重点跟踪企业活跃付费席位（`1,240+`）向高客单价私有化方案的升级转化率。
2. **估值安全边际**：短期波动受宏观流动性影响，中长期核心看 Net Dollar Retention（NDR）能否维持在 `120%+` 区间。
3. **风险提示**：需持续关注算力推理成本下行带来的定价权变化及行业合规监管动态。
"""

    # Generic High-Quality Fallback
    if language == "en":
        return f"""### {node_label} — Synthesis Output

**Focus**: `{subject}`

#### Key Insights
1. **Structured Context Alignment**: Integrated upstream signals and prompt instructions cleanly into an actionable brief.
2. **Recommended Execution**: Prioritize high-leverage actions with clear measurable milestones and automated validation gates.
3. **Next Steps**: Review the generated breakdown below and export to Markdown or chain into downstream delivery nodes.
"""
    return f"""### {node_label} · 智能体分析输出

**当前聚焦主题**：`{subject}`

#### 核心研判要点
1. **上下文精准融合**：已自动汇总上游节点输出与输入参数，提炼出结构化业务洞察。
2. **可执行落地建议**：建议按照“核心目标拆解 → 关键风险前置拦截 → 量化里程碑验收”三步推进落地。
3. **后续衔接**：结果已格式化为标准 Markdown，可直接传递至下游节点继续加工或一键导出分享。
"""


async def stream_llm_response(
    *,
    provider_mode: str,
    base_url: str,
    api_key: str,
    model: str,
    temperature: float,
    system_prompt: str,
    user_prompt: str,
    node_role: str = "general",
    node_label: str = "LLM Agent",
    inputs: dict[str, Any] | None = None,
    language: str = "zh",
    demo_delay_ms: int = 28,
    http_client: httpx.AsyncClient | None = None,
) -> AsyncGenerator[str, None]:
    """Yield incremental text tokens from either built-in realistic Demo mode or OpenAI-compatible SSE."""
    use_real = provider_mode == "OPENAI_COMPAT" and bool(base_url.strip())

    if not use_real:
        full_text = _build_demo_markdown(
            role=node_role,
            node_label=node_label,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            inputs=inputs or {},
            language=language,
        )
        # Stream in realistic small token chunks (6-14 chars)
        idx = 0
        length = len(full_text)
        step = 10
        delay_sec = max(0.0, demo_delay_ms / 1000.0)
        while idx < length:
            chunk = full_text[idx : idx + step]
            idx += step
            yield chunk
            if delay_sec > 0:
                await asyncio.sleep(delay_sec)
        return

    # Real OpenAI-compatible streaming mode
    endpoint = base_url.rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint = f"{endpoint}/chat/completions"

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    messages = []
    if system_prompt and system_prompt.strip():
        messages.append({"role": "system", "content": system_prompt.strip()})
    messages.append({"role": "user", "content": user_prompt or "Hello"})

    payload = {
        "model": model or "gpt-4o-mini",
        "messages": messages,
        "temperature": float(temperature),
        "stream": True,
    }

    owns_client = http_client is None
    client = http_client or httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=20.0))
    try:
        async with client.stream("POST", endpoint, headers=headers, json=payload) as response:
            if response.status_code >= 400:
                err_body = (await response.aread()).decode("utf-8", errors="replace")[:500]
                raise RuntimeError(
                    f"LLM API 请求失败 (HTTP {response.status_code}): {err_body}"
                )

            async for line in response.aiter_lines():
                if not line:
                    continue
                stripped = line.strip()
                if not stripped.startswith("data:"):
                    continue
                data_str = stripped[5:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    data_obj = json.loads(data_str)
                except json.JSONDecodeError:
                    continue
                choices = data_obj.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                content = delta.get("content")
                if content:
                    yield content
    finally:
        if owns_client:
            await client.aclose()
