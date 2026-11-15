"""Single-process entry for hosting (Replit): the API and the built frontend on one origin.

Run from backend/:  uvicorn serve:app --host 0.0.0.0 --port 8000
The API routes in app.main take precedence; every other path serves frontend/dist.
Local development keeps using `uvicorn app.main:app` and the Vite dev server.
"""
from pathlib import Path

from fastapi.staticfiles import StaticFiles

from app.main import app

DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if DIST.is_dir():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
