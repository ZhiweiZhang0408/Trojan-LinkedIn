import os
import sys
from pathlib import Path

# Configure an isolated in-memory database BEFORE the app is imported.
os.environ["TROJANLINK_SKIP_DOTENV"] = "1"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-key-for-unit-tests-only-0123456789"
os.environ["SEED_DEMO_DATA"] = "false"
os.environ["LLM_API_KEY"] = ""
import tempfile  # noqa: E402

os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="trojanlink-test-uploads-")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.seed import DEMO_ALUMNI_EMAIL, DEMO_STUDENT_EMAIL, seed_demo  # noqa: E402

DEMO_PASSWORD = "unit-test-demo-pw"


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo(db, DEMO_PASSWORD)
    with TestClient(create_app(run_startup=False)) as c:
        yield c


def login(client, email, password=DEMO_PASSWORD):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def student(client):
    return login(client, DEMO_STUDENT_EMAIL)


@pytest.fixture()
def alumni(client):
    return login(client, DEMO_ALUMNI_EMAIL)


def user_id(client, headers):
    return client.get("/auth/me", headers=headers).json()["id"]


def find_alumni(client, headers, name):
    items = client.get("/connections/alumni", params={"q": name}, headers=headers).json()["items"]
    return next(i for i in items if i["full_name"] == name)


def incoming_pending(client, headers):
    """The first pending connection request someone sent to `headers`' user."""
    items = client.get("/connections/requests", headers=headers, params={"status": "pending"}).json()["items"]
    return next(c for c in items if c["direction"] == "incoming")
