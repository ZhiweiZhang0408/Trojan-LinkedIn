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


RESUME = {
    "contact": {"name": "Stu", "email": "stu@usc.edu"},
    "education": [{"school": "USC", "major": "Computer Science", "end": "May 2027"}],
    "experience": [{"company": "Lab", "title": "RA", "bullets": ["Built a scheduler in Go"]}],
    "skills": ["Go", "SQL"],
}


def test_full_flow():
    with TestClient(app) as c:
        # students must use a USC email
        r = c.post("/auth/register", json={"email": "x@gmail.com", "password": "password123",
                                           "full_name": "X", "role": "student"})
        assert r.status_code == 422

        alum = register(c, "alum@alumni.usc.edu", "alumni", company="Acme")
        alum2 = register(c, "alum2@alumni.usc.edu", "alumni", company="Other")
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
               "requirements": "Go, distributed systems",
               "application_instructions": "Apply online, then send me your app ID",
               "deadline": str(date.today() + timedelta(days=10))}
        assert c.post("/jobs", json=job, headers=stu).status_code == 403
        r = c.post("/jobs", json=job, headers=alum)
        assert r.status_code == 201, r.text
        job_id = r.json()["id"]
        assert r.json()["application_instructions"].startswith("Apply online")
        assert "not a guarantee" in r.json()["referral_disclaimer"]
        q_only = c.post("/jobs", json={**job, "role_title": "PM Intern", "referral_available": False},
                        headers=alum).json()["id"]

        # search & filters (requirements are searchable)
        assert c.get("/jobs", params={"q": "swe"}).json()["total"] == 1
        assert c.get("/jobs", params={"q": "distributed"}).json()["total"] == 2
        assert c.get("/jobs", params={"company": "other"}).json()["total"] == 0
        assert c.get("/jobs", params={"referral_available": True}).json()["total"] == 1

        # resumes: manual entry -> confirmed base; drafts can't be sent
        base = c.post("/resumes", json={"content": RESUME}, headers=stu).json()
        assert base["status"] == "confirmed" and not base["is_tailored"]
        draft = c.post("/resumes", json={"content": RESUME, "confirm": False}, headers=stu).json()
        assert c.get(f"/resumes/{base['id']}", headers=stu2).status_code == 404  # private
        assert c.get(f"/resumes/{base['id']}", headers=alum).status_code == 403  # students only

        # tailored version preserves the base
        tailored_content = {**RESUME, "summary": "Go engineer focused on storage"}
        tailored = c.post(f"/resumes/{base['id']}/versions", headers=stu,
                          json={"job_id": job_id, "content": tailored_content}).json()
        assert tailored["parent_id"] == base["id"] and tailored["label"] == "Acme — SWE Intern"
        assert c.get(f"/resumes/{base['id']}", headers=stu).json()["content"]["summary"] is None

        # request validation
        url = f"/jobs/{job_id}/requests"
        assert c.post(url, headers=stu, json={"kind": "referral", "note": "hi"}).status_code == 422  # no resume
        assert c.post(url, headers=stu, json={"note": "hi", "resume_id": draft["id"]}).status_code == 400
        assert c.post(url, headers=stu2, json={"note": "hi", "resume_id": base["id"]}).status_code == 404
        assert c.post(f"/jobs/{q_only}/requests", headers=stu,
                      json={"note": "hi", "resume_id": base["id"]}).status_code == 400  # questions only
        # Ask a Question works without a resume, even on a questions-only post
        r = c.post(f"/jobs/{q_only}/requests", headers=stu2, json={"kind": "question", "note": "Is it remote?"})
        assert r.status_code == 201 and r.json()["resume_snapshot"] is None

        # referral with the tailored version
        r = c.post(url, headers=stu, json={"note": "I'd love a referral", "resume_id": tailored["id"]})
        assert r.status_code == 201, r.text
        req_id = r.json()["id"]
        assert r.json()["resume_snapshot"]["summary"] == "Go engineer focused on storage"
        assert c.post(url, headers=stu, json={"note": "again", "resume_id": base["id"]}).status_code == 409

        # editing the resume after sending does not change the snapshot
        c.patch(f"/resumes/{tailored['id']}", headers=stu, json={"content": {**RESUME, "summary": "changed"}})
        assert c.get(f"/job-requests/{req_id}", headers=alum).json()["resume_snapshot"]["summary"] \
            == "Go engineer focused on storage"

        # job detail shows the student's own thread
        d = c.get(f"/jobs/{job_id}", headers=stu).json()
        assert d["my_request_status"] == "pending" and d["my_request_id"] == req_id

        # permissions: other alum / other student cannot read the thread
        assert c.get(f"/job-requests/{req_id}", headers=alum2).status_code == 403
        assert c.get(f"/job-requests/{req_id}", headers=stu2).status_code == 403
        assert c.get("/job-requests/received", headers=alum2).json() == []

        # thread: follow-up question keeps it pending, then Interested
        c.post(f"/job-requests/{req_id}/messages", headers=alum, json={"body": "Which Go projects?"})
        r = c.post(f"/job-requests/{req_id}/messages", headers=stu, json={"body": "The KV store."})
        assert [m["body"] for m in r.json()["messages"]] == ["Which Go projects?", "The KV store."]
        assert r.json()["status"] == "pending"
        assert c.patch(f"/job-requests/{req_id}/status", headers=stu, json={"status": "interested"}).status_code == 403
        assert c.patch(f"/job-requests/{req_id}/status", headers=alum,
                       json={"status": "interested"}).json()["status"] == "interested"
        assert c.get("/job-requests/sent", headers=stu).json()[0]["status"] == "interested"
        assert c.get("/job-requests/received", headers=alum, params={"job_id": job_id}).json()[0]["id"] == req_id

        # closing the role keeps existing threads usable but blocks new requests
        assert c.post(f"/jobs/{job_id}/close", headers=alum).json()["status"] == "closed"
        assert c.post(f"/job-requests/{req_id}/messages", headers=stu, json={"body": "Thanks!"}).status_code == 201
        assert c.post(url, headers=stu2, json={"kind": "question", "note": "?"}).status_code == 400
        assert c.get("/jobs/mine", headers=alum).json()[-1]["interested_count"] == 1

        # declined threads are read-only
        q_req = c.get("/job-requests/received", headers=alum, params={"job_id": q_only}).json()[0]["id"]
        c.patch(f"/job-requests/{q_req}/status", headers=alum, json={"status": "declined"})
        assert c.post(f"/job-requests/{q_req}/messages", headers=stu2, json={"body": "hi"}).status_code == 400
        assert c.patch(f"/job-requests/{q_req}/status", headers=alum, json={"status": "pending"}).status_code == 400


def test_resume_upload():
    from pathlib import Path

    from scripts.make_sample_resumes import make_pdf

    samples = Path(__file__).resolve().parent.parent / "samples"
    with TestClient(app) as c:
        stu = register(c, "upload.stu@usc.edu", "student")
        other = register(c, "upload.other@usc.edu", "student")
        alum = register(c, "upload.alum@alumni.usc.edu", "alumni")
        base = c.post("/resumes", json={"content": RESUME}, headers=stu).json()

        for name, mime in [("alex_kim_resume.pdf", "application/pdf"),
                           ("alex_kim_resume.docx",
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document")]:
            r = c.post("/resumes/upload", headers=stu, files={"file": (name, (samples / name).read_bytes(), mime)})
            assert r.status_code == 201, r.text
            draft = r.json()
            assert draft["status"] == "draft" and draft["parser"] == "rules"
            assert draft["has_original_file"] and draft["original_filename"] == name
            assert "Raft-based replication" in draft["source_text"]
            content = draft["content"]
            assert content["contact"]["email"] == "alex.kim@usc.edu"
            assert content["education"][0]["school"] == "University of Southern California"
            assert content["experience"][0]["company"] == "USC Viterbi IT"
            assert "Go" in content["skills"]

        # existing base resume is untouched until confirmation
        assert c.get(f"/resumes/{base['id']}", headers=stu).json()["content"]["contact"]["name"] == "Stu"

        # student corrects a field and confirms
        content["contact"]["phone"] = "(213) 555-9999"
        r = c.post(f"/resumes/{draft['id']}/confirm", headers=stu, json={"label": "Base resume", "content": content})
        assert r.json()["status"] == "confirmed" and r.json()["content"]["contact"]["phone"] == "(213) 555-9999"

        # original file: owner only
        assert c.get(f"/resumes/{draft['id']}/file", headers=stu).status_code == 200
        assert c.get(f"/resumes/{draft['id']}/file", headers=other).status_code == 404

        # share the original with a request -> the alum can download it as an attachment
        job_id = c.post("/jobs", headers=alum, json={"company": "Acme", "role_title": "SWE",
                                                      "description": "x"}).json()["id"]
        r = c.post(f"/jobs/{job_id}/requests", headers=stu,
                   json={"note": "hi", "resume_id": draft["id"], "share_original_file": True})
        assert r.json()["has_attachment"] and r.json()["attachment_filename"] == "alex_kim_resume.docx"
        assert c.get(f"/job-requests/{r.json()['id']}/attachment", headers=alum).content.startswith(b"PK")

        # rejected files: wrong type, renamed file, image-only PDF; nothing is saved
        count = len(c.get("/resumes/mine", headers=stu).json())
        assert c.post("/resumes/upload", headers=stu, files={"file": ("cv.doc", b"x", "application/msword")}).status_code == 400
        assert c.post("/resumes/upload", headers=stu, files={"file": ("cv.pdf", b"PK\x03\x04zip", "application/pdf")}).status_code == 422
        r = c.post("/resumes/upload", headers=stu, files={"file": ("scan.pdf", make_pdf([]), "application/pdf")})
        assert r.status_code == 422 and "No readable text" in r.json()["detail"]
        assert len(c.get("/resumes/mine", headers=stu).json()) == count
        assert c.post("/resumes/upload", headers=alum,
                      files={"file": ("a.pdf", make_pdf(), "application/pdf")}).status_code == 403
