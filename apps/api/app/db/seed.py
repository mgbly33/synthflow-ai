from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import encrypt_secret
from app.engine.knowledge_retriever import chunk_document
from app.models.models import EvalCase, KnowledgeDoc, ProviderConfig, Workflow, WorkflowSchedule

SEED_KNOWLEDGE_DOCS = [
    {
        "id": "kb-brand-voice",
        "title": "企业品牌调性手册 / Enterprise Brand Voice & Style Guide",
        "content": """# 品牌核心定位与声量规范

品牌定位于「精密、克制、值得信赖的智能效率伙伴」。对外文案避免浮夸喊口号，强调真实场景痛点、可量化效率提升与清晰的操作路径。

## 小红书种草风格规范
开头用真实职场/业务痛点破冰，善用对比反差（如“3小时压缩到5分钟”），段落简短呼吸感强，适度点缀 3-5 个 Emoji，结尾引导评论区互动领取清单。

## 公众号深度文章规范
采用“行业趋势洞察 → 痛点结构化拆解 → 产品能力闭环 → 客户证言/金句收尾”的四段式结构，语言沉稳专业，逻辑严密，突出 B 端决策价值。

## X / Twitter 传播规范
英文或中英双语短句表达，Thread 控制在 4 条以内，首条抛出反常识观点（Hook），中段用要点列表展示硬核指标，末条给出清晰行动号召（CTA）。
""",
    },
    {
        "id": "kb-saas-support-sop",
        "title": "SaaS 客户售后 SOP 指南 / SaaS Customer Support & Escalation SOP",
        "content": """# SaaS 客户工单分级与响应标准（SLA）

## P1 紧急生产故障（15 分钟内首次响应）
触发条件：线上 API 返回 500/502/504、登录中断、Webhook 大面积超时或数据同步阻塞。处理流程：立即安抚并告知已升级至 On-Call 工程师，主动索取 X-Request-Id 与触发时间戳，提供指数退避重试或备用队列应急方案。

## P2 售后账单与情绪安抚（2 小时内响应，1 个工作日闭环）
触发条件：账单争议、套餐降级/退款诉求、使用体验不满或功能咨询。处理流程：先共情致歉、明确专人负责，不推诿责任，清晰承诺 1 个工作日内闭环时间点，并根据客户等级提供绿色通道或权益关怀。

## 沟通禁用语与加分项
严禁使用“请您自行排查”“这不是我们的问题”等推诿话术；所有回复需包含清晰下一步行动（Next Step）与明确反馈时效。
""",
    },
    {
        "id": "kb-market-research-2026",
        "title": "2026 企业级 AI SaaS 投研基准库 / Enterprise AI Benchmark Notes",
        "content": """# 2026 企业级 AI Agent 与自动化市场核心基准

## 增长与留存指标
头部企业级 AI 工作流平台平均同比增速超过 35%，核心驱动力来自跨部门 SOP 自动化与私有知识库检索（RAG）的规模化采购。标杆企业的 Net Dollar Retention（NDR）维持在 122%–135% 区间。

## 跨境电商多站点本地化规范
美区（EN-US）强调痛点直击与 30 天无忧质保；日区（JA-JP）强调精密工艺细节、礼貌敬语与完整规格表；德区（DE-DE）强调合规认证、耐用性与工程级数据支撑。
""",
    },
]

SEED_WORKFLOWS = [
    {
        "id": "tpl-competitor-report",
        "name": "商业竞品深度研报生成流",
        "name_en": "Competitive Intelligence Deep-Dive",
        "description": "输入目标竞品与赛道，并行拆解核心护城河与潜在风险短板，自动汇总输出高管级 Markdown 商业研报。",
        "description_en": "Analyze any competitor in parallel across moat strengths and strategic vulnerabilities, synthesizing an executive Markdown report.",
        "category": "research",
        "is_template": True,
        "graph_json": {
            "nodes": [
                {
                    "id": "input_1",
                    "type": "input",
                    "position": {"x": 60, "y": 190},
                    "data": {
                        "label": "研报输入参数",
                        "labelEn": "Research Brief Input",
                        "fields": [
                            {
                                "name": "company",
                                "label": "目标竞品 / 产品名",
                                "labelEn": "Target Competitor / Product",
                                "type": "text",
                                "placeholder": "例如：Notion AI / Linear / Dify",
                                "required": True,
                            },
                            {
                                "name": "industry",
                                "label": "所属行业赛道",
                                "labelEn": "Industry Sector",
                                "type": "text",
                                "placeholder": "例如：企业级 AI 工作流 SaaS",
                                "required": True,
                            },
                            {
                                "name": "audience",
                                "label": "目标客群",
                                "labelEn": "Target Audience",
                                "type": "text",
                                "placeholder": "例如：中大型科技公司研发与产品团队",
                                "required": False,
                            },
                        ],
                        "sampleInputs": {
                            "company": "Dify Enterprise AI",
                            "industry": "企业级 AI Agent 编排与工作流平台",
                            "audience": "中大型企业技术负责人与 AI 应用开发团队",
                        },
                    },
                },
                {
                    "id": "llm_strengths",
                    "type": "llm",
                    "position": {"x": 400, "y": 50},
                    "data": {
                        "label": "优势与护城河分析师",
                        "labelEn": "Moat & Strengths Analyst",
                        "role": "competitor_strengths",
                        "model": "deepseek-chat",
                        "temperature": 0.5,
                        "systemPrompt": "你是一位资深商业战略分析师，擅长用结构化框架与表格拆解科技产品的核心护城河与商业优势。",
                        "userPrompt": "请针对「{{input.company}}」（赛道：{{input.industry}}，核心客群：{{input.audience}}）深度分析其产品护城河、PLG 转化机制与商业化优势。",
                    },
                },
                {
                    "id": "llm_risks",
                    "type": "llm",
                    "position": {"x": 400, "y": 330},
                    "data": {
                        "label": "短板与风险诊断师",
                        "labelEn": "Risks & Vulnerabilities Analyst",
                        "role": "competitor_risks",
                        "model": "deepseek-chat",
                        "temperature": 0.6,
                        "systemPrompt": "你是一位敏锐的竞争情报专家，专注识别标杆产品在企业级落地时的工程痛点、成本黑盒与差异化切入机会。",
                        "userPrompt": "请剖析「{{input.company}}」在「{{input.industry}}」落地中的潜在短板、客户抱怨点以及可行的差异化反超策略。",
                    },
                },
                {
                    "id": "llm_executive",
                    "type": "llm",
                    "position": {"x": 760, "y": 190},
                    "data": {
                        "label": "高管研报总编汇总",
                        "labelEn": "Executive Report Synthesizer",
                        "role": "executive_report",
                        "model": "deepseek-chat",
                        "temperature": 0.4,
                        "systemPrompt": "你是顶级咨询公司合伙人，请整合上游两份并行分析，输出一份结构严谨、含对比表格与 90 天行动路线图的高管级 Markdown 商业简报。",
                        "userPrompt": "目标产品：{{input.company}}\n赛道：{{input.industry}}\n\n【优势分析】\n{{llm_strengths.output}}\n\n【风险与机会】\n{{llm_risks.output}}\n\n请汇总生成最终高管级竞品研报。",
                    },
                },
                {
                    "id": "output_1",
                    "type": "output",
                    "position": {"x": 1110, "y": 190},
                    "data": {
                        "label": "高管研报成品",
                        "labelEn": "Executive Brief Output",
                        "title": "商业竞品深度研报",
                        "template": "{{llm_executive.output}}",
                        "format": "markdown",
                    },
                },
            ],
            "edges": [
                {"id": "e-in-str", "source": "input_1", "target": "llm_strengths", "type": "glow"},
                {"id": "e-in-rsk", "source": "input_1", "target": "llm_risks", "type": "glow"},
                {"id": "e-str-exe", "source": "llm_strengths", "target": "llm_executive", "type": "glow"},
                {"id": "e-rsk-exe", "source": "llm_risks", "target": "llm_executive", "type": "glow"},
                {"id": "e-exe-out", "source": "llm_executive", "target": "output_1", "type": "glow"},
            ],
        },
    },
    {
        "id": "tpl-marketing-studio",
        "name": "多平台营销内容工坊",
        "name_en": "Multi-Platform Marketing Studio",
        "description": "输入产品核心卖点，先检索企业品牌调性知识库，再并行生成小红书种草笔记、公众号深度推文与 X 推文串。",
        "description_en": "Retrieve brand voice guidelines via BM25 RAG, then generate Xiaohongshu, WeChat long-form, and X/Twitter content in parallel.",
        "category": "marketing",
        "is_template": True,
        "graph_json": {
            "nodes": [
                {
                    "id": "input_mkt",
                    "type": "input",
                    "position": {"x": 40, "y": 230},
                    "data": {
                        "label": "产品卖点输入",
                        "labelEn": "Campaign Brief Input",
                        "fields": [
                            {"name": "product", "label": "产品名称", "labelEn": "Product Name", "type": "text", "required": True},
                            {"name": "selling_points", "label": "核心卖点", "labelEn": "Key Selling Points", "type": "textarea", "required": True},
                            {"name": "audience", "label": "目标受众", "labelEn": "Target Audience", "type": "text", "required": False},
                        ],
                        "sampleInputs": {
                            "product": "SynthFlow AI Studio",
                            "selling_points": "可视化拖拽编排多智能体、逐 Token 实时流式观测、免 Key 即开即用且支持私有化 DeepSeek/Ollama 接入",
                            "audience": "AI 应用开发者、B端增长团队与效率极客",
                        },
                    },
                },
                {
                    "id": "kb_brand",
                    "type": "knowledge",
                    "position": {"x": 360, "y": 230},
                    "data": {
                        "label": "品牌调性知识检索",
                        "labelEn": "Brand Voice RAG",
                        "queryTemplate": "品牌调性 小红书 公众号 Twitter {{input.product}}",
                        "topK": 3,
                        "docIds": ["kb-brand-voice"],
                    },
                },
                {
                    "id": "llm_xhs",
                    "type": "llm",
                    "position": {"x": 700, "y": 20},
                    "data": {
                        "label": "小红书种草写手",
                        "labelEn": "Xiaohongshu Copywriter",
                        "role": "xiaohongshu_copy",
                        "model": "deepseek-chat",
                        "temperature": 0.85,
                        "systemPrompt": "你是一位精通小红书爆款节奏的内容主理人，严格遵循检索到的品牌调性手册撰写高互动种草笔记。",
                        "userPrompt": "产品：{{input.product}}\n核心卖点：{{input.selling_points}}\n目标受众：{{input.audience}}\n\n【品牌调性规范】\n{{kb_brand.output}}",
                    },
                },
                {
                    "id": "llm_wechat",
                    "type": "llm",
                    "position": {"x": 700, "y": 230},
                    "data": {
                        "label": "公众号深度主笔",
                        "labelEn": "WeChat Editorial Writer",
                        "role": "wechat_article",
                        "model": "deepseek-chat",
                        "temperature": 0.65,
                        "systemPrompt": "你是科技商业专栏主笔，请结合品牌调性手册撰写一篇有洞察力、适合转发传播的公众号深度推文。",
                        "userPrompt": "产品：{{input.product}}\n核心卖点：{{input.selling_points}}\n目标受众：{{input.audience}}\n\n【品牌调性规范】\n{{kb_brand.output}}",
                    },
                },
                {
                    "id": "llm_twitter",
                    "type": "llm",
                    "position": {"x": 700, "y": 440},
                    "data": {
                        "label": "X / Twitter 推文专家",
                        "labelEn": "X / Twitter Thread Crafter",
                        "role": "twitter_thread",
                        "model": "deepseek-chat",
                        "temperature": 0.75,
                        "systemPrompt": "You are a tech growth marketer crafting punchy 4-tweet X/Twitter threads aligned with brand voice guidelines.",
                        "userPrompt": "Product: {{input.product}}\nSelling Points: {{input.selling_points}}\nAudience: {{input.audience}}\n\nBrand Voice:\n{{kb_brand.output}}",
                    },
                },
                {
                    "id": "output_mkt",
                    "type": "output",
                    "position": {"x": 1060, "y": 230},
                    "data": {
                        "label": "多渠道发布包",
                        "labelEn": "Omnichannel Publish Pack",
                        "title": "多平台营销内容全案",
                        "template": "{{llm_xhs.output}}\n\n---\n\n{{llm_wechat.output}}\n\n---\n\n{{llm_twitter.output}}",
                        "format": "markdown",
                    },
                },
            ],
            "edges": [
                {"id": "e-mkt-1", "source": "input_mkt", "target": "kb_brand", "type": "glow"},
                {"id": "e-mkt-2", "source": "kb_brand", "target": "llm_xhs", "type": "glow"},
                {"id": "e-mkt-3", "source": "kb_brand", "target": "llm_wechat", "type": "glow"},
                {"id": "e-mkt-4", "source": "kb_brand", "target": "llm_twitter", "type": "glow"},
                {"id": "e-mkt-5", "source": "llm_xhs", "target": "output_mkt", "type": "glow"},
                {"id": "e-mkt-6", "source": "llm_wechat", "target": "output_mkt", "type": "glow"},
                {"id": "e-mkt-7", "source": "llm_twitter", "target": "output_mkt", "type": "glow"},
            ],
        },
    },
    {
        "id": "tpl-contract-review",
        "name": "合同条款风险智能审查流",
        "name_en": "Contract Risk Review Pipeline",
        "description": "提取合同关键条款并识别高危法律信号，通过 Condition 条件路由分流至高风险红线修订或常规合规放行。",
        "description_en": "Extract key legal clauses, route via Condition node on risk flags, and output redline remediation or standard clearance.",
        "category": "legal",
        "is_template": True,
        "graph_json": {
            "nodes": [
                {
                    "id": "input_contract",
                    "type": "input",
                    "position": {"x": 40, "y": 190},
                    "data": {
                        "label": "合同文本输入",
                        "labelEn": "Contract Text Input",
                        "fields": [
                            {"name": "contract_title", "label": "合同名称", "labelEn": "Contract Title", "type": "text", "required": True},
                            {"name": "contract_text", "label": "待审查条款文本", "labelEn": "Clauses to Review", "type": "textarea", "required": True},
                        ],
                        "sampleInputs": {
                            "contract_title": "2026 企业智能体平台定制开发合同",
                            "contract_text": "第七条（违约责任）：如乙方交付延迟超过 3 日，乙方须承担无限连带赔偿责任并支付合同总额 50% 的高额违约金；甲方有权在不承担任何费用的前提下单方解除本协议，且本项目涉及的所有既有与新增知识产权归甲方所有。",
                        },
                    },
                },
                {
                    "id": "llm_extract",
                    "type": "llm",
                    "position": {"x": 360, "y": 190},
                    "data": {
                        "label": "条款提取与初筛引擎",
                        "labelEn": "Clause Risk Scanner",
                        "role": "contract_extract",
                        "model": "deepseek-chat",
                        "temperature": 0.2,
                        "systemPrompt": "你是资深企业法务顾问，请快速提取合同核心义务条款并标注是否触发 HIGH_RISK。",
                        "userPrompt": "合同名称：{{input.contract_title}}\n\n条款内容：\n{{input.contract_text}}",
                    },
                },
                {
                    "id": "cond_risk",
                    "type": "condition",
                    "position": {"x": 690, "y": 190},
                    "data": {
                        "label": "高风险条件路由器",
                        "labelEn": "High-Risk Router",
                        "sourceTemplate": "{{llm_extract.output}}",
                        "operator": "contains",
                        "value": "HIGH_RISK",
                        "caseSensitive": False,
                        "trueLabel": "高风险拦截",
                        "falseLabel": "常规放行",
                    },
                },
                {
                    "id": "llm_high_risk",
                    "type": "llm",
                    "position": {"x": 1020, "y": 40},
                    "data": {
                        "label": "红线修订专家（True）",
                        "labelEn": "Redline Specialist (True)",
                        "role": "contract_high_risk",
                        "model": "deepseek-chat",
                        "temperature": 0.3,
                        "systemPrompt": "你是谈判型企业法务专家，请针对识别出的高风险项输出红黄绿分级风险矩阵与可直接替换的修订条款。",
                        "userPrompt": "初筛报告：\n{{llm_extract.output}}\n\n原合同条款：\n{{input.contract_text}}",
                    },
                },
                {
                    "id": "llm_low_risk",
                    "type": "llm",
                    "position": {"x": 1020, "y": 330},
                    "data": {
                        "label": "合规放行审核（False）",
                        "labelEn": "Compliance Clearance (False)",
                        "role": "contract_low_risk",
                        "model": "deepseek-chat",
                        "temperature": 0.2,
                        "systemPrompt": "请输出简洁清晰的合规审查放行结论与签前常规核对清单。",
                        "userPrompt": "初筛报告：\n{{llm_extract.output}}",
                    },
                },
                {
                    "id": "output_legal",
                    "type": "output",
                    "position": {"x": 1370, "y": 190},
                    "data": {
                        "label": "法务审查报告",
                        "labelEn": "Legal Review Report",
                        "title": "合同条款风险审查报告",
                        "template": "{{llm_extract.output}}\n\n---\n\n{{llm_high_risk.output}}{{llm_low_risk.output}}",
                        "format": "markdown",
                    },
                },
            ],
            "edges": [
                {"id": "e-leg-1", "source": "input_contract", "target": "llm_extract", "type": "glow"},
                {"id": "e-leg-2", "source": "llm_extract", "target": "cond_risk", "type": "glow"},
                {"id": "e-leg-3", "source": "cond_risk", "sourceHandle": "true", "target": "llm_high_risk", "type": "glow", "label": "True"},
                {"id": "e-leg-4", "source": "cond_risk", "sourceHandle": "false", "target": "llm_low_risk", "type": "glow", "label": "False"},
                {"id": "e-leg-5", "source": "llm_high_risk", "target": "output_legal", "type": "glow"},
                {"id": "e-leg-6", "source": "llm_low_risk", "target": "output_legal", "type": "glow"},
            ],
        },
    },
    {
        "id": "tpl-ticket-triage",
        "name": "客户工单智能分诊与回复流",
        "name_en": "Customer Ticket Triage & Reply",
        "description": "同步检索 SaaS 售后 SOP 与研判客户意图/情绪，自动条件分流至技术故障排查或售后安抚回复草稿。",
        "description_en": "Combine SaaS Support SOP retrieval with intent/sentiment classification, routing to tech diagnostics or empathetic retention reply.",
        "category": "support",
        "is_template": True,
        "graph_json": {
            "nodes": [
                {
                    "id": "input_ticket",
                    "type": "input",
                    "position": {"x": 40, "y": 190},
                    "data": {
                        "label": "客户工单输入",
                        "labelEn": "Support Ticket Input",
                        "fields": [
                            {"name": "customer_name", "label": "客户称呼", "labelEn": "Customer Name", "type": "text", "required": True},
                            {"name": "ticket_content", "label": "工单反馈详情", "labelEn": "Ticket Message", "type": "textarea", "required": True},
                        ],
                        "sampleInputs": {
                            "customer_name": "林技术总监",
                            "ticket_content": "紧急！我们生产环境调用 Webhook 接口连续出现 504 超时报错，业务数据同步全部中断了，请立刻协助排查！",
                        },
                    },
                },
                {
                    "id": "kb_sop",
                    "type": "knowledge",
                    "position": {"x": 360, "y": 60},
                    "data": {
                        "label": "售后 SOP 知识库",
                        "labelEn": "Support SOP RAG",
                        "queryTemplate": "{{input.ticket_content}} SLA 响应",
                        "topK": 2,
                        "docIds": ["kb-saas-support-sop"],
                    },
                },
                {
                    "id": "llm_triage",
                    "type": "llm",
                    "position": {"x": 360, "y": 310},
                    "data": {
                        "label": "意图与情绪识别器",
                        "labelEn": "Intent & Sentiment Classifier",
                        "role": "ticket_triage",
                        "model": "deepseek-chat",
                        "temperature": 0.2,
                        "systemPrompt": "你是智能客服分诊引擎，识别客户意图（TECHNICAL_ISSUE 或 AFTER_SALES_CARE）、情绪与 SLA 优先级。",
                        "userPrompt": "客户：{{input.customer_name}}\n反馈：{{input.ticket_content}}",
                    },
                },
                {
                    "id": "cond_triage",
                    "type": "condition",
                    "position": {"x": 700, "y": 190},
                    "data": {
                        "label": "工单分诊路由",
                        "labelEn": "Triage Branch Router",
                        "sourceTemplate": "{{llm_triage.output}}",
                        "operator": "contains",
                        "value": "TECHNICAL_ISSUE",
                        "caseSensitive": False,
                        "trueLabel": "技术排查",
                        "falseLabel": "售后安抚",
                    },
                },
                {
                    "id": "llm_tech",
                    "type": "llm",
                    "position": {"x": 1030, "y": 50},
                    "data": {
                        "label": "技术排查回复（True）",
                        "labelEn": "Tech Support Reply (True)",
                        "role": "ticket_tech_reply",
                        "model": "deepseek-chat",
                        "temperature": 0.4,
                        "systemPrompt": "你是高级技术支持工程师，结合 SOP 指南撰写专业、高响应度、含排查步骤与应急方案的客户回复。",
                        "userPrompt": "分诊结果：\n{{llm_triage.output}}\n\nSOP 规范：\n{{kb_sop.output}}\n\n原工单：{{input.ticket_content}}",
                    },
                },
                {
                    "id": "llm_empathy",
                    "type": "llm",
                    "position": {"x": 1030, "y": 330},
                    "data": {
                        "label": "售后安抚回复（False）",
                        "labelEn": "Empathy Care Reply (False)",
                        "role": "ticket_empathy_reply",
                        "model": "deepseek-chat",
                        "temperature": 0.5,
                        "systemPrompt": "你是资深客户成功经理，结合 SOP 撰写温暖真诚、有明确解决承诺的售后安抚回复。",
                        "userPrompt": "分诊结果：\n{{llm_triage.output}}\n\nSOP 规范：\n{{kb_sop.output}}\n\n原工单：{{input.ticket_content}}",
                    },
                },
                {
                    "id": "output_ticket",
                    "type": "output",
                    "position": {"x": 1380, "y": 190},
                    "data": {
                        "label": "标准客服回复单",
                        "labelEn": "Ready-to-Send Reply",
                        "title": "客户工单分诊与标准回复",
                        "template": "{{llm_triage.output}}\n\n---\n\n{{llm_tech.output}}{{llm_empathy.output}}",
                        "format": "markdown",
                    },
                },
            ],
            "edges": [
                {"id": "e-tkt-1", "source": "input_ticket", "target": "kb_sop", "type": "glow"},
                {"id": "e-tkt-2", "source": "input_ticket", "target": "llm_triage", "type": "glow"},
                {"id": "e-tkt-3", "source": "kb_sop", "target": "cond_triage", "type": "glow"},
                {"id": "e-tkt-4", "source": "llm_triage", "target": "cond_triage", "type": "glow"},
                {"id": "e-tkt-5", "source": "cond_triage", "sourceHandle": "true", "target": "llm_tech", "type": "glow", "label": "True"},
                {"id": "e-tkt-6", "source": "cond_triage", "sourceHandle": "false", "target": "llm_empathy", "type": "glow", "label": "False"},
                {"id": "e-tkt-7", "source": "llm_tech", "target": "output_ticket", "type": "glow"},
                {"id": "e-tkt-8", "source": "llm_empathy", "target": "output_ticket", "type": "glow"},
            ],
        },
    },
    # --- 4 NEW FLAGSHIP ENTERPRISE TEMPLATES (Iter 3) ---
    {
        "id": "tpl-arch-review",
        "name": "AI 架构设计与安全审查流水线",
        "name_en": "AI System Architecture & Security Audit",
        "description": "输入业务需求，自动拆解领域边界，并行产出系统架构 API 契约与安全边界测试矩阵，经聚合器输出完整技术方案书。",
        "description_en": "Decompose product specs into bounded contexts, run parallel architecture & security reviews, and aggregate into an engineering RFC.",
        "category": "engineering",
        "is_template": True,
        "graph_json": {
            "nodes": [
                {
                    "id": "in_arch",
                    "type": "input",
                    "position": {"x": 40, "y": 210},
                    "data": {
                        "label": "技术需求输入",
                        "labelEn": "Tech Spec Input",
                        "fields": [
                            {"name": "topic", "label": "系统 / 功能名称", "labelEn": "System / Feature", "type": "text", "required": True},
                            {"name": "requirements", "label": "核心业务与并发要求", "labelEn": "Requirements & Scale", "type": "textarea", "required": True},
                        ],
                        "sampleInputs": {
                            "topic": "高并发多租户 AI Webhook 计费网关",
                            "requirements": "支持 5000 QPS 并发鉴权、租户级 Token 额度实时扣减、幂等回调与完整审计日志。",
                        },
                    },
                },
                {
                    "id": "llm_bd",
                    "type": "llm",
                    "position": {"x": 360, "y": 210},
                    "data": {
                        "label": "领域边界拆解师",
                        "labelEn": "Domain Decomposer",
                        "role": "arch_breakdown",
                        "model": "deepseek-chat",
                        "temperature": 0.4,
                        "systemPrompt": "你是首席系统架构师，请将业务需求拆解为清晰的 DDD 限界上下文与非功能性指标。",
                        "userPrompt": "项目：{{input.topic}}\n需求：{{input.requirements}}",
                    },
                },
                {
                    "id": "llm_arch",
                    "type": "llm",
                    "position": {"x": 700, "y": 70},
                    "data": {
                        "label": "架构与契约设计师",
                        "labelEn": "API & Architecture Designer",
                        "role": "arch_design",
                        "model": "deepseek-chat",
                        "temperature": 0.3,
                        "systemPrompt": "请输出核心 TypeScript/API 契约与技术选型权衡表。",
                        "userPrompt": "基于拆解结果设计核心架构：\n{{llm_bd.output}}",
                    },
                },
                {
                    "id": "llm_sec",
                    "type": "llm",
                    "position": {"x": 700, "y": 350},
                    "data": {
                        "label": "安全与边界审计员",
                        "labelEn": "Security & Edge Auditor",
                        "role": "security_review",
                        "model": "deepseek-chat",
                        "temperature": 0.3,
                        "systemPrompt": "请从 OWASP、并发幂等、SSRF 与多租户隔离维度输出安全红线与边界测试矩阵。",
                        "userPrompt": "审查对象：{{input.topic}}\n需求上下文：\n{{llm_bd.output}}",
                    },
                },
                {
                    "id": "agg_arch",
                    "type": "aggregator",
                    "position": {"x": 1050, "y": 210},
                    "data": {
                        "label": "方案汇总聚合器",
                        "labelEn": "RFC Aggregator",
                        "strategy": "markdown_merge",
                        "separator": "\n\n---\n\n",
                    },
                },
                {
                    "id": "out_arch",
                    "type": "output",
                    "position": {"x": 1370, "y": 210},
                    "data": {
                        "label": "工程 RFC 技术方案书",
                        "labelEn": "Engineering RFC Doc",
                        "title": "系统架构与安全审查 RFC",
                        "template": "# {{input.topic}} · 技术架构 RFC\n\n{{llm_bd.output}}\n\n---\n\n{{agg_arch.output}}",
                        "format": "markdown",
                    },
                },
            ],
            "edges": [
                {"id": "e-ar-1", "source": "in_arch", "target": "llm_bd", "type": "glow"},
                {"id": "e-ar-2", "source": "llm_bd", "target": "llm_arch", "type": "glow"},
                {"id": "e-ar-3", "source": "llm_bd", "target": "llm_sec", "type": "glow"},
                {"id": "e-ar-4", "source": "llm_arch", "target": "agg_arch", "type": "glow"},
                {"id": "e-ar-5", "source": "llm_sec", "target": "agg_arch", "type": "glow"},
                {"id": "e-ar-6", "source": "agg_arch", "target": "out_arch", "type": "glow"},
            ],
        },
    },
    {
        "id": "tpl-intent-router",
        "name": "多专家智能意图路由中台",
        "name_en": "Multi-Expert Intent Router Hub",
        "description": "使用 Intent Classifier 3 路零样本路由（技术故障 / 商务报价 / 退款关怀），自动精准激活唯一专家 Agent 并经聚合器输出。",
        "description_en": "Use the 3-way Intent Classifier to dynamically route requests to Tech Support, Enterprise Sales, or Refund Specialist agents.",
        "category": "support",
        "is_template": True,
        "graph_json": {
            "nodes": [
                {
                    "id": "in_hub",
                    "type": "input",
                    "position": {"x": 40, "y": 230},
                    "data": {
                        "label": "全渠道访客消息",
                        "labelEn": "Omnichannel Inquiry",
                        "fields": [
                            {"name": "customer_name", "label": "访客姓名", "labelEn": "Visitor Name", "type": "text", "required": True},
                            {"name": "message", "label": "咨询内容", "labelEn": "Message", "type": "textarea", "required": True},
                        ],
                        "sampleInputs": {
                            "customer_name": "周采购总监",
                            "message": "您好，我们公司约 80 人研发团队计划采购企业私有化部署版，请问报价套餐和年度 SLA 怎么计算？能否安排 Demo？",
                        },
                    },
                },
                {
                    "id": "cls_intent",
                    "type": "classifier",
                    "position": {"x": 370, "y": 230},
                    "data": {
                        "label": "3 路意图分类路由器",
                        "labelEn": "3-Way Intent Classifier",
                        "sourceTemplate": "{{input.message}}",
                        "categories": [
                            {"id": "tech", "label": "技术故障", "keywords": "500,504,报错,api,bug,故障,超时,崩溃"},
                            {"id": "sales", "label": "商务报价", "keywords": "报价,价格,采购,企业版,私有化,demo,套餐,pricing"},
                            {"id": "refund", "label": "退款关怀", "keywords": "退款,退订,投诉,取消,不满意,refund"},
                        ],
                    },
                },
                {
                    "id": "llm_hub_tech",
                    "type": "llm",
                    "position": {"x": 740, "y": 30},
                    "data": {
                        "label": "技术排查专家",
                        "labelEn": "Tech Incident Expert",
                        "role": "ticket_tech_reply",
                        "model": "deepseek-chat",
                        "temperature": 0.3,
                        "systemPrompt": "输出专业的高优技术排查指南。",
                        "userPrompt": "客户 {{input.customer_name}}：{{input.message}}",
                    },
                },
                {
                    "id": "llm_hub_sales",
                    "type": "llm",
                    "position": {"x": 740, "y": 230},
                    "data": {
                        "label": "企业商务顾问",
                        "labelEn": "Enterprise Sales Advisor",
                        "role": "sales_quote_reply",
                        "model": "deepseek-chat",
                        "temperature": 0.5,
                        "systemPrompt": "输出清晰的企业版阶梯报价与 Demo 预约邀请。",
                        "userPrompt": "客户 {{input.customer_name}}：{{input.message}}",
                    },
                },
                {
                    "id": "llm_hub_refund",
                    "type": "llm",
                    "position": {"x": 740, "y": 430},
                    "data": {
                        "label": "售后关怀专员",
                        "labelEn": "Refund & Retention Agent",
                        "role": "refund_specialist",
                        "model": "deepseek-chat",
                        "temperature": 0.4,
                        "systemPrompt": "输出真诚共情且具备明确退费时效的处理方案。",
                        "userPrompt": "客户 {{input.customer_name}}：{{input.message}}",
                    },
                },
                {
                    "id": "agg_hub",
                    "type": "aggregator",
                    "position": {"x": 1100, "y": 230},
                    "data": {
                        "label": "多路结果汇聚",
                        "labelEn": "Branch Aggregator",
                        "strategy": "first_non_empty",
                    },
                },
                {
                    "id": "out_hub",
                    "type": "output",
                    "position": {"x": 1410, "y": 230},
                    "data": {
                        "label": "最终精准应答",
                        "labelEn": "Final Routed Response",
                        "title": "智能意图分流应答结果",
                        "template": "{{agg_hub.output}}",
                        "format": "markdown",
                    },
                },
            ],
            "edges": [
                {"id": "e-hb-1", "source": "in_hub", "target": "cls_intent", "type": "glow"},
                {"id": "e-hb-2", "source": "cls_intent", "sourceHandle": "tech", "target": "llm_hub_tech", "type": "glow", "label": "技术故障"},
                {"id": "e-hb-3", "source": "cls_intent", "sourceHandle": "sales", "target": "llm_hub_sales", "type": "glow", "label": "商务报价"},
                {"id": "e-hb-4", "source": "cls_intent", "sourceHandle": "refund", "target": "llm_hub_refund", "type": "glow", "label": "退款关怀"},
                {"id": "e-hb-5", "source": "llm_hub_tech", "target": "agg_hub", "type": "glow"},
                {"id": "e-hb-6", "source": "llm_hub_sales", "target": "agg_hub", "type": "glow"},
                {"id": "e-hb-7", "source": "llm_hub_refund", "target": "agg_hub", "type": "glow"},
                {"id": "e-hb-8", "source": "agg_hub", "target": "out_hub", "type": "glow"},
            ],
        },
    },
    {
        "id": "tpl-market-intel",
        "name": "实时行情与财经研报情报站",
        "name_en": "Live Market Data & Equity Intelligence",
        "description": "演示 HTTP Tool（SSRF 防护 + 沙箱行情抓取）+ Knowledge 投研知识库 + Code Transform 指标清洗 + LLM 深度研报的完整数据管道。",
        "description_en": "Combine SSRF-safe HTTP Tool market fetching, RAG benchmark retrieval, Code Transform data shaping, and LLM executive commentary.",
        "category": "finance",
        "is_template": True,
        "graph_json": {
            "nodes": [
                {
                    "id": "in_fin",
                    "type": "input",
                    "position": {"x": 40, "y": 200},
                    "data": {
                        "label": "投研标的输入",
                        "labelEn": "Ticker / Sector Brief",
                        "fields": [
                            {"name": "company", "label": "关注标的 / 主题", "labelEn": "Target Company / Theme", "type": "text", "required": True},
                            {"name": "industry", "label": "所属行业板块", "labelEn": "Sector", "type": "text", "required": True},
                        ],
                        "sampleInputs": {
                            "company": "Enterprise AI Agent SaaS 板块",
                            "industry": "企业级 AI 基础设施与自动化软件",
                        },
                    },
                },
                {
                    "id": "http_quote",
                    "type": "http",
                    "position": {"x": 360, "y": 70},
                    "data": {
                        "label": "外部行情 API 抓取",
                        "labelEn": "Market Snapshot HTTP",
                        "method": "GET",
                        "url": "https://api.marketdata.example.com/v1/ai-saas-index",
                        "sandboxMode": True,
                    },
                },
                {
                    "id": "kb_fin",
                    "type": "knowledge",
                    "position": {"x": 360, "y": 330},
                    "data": {
                        "label": "历史投研基准库",
                        "labelEn": "Benchmark Knowledge",
                        "queryTemplate": "企业级 AI SaaS 增速 NDR {{input.industry}}",
                        "topK": 2,
                        "docIds": ["kb-market-research-2026"],
                    },
                },
                {
                    "id": "code_clean",
                    "type": "code",
                    "position": {"x": 700, "y": 70},
                    "data": {
                        "label": "JSON 指标清洗节点",
                        "labelEn": "Metrics Code Transform",
                        "transformMode": "markdown_summary",
                        "sourceTemplate": "{{http_quote.output}}",
                    },
                },
                {
                    "id": "llm_fin",
                    "type": "llm",
                    "position": {"x": 1030, "y": 200},
                    "data": {
                        "label": "机构级研报点评师",
                        "labelEn": "Institutional Analyst",
                        "role": "finance_commentary",
                        "model": "deepseek-chat",
                        "temperature": 0.4,
                        "systemPrompt": "你是资深 TMT 首席分析师，请结合实时清洗后的行情指标与历史基准知识库输出深度投研点评。",
                        "userPrompt": "标的：{{input.company}}\n\n【清洗指标】\n{{code_clean.output}}\n\n【基准资料】\n{{kb_fin.output}}",
                    },
                },
                {
                    "id": "out_fin",
                    "type": "output",
                    "position": {"x": 1370, "y": 200},
                    "data": {
                        "label": "投研情报简报",
                        "labelEn": "Intelligence Brief",
                        "title": "实时行情与投研点评",
                        "template": "{{code_clean.output}}\n\n---\n\n{{llm_fin.output}}",
                        "format": "markdown",
                    },
                },
            ],
            "edges": [
                {"id": "e-fn-1", "source": "in_fin", "target": "http_quote", "type": "glow"},
                {"id": "e-fn-2", "source": "in_fin", "target": "kb_fin", "type": "glow"},
                {"id": "e-fn-3", "source": "http_quote", "target": "code_clean", "type": "glow"},
                {"id": "e-fn-4", "source": "code_clean", "target": "llm_fin", "type": "glow"},
                {"id": "e-fn-5", "source": "kb_fin", "target": "llm_fin", "type": "glow"},
                {"id": "e-fn-6", "source": "llm_fin", "target": "out_fin", "type": "glow"},
            ],
        },
    },
    {
        "id": "tpl-global-listing",
        "name": "跨境电商多站点批量 Listing 工厂",
        "name_en": "Global E-Commerce Batch Listing Factory",
        "description": "结合品牌本地化知识库与 Loop 批量循环迭代节点，一次性为 EN-US / JA-JP / DE-DE 等多国站点生成本地化爆款文案。",
        "description_en": "Pair localization RAG rules with the Loop/Batch Iterator node to generate multi-market product listings in one pass.",
        "category": "marketing",
        "is_template": True,
        "graph_json": {
            "nodes": [
                {
                    "id": "in_ecom",
                    "type": "input",
                    "position": {"x": 40, "y": 190},
                    "data": {
                        "label": "选品与目标站点",
                        "labelEn": "SKU & Target Markets",
                        "fields": [
                            {"name": "product", "label": "商品名称", "labelEn": "Product Name", "type": "text", "required": True},
                            {"name": "markets", "label": "目标站点（逗号分隔）", "labelEn": "Target Markets (CSV)", "type": "text", "required": True},
                        ],
                        "sampleInputs": {
                            "product": "AURA Pro 旗舰级自适应主动降噪耳机",
                            "markets": "EN-US, JA-JP, DE-DE",
                        },
                    },
                },
                {
                    "id": "kb_local",
                    "type": "knowledge",
                    "position": {"x": 370, "y": 190},
                    "data": {
                        "label": "多国本地化规范",
                        "labelEn": "Localization Rules RAG",
                        "queryTemplate": "跨境电商 本地化 美区 日区 德区",
                        "topK": 2,
                        "docIds": ["kb-market-research-2026"],
                    },
                },
                {
                    "id": "loop_markets",
                    "type": "loop",
                    "position": {"x": 710, "y": 190},
                    "data": {
                        "label": "多站点批量生成器",
                        "labelEn": "Batch Market Iterator",
                        "sourceTemplate": "{{input.markets}}",
                        "delimiter": ",",
                        "itemTemplate": "### 🌍 站点 #{{index}} · {{item}} — {{input.product}}\n- **高转化主标题**：[{{item}} Edition] {{input.product}} · 48dB 深度降噪 / 60H 长续航\n- **本地化核心卖点**：精准贴合 {{item}} 消费习惯，突出工业质感、合规质保与零延迟连接\n- **SEO 关键词**：`#{{item}}` `#ANC` `#FlagshipAudio`",
                    },
                },
                {
                    "id": "out_ecom",
                    "type": "output",
                    "position": {"x": 1060, "y": 190},
                    "data": {
                        "label": "全球 Listing 发布包",
                        "labelEn": "Global Listings Pack",
                        "title": "多站点跨境爆款 Listing 交付包",
                        "template": "# {{input.product}} · 多站点批量 Listing\n\n{{loop_markets.output}}\n\n---\n\n### 📚 参考本地化规范\n{{kb_local.output}}",
                        "format": "markdown",
                    },
                },
            ],
            "edges": [
                {"id": "e-ec-1", "source": "in_ecom", "target": "kb_local", "type": "glow"},
                {"id": "e-ec-2", "source": "kb_local", "target": "loop_markets", "type": "glow"},
                {"id": "e-ec-3", "source": "loop_markets", "target": "out_ecom", "type": "glow"},
            ],
        },
    },
    # --- TEMPLATE #9: Human-in-the-Loop (HITL) Approval Gate Showcase ---
    {
        "id": "tpl-hitl-approval",
        "name": "高危法务与付款人工审批门控流（HITL）",
        "name_en": "Human-in-the-Loop Legal & Payout Approval",
        "description": "演示真实的人工审批暂停与恢复（HITL）：AI 起草红线修订方案后自动暂停，等待法务/财务负责人在线审阅微调并点击放行，再流向终态输出。",
        "description_en": "Real mid-flight Human-in-the-Loop pause & resume: AI drafts remediation, pauses at Approval Gate for human edits, then completes downstream.",
        "category": "legal",
        "is_template": True,
        "graph_json": {
            "nodes": [
                {
                    "id": "in_hitl",
                    "type": "input",
                    "position": {"x": 40, "y": 210},
                    "data": {
                        "label": "高危合同/付款审批单",
                        "labelEn": "Approval Request Input",
                        "fields": [
                            {"name": "contract_title", "label": "审批事项标题", "labelEn": "Request Title", "type": "text", "required": True},
                            {"name": "contract_text", "label": "核心条款与金额详情", "labelEn": "Details & Clauses", "type": "textarea", "required": True},
                        ],
                        "sampleInputs": {
                            "contract_title": "年度算力采购与 SLA 补充协议（¥120万）",
                            "contract_text": "供应商要求预付 60% 货款且不设违约赔偿上限，同时保留单方调整单价的权利。",
                        },
                    },
                },
                {
                    "id": "llm_draft_hitl",
                    "type": "llm",
                    "position": {"x": 380, "y": 210},
                    "data": {
                        "label": "AI 风控红线起草官",
                        "labelEn": "AI Risk Redline Drafter",
                        "role": "contract_high_risk",
                        "model": "deepseek-chat",
                        "temperature": 0.3,
                        "systemPrompt": "识别付款与法律风控红线并起草修正案。",
                        "userPrompt": "事项：{{input.contract_title}}\n详情：{{input.contract_text}}",
                    },
                },
                {
                    "id": "hitl_gate",
                    "type": "approval",
                    "position": {"x": 740, "y": 210},
                    "data": {
                        "label": "法务总监人工审批门控",
                        "labelEn": "VP Legal Approval Gate",
                        "sourceTemplate": "{{llm_draft_hitl.output}}",
                        "instructions": "请核对 AI 拟定的风控修订条款，可直接在线修改文本后点击「批准放行」继续生成最终签批函。",
                    },
                },
                {
                    "id": "out_hitl",
                    "type": "output",
                    "position": {"x": 1110, "y": 210},
                    "data": {
                        "label": "已签批终稿函件",
                        "labelEn": "Approved Final Memo",
                        "title": "人工审签通过 · 风控终稿",
                        "template": "# ✅ 已通过人工复核审批 — {{input.contract_title}}\n\n{{hitl_gate.output}}",
                        "format": "markdown",
                    },
                },
                {
                    "id": "note_hitl",
                    "type": "note",
                    "position": {"x": 740, "y": 25},
                    "data": {
                        "label": "HITL 实时暂停说明",
                        "content": "运行到此金色节点时，后端异步任务将挂起等待人工介入；你可以在右侧演练场在线改写内容后点击「批准并继续」或「驳回」。",
                        "color": "amber",
                    },
                },
            ],
            "edges": [
                {"id": "e-ht-1", "source": "in_hitl", "target": "llm_draft_hitl", "type": "glow"},
                {"id": "e-ht-2", "source": "llm_draft_hitl", "target": "hitl_gate", "type": "glow"},
                {"id": "e-ht-3", "source": "hitl_gate", "target": "out_hitl", "type": "glow"},
            ],
        },
    },
]

SEED_EVAL_CASES = [
    {
        "id": "eval-comp-1",
        "workflow_id": "tpl-competitor-report",
        "name": "竞品研报完整性与对比矩阵校验",
        "inputs_json": {
            "company": "Dify Enterprise",
            "industry": "企业级 AI 工作流",
            "audience": "研发负责人",
        },
        "assertions_json": [
            {"type": "no_errors", "value": ""},
            {"type": "contains", "value": "Dify Enterprise"},
            {"type": "contains", "value": "90 天"},
            {"type": "min_length", "value": "300"},
            {"type": "branch_taken", "value": "llm_executive"},
        ],
    },
    {
        "id": "eval-contract-high",
        "workflow_id": "tpl-contract-review",
        "name": "高危条款必须命中 True 红线修订分支",
        "inputs_json": {
            "contract_title": "高风险外包协议",
            "contract_text": "乙方承担无限连带赔偿责任，甲方可随时单方解除合同并收取 50% 违约金。",
        },
        "assertions_json": [
            {"type": "no_errors", "value": ""},
            {"type": "branch_taken", "value": "llm_high_risk"},
            {"type": "contains", "value": "红灯"},
        ],
    },
    {
        "id": "eval-contract-low",
        "workflow_id": "tpl-contract-review",
        "name": "常规合规条款必须路由至 False 放行分支",
        "inputs_json": {
            "contract_title": "标准年度咨询协议",
            "contract_text": "双方友好协商履行常规咨询交付与按期开票结算义务，遵守标准保密条款。",
        },
        "assertions_json": [
            {"type": "no_errors", "value": ""},
            {"type": "branch_taken", "value": "llm_low_risk"},
            {"type": "contains", "value": "合规"},
        ],
    },
    {
        "id": "eval-intent-sales",
        "workflow_id": "tpl-intent-router",
        "name": "3路意图分类器精准路由商务报价专家",
        "inputs_json": {
            "customer_name": "周总监",
            "message": "我们 100 人团队需要企业私有化部署报价套餐与 Demo",
        },
        "assertions_json": [
            {"type": "no_errors", "value": ""},
            {"type": "branch_taken", "value": "llm_hub_sales"},
            {"type": "contains", "value": "报价"},
        ],
    },
]

SEED_SCHEDULES = [
    {
        "id": "sch-daily-intel",
        "workflow_id": "tpl-market-intel",
        "name": "每日早 09:00 财经研报自动推送",
        "cron_expression": "0 9 * * 1-5",
        "inputs_json": {"company": "Enterprise AI SaaS", "industry": "企业级 AI 软件"},
        "webhook_token": "whsec_synthflow_daily_intel_demo",
        "is_enabled": True,
    }
]


async def seed_database(session: AsyncSession) -> None:
    """Idempotently upsert all 9 flagship workflow templates, 3 knowledge docs, eval cases, and schedules."""
    existing_wfs = {
        wf.id: wf
        for wf in (await session.execute(select(Workflow))).scalars().all()
    }
    for tpl in SEED_WORKFLOWS:
        existing = existing_wfs.get(tpl["id"])
        if existing is None:
            session.add(Workflow(**tpl))
        elif existing.is_template:
            # Keep built-in template definitions up to date with latest bug fixes & schema improvements
            existing.name = tpl["name"]
            existing.name_en = tpl["name_en"]
            existing.description = tpl["description"]
            existing.description_en = tpl["description_en"]
            existing.category = tpl["category"]
            existing.graph_json = tpl["graph_json"]

    existing_kb_ids = set((await session.execute(select(KnowledgeDoc.id))).scalars().all())
    for doc in SEED_KNOWLEDGE_DOCS:
        if doc["id"] not in existing_kb_ids:
            session.add(
                KnowledgeDoc(
                    id=doc["id"],
                    title=doc["title"],
                    content=doc["content"],
                    chunks_json=chunk_document(doc["content"]),
                )
            )

    existing_eval_ids = set((await session.execute(select(EvalCase.id))).scalars().all())
    for ev in SEED_EVAL_CASES:
        if ev["id"] not in existing_eval_ids:
            session.add(EvalCase(**ev))

    existing_sch_ids = set((await session.execute(select(WorkflowSchedule.id))).scalars().all())
    for sch in SEED_SCHEDULES:
        if sch["id"] not in existing_sch_ids:
            session.add(WorkflowSchedule(**sch))

    cfg = await session.get(ProviderConfig, "default")
    if cfg is None:
        settings = get_settings()
        has_env_openai = bool(settings.openai_base_url and settings.openai_api_key)
        session.add(
            ProviderConfig(
                id="default",
                name="OpenAI Compatible" if has_env_openai else "SynthFlow Demo Engine",
                provider_mode="OPENAI_COMPAT" if has_env_openai else "DEMO",
                base_url=settings.openai_base_url or "",
                encrypted_api_key=encrypt_secret(settings.openai_api_key) if settings.openai_api_key else "",
                default_model=settings.openai_default_model or "deepseek-chat",
                is_active=True,
            )
        )

    await session.commit()
