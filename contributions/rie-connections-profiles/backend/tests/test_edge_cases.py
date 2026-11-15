"""Error paths and less-travelled branches of Connections and Profiles, plus auth/consent guards."""
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from conftest import DEMO_PASSWORD, find_alumni, incoming_pending, login, user_id

from app import main as app_main
from app.config import settings
from app.database import SessionLocal
from app.models import User
from app.services import llm


def future(days=3):
    return (datetime.now() + timedelta(days=days)).replace(microsecond=0).isoformat()


# ---------------------------------------------------------------- auth guards
def test_expired_and_orphaned_tokens_are_rejected(client):
    expired = jwt.encode(
        {"sub": "1", "role": "student", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.secret_key, algorithm="HS256",
    )
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    ghost = jwt.encode(
        {"sub": "99999", "role": "student", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        settings.secret_key, algorithm="HS256",
    )
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {ghost}"}).status_code == 401
    forged = jwt.encode({"sub": "1", "role": "student"}, "some-other-key-of-sufficient-length-123", algorithm="HS256")
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


# ---------------------------------------------------------------- profiles
def test_name_update_and_empty_values(client, student):
    r = client.put("/profiles/me", headers=student, json={"full_name": "  Alex   J.  Chen ", "bio": None})
    assert r.status_code == 200
    body = r.json()
    assert body["full_name"] == "Alex J. Chen"
    assert body["student"]["bio"]  # None is ignored rather than wiping the field
    assert client.get("/auth/me", headers=student).json()["full_name"] == "Alex J. Chen"


def test_new_user_gets_empty_profile_and_default_headline(client):
    r = client.post("/auth/register", json={"email": "fresh.alum@example.com", "password": "longpassword1",
                                             "full_name": "Fresh Alum", "role": "alumni"})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    me = client.get("/profiles/me", headers=headers).json()
    assert me["headline"] == "USC alum" and me["alumni"]["skills"] == [] and me["resume"] is None
    client.put("/profiles/me", headers=headers, json={"current_company": "Northwind Labs"})
    assert client.get("/profiles/me", headers=headers).json()["headline"] == "Northwind Labs"


def test_resume_filename_normalized_and_missing_file(client, student):
    pdf = b"%PDF-1.4\n%%EOF\n"
    r = client.put("/profiles/me/resume", headers=student, files={"file": ("../../etc/my_cv", pdf, "application/pdf")})
    assert r.status_code == 200
    assert r.json()["filename"] == ".._.._etc_my_cv.pdf"  # no path separators survive
    # If the stored file disappears from disk, downloads fail cleanly instead of erroring.
    with SessionLocal() as db:
        stored = db.query(User).filter_by(email="alex.chen@student.example.com").one().student_profile.resume_stored_name
    (settings.upload_dir / stored).unlink()
    me_id = user_id(client, student)
    assert client.get(f"/profiles/{me_id}/resume", headers=student).status_code == 404


def test_alumni_have_no_resume_endpoint_access(client, student, alumni):
    sarah_id = user_id(client, alumni)
    assert client.get(f"/profiles/{sarah_id}/resume", headers=student).status_code == 404
    assert client.delete("/profiles/me/resume", headers=alumni).status_code == 403


# ---------------------------------------------------------------- discovery
def test_student_search_filters(client, student):
    def names(**params):
        return {s["full_name"] for s in client.get("/connections/students", params=params, headers=student).json()["items"]}

    assert names(interest="product") == {"Priya Patel"}
    assert names(skill="statistics") == {"Mia Nguyen"}
    assert names(major="film") == {"Jordan Rivera"}
    assert names(q="security engineer") == {"Sofia Martinez"}
    assert names(q="nothing-matches-this") == set()


def test_alumni_sort_options(client, student):
    by_year = client.get("/connections/alumni", params={"sort": "graduation_year"}, headers=student).json()["items"]
    years = [c["graduation_year"] for c in by_year]
    assert years == sorted(years, reverse=True)
    by_name = client.get("/connections/alumni", params={"sort": "name"}, headers=student).json()["items"]
    assert [c["full_name"] for c in by_name] == sorted(c["full_name"] for c in by_name)


# ---------------------------------------------------------------- connection requests
def test_connection_request_errors(client, student, alumni):
    assert client.post("/connections/requests", headers=student, json={"addressee_id": 99999}).status_code == 404
    assert client.patch("/connections/requests/99999", headers=student, json={"action": "accept"}).status_code == 404
    pending = incoming_pending(client, student)
    client.patch(f"/connections/requests/{pending['id']}", headers=student, json={"action": "decline"})
    again = client.patch(f"/connections/requests/{pending['id']}", headers=student, json={"action": "accept"})
    assert again.status_code == 409
    # an outsider can't even see that the request exists
    outsider = login(client, "kevin.tran@alumni.example.com")
    assert client.patch(f"/connections/requests/{pending['id']}", headers=outsider,
                        json={"action": "accept"}).status_code == 404


def test_declined_request_clears_status_and_allows_retry(client, student):
    mia = next(s for s in client.get("/connections/students", headers=student).json()["items"]
               if s["full_name"] == "Mia Nguyen")
    assert mia["connection_status"] == "pending_incoming"
    req = incoming_pending(client, student)
    client.patch(f"/connections/requests/{req['id']}", headers=student, json={"action": "decline"})
    mia = next(s for s in client.get("/connections/students", headers=student).json()["items"]
               if s["full_name"] == "Mia Nguyen")
    assert mia["connection_status"] is None
    assert client.post("/connections/requests", headers=student, json={"addressee_id": mia["user_id"]}).status_code == 201


# ---------------------------------------------------------------- coffee chats
def test_coffee_chat_edge_cases(client, student, alumni):
    sarah_id = user_id(client, alumni)
    david = find_alumni(client, student, "David Okafor")
    assert client.post("/connections/coffee-chats", headers=alumni,
                       json={"recipient_id": david["user_id"], "proposed_time": future()}).status_code == 400
    # timezone-aware times are accepted and stored as local wall-clock time
    aware = (datetime.now(timezone.utc) + timedelta(days=2)).replace(microsecond=0).isoformat()
    chat = client.post("/connections/coffee-chats", headers=student,
                       json={"recipient_id": sarah_id, "proposed_time": aware})
    assert chat.status_code == 201 and "+" not in chat.json()["proposed_time"]
    outgoing = client.get("/connections/coffee-chats", headers=student, params={"direction": "outgoing"}).json()
    assert all(c["direction"] == "outgoing" for c in outgoing["items"])
    assert {c["status"] for c in outgoing["items"]} == {"pending", "declined"}  # new + seeded declined
    cid = chat.json()["id"]
    client.patch(f"/connections/coffee-chats/{cid}", headers=alumni, json={"action": "decline"})
    assert client.patch(f"/connections/coffee-chats/{cid}", headers=student,
                        json={"action": "cancel"}).status_code == 409
    assert client.patch("/connections/coffee-chats/99999", headers=student,
                        json={"action": "cancel"}).status_code == 404


# ---------------------------------------------------------------- messages
def test_inbox_skips_threads_with_deleted_users(client, student):
    with SessionLocal() as db:
        sofia = db.query(User).filter_by(email="sofia.martinez@student.example.com").one()
        db.delete(sofia)
        db.commit()
    inbox = client.get("/connections/messages", headers=student).json()
    assert "Sofia Martinez" not in {t["other"]["full_name"] for t in inbox["items"]}


# ---------------------------------------------------------------- startup + AI consent
def test_startup_does_not_reseed_existing_data(client, monkeypatch):
    monkeypatch.setattr(settings, "seed_demo_data", True)
    monkeypatch.setattr(settings, "demo_user_password", DEMO_PASSWORD)
    app_main.init_db()  # users already exist → no duplicates
    with SessionLocal() as db:
        assert db.query(User).count() == 18
    monkeypatch.setattr(settings, "demo_user_password", None)
    app_main.init_db()  # missing password → seeding skipped with a warning, no crash


def test_llm_only_called_with_key_and_explicit_consent(client, student, monkeypatch):
    calls = []

    def fake_post(url, **kwargs):
        calls.append(kwargs["json"])
        return httpx.Response(200, json={"content": [{"type": "text", "text": "Hi Sarah,\n\nPolished draft.\n\nBest,\nAlex"}]},
                              request=httpx.Request("POST", url))

    monkeypatch.setattr(llm.httpx, "post", fake_post)
    sarah = find_alumni(client, student, "Sarah Kim")

    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    r = client.post("/ai/generate-message", headers=student, json={"alumni_id": sarah["user_id"]})
    assert r.json()["source"] == "template" and calls == []  # key set, but no consent → never called

    r = client.post("/ai/generate-message", headers=student, json={"alumni_id": sarah["user_id"], "use_llm": True})
    assert r.json()["source"] == "llm" and len(calls) == 1
    sent = str(calls[0])
    assert "alex.chen@student.example.com" not in sent  # emails are never sent to the provider

    def failing_post(url, **kwargs):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(llm.httpx, "post", failing_post)
    r = client.post("/ai/generate-message", headers=student, json={"alumni_id": sarah["user_id"], "use_llm": True})
    assert r.status_code == 200 and r.json()["source"] == "template"  # graceful fallback


def test_llm_explanations_with_consent(client, student, monkeypatch):
    def fake_post(url, **kwargs):
        return httpx.Response(200, request=httpx.Request("POST", url),
                              json={"content": [{"type": "text", "text": '{"7": "LLM explanation for Sarah."}'}]})

    monkeypatch.setattr(llm.httpx, "post", fake_post)
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    items = client.post("/ai/recommend-alumni", headers=student,
                        json={"career_interests": ["Software Engineering"], "use_llm": True}).json()["items"]
    sarah = next(i for i in items if i["alumni"]["full_name"] == "Sarah Kim")
    assert sarah["explanation_source"] == "llm" and sarah["explanation"] == "LLM explanation for Sarah."
    others = [i for i in items if i["alumni"]["full_name"] != "Sarah Kim"]
    assert all(i["explanation_source"] == "rules" for i in others)


def test_coffee_chat_too_far_ahead(client, student, alumni):
    far = (datetime.now() + timedelta(days=400)).replace(microsecond=0).isoformat()
    r = client.post("/connections/coffee-chats", headers=student,
                    json={"recipient_id": user_id(client, alumni), "proposed_time": far})
    assert r.status_code == 422 and "12 months" in r.json()["detail"]


def test_unexpected_errors_return_json_500(client, student, monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from app.routers import connections as conn_router

    def boom(*args, **kwargs):
        raise RuntimeError("database exploded with secret internals")

    monkeypatch.setattr(conn_router, "connection_statuses", boom)
    with TestClient(create_app(run_startup=False), raise_server_exceptions=False) as c:
        r = c.get("/connections/alumni", headers=student)
    assert r.status_code == 500
    assert r.json() == {"detail": "Something went wrong on the server. Please try again."}
    assert "secret" not in r.text


def test_health_checks_database(client):
    assert client.get("/health").json() == {"status": "ok", "database": "ok"}


def test_alumni_pagination(client, student):
    page1 = client.get("/connections/alumni", params={"limit": 5, "offset": 0, "sort": "name"}, headers=student).json()
    page2 = client.get("/connections/alumni", params={"limit": 5, "offset": 5, "sort": "name"}, headers=student).json()
    assert page1["total"] == page2["total"] == 12
    assert len(page1["items"]) == 5 and not {c["user_id"] for c in page1["items"]} & {c["user_id"] for c in page2["items"]}
    assert client.get("/connections/alumni", params={"limit": 0}, headers=student).status_code == 422
