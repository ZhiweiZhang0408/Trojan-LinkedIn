from conftest import DEMO_PASSWORD, login

from app.database import SessionLocal
from app.models import User
from app.services.seed import DEMO_STUDENT_EMAIL


def test_register_student_and_alumni(client):
    for role in ("student", "alumni"):
        r = client.post(
            "/auth/register",
            json={"email": f"new.{role}@example.com", "password": "longpassword1", "full_name": f"New {role}",
                  "role": role},
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["token_type"] == "bearer" and body["access_token"]
        assert body["user"]["role"] == role
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
        assert me.json()["email"] == f"new.{role}@example.com"


def test_register_normalizes_email_and_rejects_duplicates(client):
    payload = {"email": "Case.Test@Example.com", "password": "longpassword1", "full_name": "Case Test",
               "role": "student"}
    assert client.post("/auth/register", json=payload).status_code == 201
    payload["email"] = "case.test@example.com"
    assert client.post("/auth/register", json=payload).status_code == 409


def test_register_validation(client):
    base = {"email": "ok@example.com", "password": "longpassword1", "full_name": "Ok Name", "role": "student"}
    assert client.post("/auth/register", json={**base, "password": "short"}).status_code == 422
    assert client.post("/auth/register", json={**base, "email": "not-an-email"}).status_code == 422
    assert client.post("/auth/register", json={**base, "role": "admin"}).status_code == 422


def test_password_is_hashed(client):
    with SessionLocal() as db:
        user = db.query(User).filter_by(email=DEMO_STUDENT_EMAIL).one()
        assert DEMO_PASSWORD not in user.hashed_password
        assert user.hashed_password.startswith("scrypt$")


def test_login_success_and_failures(client):
    login(client, DEMO_STUDENT_EMAIL)
    bad = client.post("/auth/login", json={"email": DEMO_STUDENT_EMAIL, "password": "wrong-password"})
    assert bad.status_code == 401
    unknown = client.post("/auth/login", json={"email": "nobody@example.com", "password": "whatever1"})
    assert unknown.status_code == 401
    assert bad.json()["detail"] == unknown.json()["detail"]  # no user enumeration


def test_me_requires_valid_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer not.a.jwt"}).status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Basic abc"}).status_code == 401


def test_logout_endpoint(client, student):
    assert client.post("/auth/logout", headers=student).status_code == 204
    assert client.post("/auth/logout").status_code == 401
