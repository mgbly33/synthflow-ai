from __future__ import annotations

import ipaddress
import json
import socket
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx


class SSRFBlockedError(ValueError):
    """Raised when an HTTP Tool URL targets a blocked scheme, host, or private/internal IP."""


_BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
    "metadata",
}

_BLOCKED_SUFFIXES = (".local", ".internal", ".localhost", ".lan", ".home", ".arpa")


def _check_ip_allowed(ip_str: str) -> None:
    ip = ipaddress.ip_address(ip_str)
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        raise SSRFBlockedError(
            f"SSRF 防护拦截：禁止请求内网/回环/保留 IP 地址 ({ip_str}) / Blocked private or reserved IP: {ip_str}"
        )


def validate_url_ssrf(url: str, resolve_dns: bool = True) -> str:
    """Validate URL scheme, hostname, and resolved IP addresses against SSRF."""
    if not url or not isinstance(url, str):
        raise SSRFBlockedError("URL 不能为空 / URL cannot be empty")

    cleaned = url.strip()
    parsed = urlparse(cleaned)

    if parsed.scheme.lower() != "https":
        raise SSRFBlockedError(
            f"SSRF 防护拦截：仅允许安全的 HTTPS 协议，当前为 '{parsed.scheme}' / Only HTTPS scheme is allowed"
        )

    hostname = (parsed.hostname or "").strip().lower()
    if not hostname:
        raise SSRFBlockedError("无效 URL：缺少主机名 / Invalid URL: missing hostname")

    if hostname in _BLOCKED_HOSTNAMES or any(hostname.endswith(sfx) for sfx in _BLOCKED_SUFFIXES):
        raise SSRFBlockedError(
            f"SSRF 防护拦截：禁止访问本地或内部域名 ({hostname}) / Blocked internal hostname: {hostname}"
        )

    # Direct IP literal check
    parsed_ip = None
    try:
        parsed_ip = ipaddress.ip_address(hostname)
    except ValueError:
        parsed_ip = None

    if parsed_ip is not None:
        _check_ip_allowed(hostname)
        return cleaned

    if resolve_dns:
        try:
            addr_info = socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM)
            for _, _, _, _, sockaddr in addr_info:
                ip_addr = sockaddr[0]
                _check_ip_allowed(ip_addr)
        except SSRFBlockedError:
            raise
        except socket.gaierror:
            # DNS resolution failed (e.g., offline environment); allow sandbox mode or let httpx raise cleanly
            pass

    return cleaned


async def execute_http_node(
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: str | None = None,
    sandbox_mode: bool = True,
    timeout: float = 12.0,
) -> str:
    """Execute an SSRF-validated HTTP request or return a realistic safe sandbox JSON payload."""
    # Always enforce SSRF protection even in sandbox mode so security rules are strictly upheld
    safe_url = validate_url_ssrf(url, resolve_dns=not sandbox_mode)
    verb = (method or "GET").upper()
    if verb not in {"GET", "POST"}:
        raise SSRFBlockedError(f"仅支持 GET 或 POST 方法 / Unsupported HTTP method: {verb}")

    if sandbox_mode:
        parsed = urlparse(safe_url)
        payload = {
            "status": 200,
            "mode": "sandbox_mock",
            "request": {
                "method": verb,
                "url": safe_url,
                "host": parsed.hostname,
            },
            "data": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "market_signal": "positive_momentum",
                "benchmark_index": 87.4,
                "active_enterprise_accounts": 1240,
                "yoy_growth_rate": "+38.6%",
                "summary": f"Sandbox verified response from {parsed.hostname}{parsed.path or '/'}",
            },
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)

    req_headers = {"User-Agent": "SynthFlow-Workflow-Engine/1.0"}
    if headers:
        req_headers.update(headers)

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        if verb == "POST":
            try:
                json_body = json.loads(body) if body else None
                resp = await client.post(safe_url, headers=req_headers, json=json_body)
            except json.JSONDecodeError:
                resp = await client.post(safe_url, headers=req_headers, content=body or "")
        else:
            resp = await client.get(safe_url, headers=req_headers)

    content_type = resp.headers.get("content-type", "")
    result: dict[str, Any] = {
        "status": resp.status_code,
        "url": safe_url,
        "content_type": content_type,
    }
    if "application/json" in content_type:
        try:
            result["data"] = resp.json()
        except Exception:
            result["body"] = resp.text[:4000]
    else:
        result["body"] = resp.text[:4000]

    return json.dumps(result, ensure_ascii=False, indent=2)
