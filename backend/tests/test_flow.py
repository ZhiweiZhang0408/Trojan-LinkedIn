import os
import tempfile
from datetime import date, timedelta

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/uploads"
os.environ["EMAIL_BACKEND"] = "console"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def register(c, email, role, **kw):
    r = c.post("/auth/register", json={"email": email, "password": "password123",
                                       "full_name": email.split("@")[0], "role": role, **kw})
    assert r.status_code == 201, r.text
    code = r.json()["dev_code"]
    r = c.post("/auth/verify-email", json={"email": email, "code": code})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_email_verification():
    with TestClient(app) as c:
        email = "verify.me@usc.edu"
        body = {"email": email, "password": "password123", "full_name": "V", "role": "student"}
        r = c.post("/auth/register", json=body)
        assert r.status_code == 201
        code = r.json()["dev_code"]
        assert len(code) == 6

        # cannot log in before verifying
        r = c.post("/auth/login", json={"email": email, "password": "password123"})
        assert r.status_code == 403 and r.json()["detail"] == "email_not_verified"

        # wrong code
        wrong = "000000" if code != "000000" else "111111"
        assert c.post("/auth/verify-email", json={"email": email, "code": wrong}).status_code == 400
        # resend is rate-limited by a cooldown
        assert c.post("/auth/resend-code", json={"email": email}).status_code == 429
        # unverified accounts can re-register (overwrite); old code is invalidated
        new_code = c.post("/auth/register", json=body).json()["dev_code"]
        if new_code != code:
            assert c.post("/auth/verify-email", json={"email": email, "code": code}).status_code == 400

        r = c.post("/auth/verify-email", json={"email": email, "code": new_code})
        assert r.status_code == 200
        assert r.json()["user"]["is_email_verified"] and r.json()["user"]["is_usc_verified"]
        assert c.post("/auth/login", json={"email": email, "password": "password123"}).status_code == 200
        # cannot register again once verified
        assert c.post("/auth/register", json=body).status_code == 409


def test_too_many_attempts():
    with TestClient(app) as c:
        email = "brute@usc.edu"
        r = c.post("/auth/register", json={"email": email, "password": "password123",
                                           "full_name": "B", "role": "student"})
        code = r.json()["dev_code"]
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            assert c.post("/auth/verify-email", json={"email": email, "code": wrong}).status_code == 400
        # locked out on the 6th attempt even with the right code
        assert c.post("/auth/verify-email", json={"email": email, "code": code}).status_code == 429


def test_full_flow():
    with TestClient(app) as c:
        # students must use a USC email
        r = c.post("/auth/register", json={"email": "x@gmail.com", "password": "password123",
                                           "full_name": "X", "role": "student"})
        assert r.status_code == 422

        alum = register(c, "alum@alumni.usc.edu", "alumni", company="Acme")
        stu = register(c, "stu@usc.edu", "student")
        stu2 = register(c, "stu2@usc.edu", "student")

        # login + /me
        r = c.post("/auth/login", json={"email": "alum@alumni.usc.edu", "password": "password123"})
        assert r.status_code == 200 and r.json()["user"]["is_usc_verified"]
        assert c.post("/auth/login", json={"email": "alum@alumni.usc.edu", "password": "nope1234"}).status_code == 401
        assert c.post("/auth/token", data={"username": "stu@usc.edu", "password": "password123"}).status_code == 200
        assert c.get("/auth/me", headers=stu).json()["role"] == "student"
        assert c.get("/auth/me").status_code == 401

        # students cannot post jobs; alumni can
        job = {"company": "Acme", "role_title": "SWE Intern", "industry": "Technology",
               "location": "Los Angeles, CA", "description": "Build things",
               "deadline": str(date.today() + timedelta(days=10)), "referral_slots": 2}
        assert c.post("/jobs", json=job, headers=stu).status_code == 403
        r = c.post("/jobs", json=job, headers=alum)
        assert r.status_code == 201, r.text
        job_id = r.json()["id"]
        assert "not a guarantee" in r.json()["referral_disclaimer"]

        # search & filters
        assert c.get("/jobs", params={"q": "swe"}).json()["total"] == 1
        assert c.get("/jobs", params={"company": "other"}).json()["total"] == 0
        assert c.get("/jobs", params={"location": "los angeles"}).json()["total"] == 1

        # student requests a referral (with resume)
        note = "I'd love a referral — I built a relevant project last semester."
        r = c.post(f"/jobs/{job_id}/referral-requests", headers=stu,
                   data={"note": note}, files={"resume": ("cv.pdf", b"%PDF-1.4 fake", "application/pdf")})
        assert r.status_code == 201, r.text
        req_id = r.json()["id"]
        assert r.json()["has_resume"]
        # duplicate request rejected; bad file type rejected
        assert c.post(f"/jobs/{job_id}/referral-requests", headers=stu, data={"note": note}).status_code == 409
        assert c.post(f"/jobs/{job_id}/referral-requests", headers=stu2, data={"note": note},
                      files={"resume": ("cv.exe", b"x", "application/octet-stream")}).status_code == 400

        # job detail shows the student's own request status
        assert c.get(f"/jobs/{job_id}", headers=stu).json()["my_request_status"] == "pending"

        # alumni inbox + resume download
        inbox = c.get("/referral-requests/received", headers=alum).json()
        assert len(inbox) == 1 and inbox[0]["note"] == note
        r = c.get(f"/referral-requests/{req_id}/resume", headers=alum)
        assert r.status_code == 200 and r.content.startswith(b"%PDF")
        assert c.get(f"/referral-requests/{req_id}/resume", headers=stu2).status_code == 403

        # accept
        r = c.patch(f"/referral-requests/{req_id}/decision", headers=alum,
                    json={"status": "accepted", "alumni_response": "Referred!"})
        assert r.json()["status"] == "accepted"
        assert c.get("/referral-requests/sent", headers=stu).json()[0]["status"] == "accepted"

        # stu2 requests, then job closes -> pending request auto-closed and job leaves the listing
        r = c.post(f"/jobs/{job_id}/referral-requests", headers=stu2, data={"note": note})
        req2 = r.json()["id"]
        assert c.post(f"/jobs/{job_id}/close", headers=alum).json()["status"] == "filled"
        assert c.get(f"/referral-requests/{req2}", headers=stu2).json()["status"] == "closed"
        assert c.get("/jobs").json()["total"] == 0
        assert c.get("/jobs/mine", headers=alum).json()[0]["accepted_count"] == 1
