from __future__ import annotations

import base64
import hashlib
from pathlib import Path
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import API_ROOT, get_settings

_SECRET_FILE = API_ROOT / ".secret.key"
_cached_fernet: Fernet | None = None


def _derive_fernet_key(raw: str) -> bytes:
    """Accept either a valid Fernet base64 key or derive a deterministic 32-byte key."""
    candidate = raw.strip().encode("utf-8")
    try:
        Fernet(candidate)
        return candidate
    except Exception:
        digest = hashlib.sha256(candidate).digest()
        return base64.urlsafe_b64encode(digest)


def get_fernet() -> Fernet:
    global _cached_fernet
    if _cached_fernet is not None:
        return _cached_fernet

    settings = get_settings()
    if settings.fernet_secret_key:
        key = _derive_fernet_key(settings.fernet_secret_key)
    else:
        if _SECRET_FILE.exists():
            key = _SECRET_FILE.read_bytes().strip()
        else:
            key = Fernet.generate_key()
            _SECRET_FILE.write_bytes(key)
    _cached_fernet = Fernet(key)
    return _cached_fernet


def encrypt_secret(plaintext: str) -> str:
    if not plaintext:
        return ""
    return get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    try:
        return get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


def mask_api_key(plaintext: str) -> str:
    """Return a safe masked key like sk-****89ab without exposing sensitive characters."""
    if not plaintext:
        return ""
    clean = plaintext.strip()
    if len(clean) <= 6:
        return "*" * len(clean)
    prefix = clean[:3] if "-" not in clean[:6] else clean[: clean.index("-") + 1]
    if len(prefix) > 6:
        prefix = clean[:3]
    suffix = clean[-4:]
    return f"{prefix}****{suffix}"
