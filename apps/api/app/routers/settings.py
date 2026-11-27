from __future__ import annotations

import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_secret, encrypt_secret, mask_api_key
from app.db.session import get_db
from app.models.models import ProviderConfig
from app.schemas.schemas import (
    ProviderConfigResponse,
    ProviderConfigUpdate,
    ProviderTestRequest,
    ProviderTestResponse,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _to_response(cfg: ProviderConfig) -> ProviderConfigResponse:
    plain = decrypt_secret(cfg.encrypted_api_key) if cfg.encrypted_api_key else ""
    mode = "OPENAI_COMPAT" if cfg.provider_mode == "OPENAI_COMPAT" else "DEMO"
    return ProviderConfigResponse(
        id=cfg.id,
        name=cfg.name,
        provider_mode=mode,
        base_url=cfg.base_url,
        masked_api_key=mask_api_key(plain),
        has_api_key=bool(plain),
        default_model=cfg.default_model,
        is_active=cfg.is_active,
        updated_at=cfg.updated_at,
    )


async def _get_or_create_default(db: AsyncSession) -> ProviderConfig:
    cfg = await db.get(ProviderConfig, "default")
    if cfg is None:
        cfg = ProviderConfig(
            id="default",
            name="SynthFlow Demo Engine",
            provider_mode="DEMO",
            base_url="",
            encrypted_api_key="",
            default_model="deepseek-chat",
            is_active=True,
        )
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg


@router.get("/provider", response_model=ProviderConfigResponse)
async def get_provider_config(db: AsyncSession = Depends(get_db)) -> ProviderConfigResponse:
    cfg = await _get_or_create_default(db)
    return _to_response(cfg)


@router.put("/provider", response_model=ProviderConfigResponse)
async def update_provider_config(
    payload: ProviderConfigUpdate, db: AsyncSession = Depends(get_db)
) -> ProviderConfigResponse:
    cfg = await _get_or_create_default(db)
    cfg.name = payload.name.strip() or "Custom Provider"
    cfg.provider_mode = payload.provider_mode
    cfg.base_url = payload.base_url.strip()
    cfg.default_model = payload.default_model.strip() or "gpt-4o-mini"

    if payload.clear_api_key:
        cfg.encrypted_api_key = ""
    elif payload.api_key is not None and payload.api_key.strip() != "":
        cfg.encrypted_api_key = encrypt_secret(payload.api_key.strip())

    cfg.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(cfg)
    return _to_response(cfg)


@router.post("/provider/test", response_model=ProviderTestResponse)
async def test_provider_connection(
    payload: ProviderTestRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ProviderTestResponse:
    t0 = time.perf_counter()
    api_key = (payload.api_key or "").strip()
    if not api_key:
        cfg = await _get_or_create_default(db)
        if cfg.encrypted_api_key:
            api_key = decrypt_secret(cfg.encrypted_api_key)

    endpoint = payload.base_url.strip().rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint = f"{endpoint}/chat/completions"

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req_body = {
        "model": payload.model or "gpt-4o-mini",
        "messages": [{"role": "user", "content": "Reply with 'OK' only."}],
        "max_tokens": 16,
        "temperature": 0,
        "stream": False,
    }

    injected_client = getattr(request.app.state, "llm_http_client", None)
    owns_client = injected_client is None
    client = injected_client or httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0))

    try:
        resp = await client.post(endpoint, headers=headers, json=req_body)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        if resp.status_code >= 400:
            return ProviderTestResponse(
                ok=False,
                latency_ms=latency_ms,
                message=f"HTTP {resp.status_code}: {resp.text[:240]}",
            )
        data = resp.json()
        reply = ""
        choices = data.get("choices") or []
        if choices:
            reply = (choices[0].get("message") or {}).get("content", "")
        return ProviderTestResponse(
            ok=True,
            latency_ms=latency_ms,
            message="连接成功，模型响应正常 / Connection verified",
            model_reply=reply.strip()[:120],
        )
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        return ProviderTestResponse(
            ok=False,
            latency_ms=latency_ms,
            message=f"连接失败 / Connection error: {exc}",
        )
    finally:
        if owns_client:
            await client.aclose()
