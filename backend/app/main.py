from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS, UPLOAD_DIR
from . import models_connections, models_persona  # noqa: F401  register tables
from .database import Base, engine
from .routers import auth, connections, jobs, persona, requests, resumes


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)  # create any missing tables
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Alumni Referral Board API",
    description="USC alumni post team openings; students request referrals.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,  # Bearer tokens, no cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(resumes.router)
app.include_router(requests.router)
app.include_router(connections.router)  # connections teammate
app.include_router(persona.router)  # persona teammate


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
