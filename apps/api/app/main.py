from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.seed import seed_database
from app.db.session import async_session_factory, init_db
from app.routers import analytics, knowledge, runs, settings as settings_router, studio_pro, workflows


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not hasattr(app.state, "session_factory"):
        app.state.session_factory = async_session_factory
    if not getattr(app.state, "skip_default_init", False):
        await init_db()
        async with app.state.session_factory() as session:
            await seed_database(session)
    yield


def create_app() -> FastAPI:
    cfg = get_settings()
    app = FastAPI(
        title="SynthFlow API",
        version=cfg.app_version,
        description="AI Agent & Visual DAG Workflow Orchestration Engine with Async SSE Streaming",
        lifespan=lifespan,
    )

    app.state.session_factory = async_session_factory
    app.state.demo_delay_ms = cfg.demo_stream_delay_ms

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(workflows.router)
    app.include_router(runs.router)
    app.include_router(knowledge.router)
    app.include_router(settings_router.router)
    app.include_router(analytics.router)
    app.include_router(studio_pro.router)

    @app.get("/api/health", tags=["health"])
    async def health():
        return {"status": "ok", "service": "synthflow-api", "version": cfg.app_version}

    return app


app = create_app()
