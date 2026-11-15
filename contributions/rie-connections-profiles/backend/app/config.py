"""Application settings, loaded from environment variables (and an optional .env file).

No secrets are hardcoded here. If SECRET_KEY is missing, a random key is generated
for the current process only (tokens stop working after a restart) and a warning is logged.
"""
from __future__ import annotations

import logging
import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger("trojanlink")

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader (KEY=VALUE lines). Existing env vars always win."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    app_name: str = "TrojanLink AI"
    secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8
    database_url: str = "sqlite:///./trojanlink.db"
    cors_origins: list[str] = field(default_factory=list)
    seed_demo_data: bool = True
    demo_user_password: str | None = None
    llm_api_key: str | None = None
    llm_model: str = "claude-haiku-5-5"
    llm_api_url: str = "https://api.anthropic.com/v1/messages"
    upload_dir: Path = BACKEND_DIR / "uploads"
    max_resume_bytes: int = 5 * 1024 * 1024


def load_settings() -> Settings:
    if not os.getenv("TROJANLINK_SKIP_DOTENV"):
        _load_dotenv(BACKEND_DIR / ".env")

    secret = os.getenv("SECRET_KEY", "")
    if not secret:
        secret = secrets.token_urlsafe(48)
        logger.warning("SECRET_KEY is not set; using a random per-process key (local dev only).")

    origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return Settings(
        secret_key=secret,
        access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 8))),
        database_url=os.getenv("DATABASE_URL", "sqlite:///./trojanlink.db"),
        cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
        seed_demo_data=_bool("SEED_DEMO_DATA", True),
        demo_user_password=os.getenv("DEMO_USER_PASSWORD") or None,
        llm_api_key=os.getenv("LLM_API_KEY") or None,
        llm_model=os.getenv("LLM_MODEL", "claude-haiku-5-5"),
        llm_api_url=os.getenv("LLM_API_URL", "https://api.anthropic.com/v1/messages"),
        upload_dir=Path(os.getenv("UPLOAD_DIR") or BACKEND_DIR / "uploads"),
        max_resume_bytes=int(os.getenv("MAX_RESUME_MB", "5")) * 1024 * 1024,
    )


settings = load_settings()
