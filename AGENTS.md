# SynthFlow — AI 智能体与可视化工作流编排引擎 · 项目宪法

## 独立项目目录隔离硬约束（最高优先级）
- 本项目的所有源码、Python 虚拟环境（`apps/api/.venv`）、前端依赖（`apps/web/node_modules`）、数据库文件、环境变量与测试脚本必须 100% 严格限定在 `projects/synthflow-ai/` 内创建与执行。
- 严禁在父目录散落任何文件，严禁读取、修改或删除同级其他项目文件夹与规划文档。

## 技术架构硬约束
- 前后端分离：`apps/web`（React 19 + TypeScript + Vite + Tailwind CSS + `@xyflow/react` + Zustand + `react-markdown` + `remark-gfm` + `i18next`）与 `apps/api`（Python 3.11+ + FastAPI + SQLAlchemy 2.0 Async + Pydantic v2 + `httpx` + `sse-starlette` + `cryptography`）。
- 数据库默认使用异步 SQLite（`sqlite+aiosqlite:///./synthflow.db`）实现零配置本地运行，同时代码 100% 兼容 PostgreSQL（`postgresql+asyncpg://...`），通过环境变量 `DATABASE_URL` 无缝切换。
- 必须同时支持「免 API Key 高质量演示推理模式（默认开箱即用）」与「兼容 OpenAI 协议的真实大模型流式 API（支持 DeepSeek / OpenAI / Qwen / OpenRouter / Ollama）」。
- 所有敏感 API Key 落盘前必须使用 `cryptography.fernet` 加密，接口返回给前端时仅返回脱敏掩码（如 `sk-****89ab`）。
- `HTTP Tool` 节点必须具备严格 SSRF 防护，禁止访问内网/回环/元数据网段。
- 全站支持中英文双语切换（中 / EN）与暗黑/白日双主题。
