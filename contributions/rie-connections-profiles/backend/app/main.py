"""TrojanLink AI — FastAPI application entry point.

Run:  uvicorn app.main:app --reload   (from the backend/ directory)
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from . import models  # noqa: F401  (register tables)
from .config import settings
from .database import Base, SessionLocal, engine
from .routers import ai, auth, connections, messages, profiles
from .services.seed import seed_demo

logger = logging.getLogger("trojanlink")

DESCRIPTION = """
USC-focused networking between students and alumni: authentication, profiles (with resume
management and settings), connections, coffee chats, direct messages, and AI-assisted
alumni recommendations / introductions.

**Demo data is entirely fictional. Accounts are self-registered and are not USC-verified.**

Authorize with the `access_token` from `POST /auth/login` (click **Authorize**, paste the token).
"""


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    if settings.seed_demo_data:
        if not settings.demo_user_password:
            logger.warning("SEED_DEMO_DATA is on but DEMO_USER_PASSWORD is not set; skipping demo seed.")
            return
        with SessionLocal() as db:
            if seed_demo(db, settings.demo_user_password):
                logger.info("Seeded fictional demo data.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app(run_startup: bool = True) -> FastAPI:
    app = FastAPI(
        title="TrojanLink AI API",
        version="0.1.0",
        description=DESCRIPTION,
        lifespan=lifespan if run_startup else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(auth.router)
    app.include_router(profiles.router)
    app.include_router(connections.router)
    app.include_router(messages.router)
    app.include_router(ai.router)

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
        # Keep the same {"detail": ...} contract as other errors; never leak internals.
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})

    @app.get("/health", tags=["Meta"])
    def health() -> dict:
        """Liveness + database check, for integration and deployment scripts."""
        try:
            with SessionLocal() as db:
                db.execute(text("SELECT 1"))
            return {"status": "ok", "database": "ok"}
        except Exception:  # pragma: no cover - only when the DB is unreachable
            return JSONResponse(status_code=503, content={"status": "degraded", "database": "unavailable"})

    return app


app = create_app()
