"""JWT access tokens (HS256, signed with SECRET_KEY from the environment)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt

from ..config import settings


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError on invalid or expired tokens."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
