from datetime import datetime, timedelta

from conftest import find_alumni, login, user_id

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def upload(client, headers, data=PDF, name="Alex_Chen_Resume.pdf", ctype="application/pdf"):
    return client.put("/profiles/me/resume", headers=headers, files={"file": (name, data, ctype)})


def test_upload_view_replace_delete_resume(client, student):
    r = upload(client, student)
    assert r.status_code == 200, r.text
    info = r.json()
    assert info["filename"] == "Alex_Chen_Resume.pdf" and info["size"] == len(PDF)
    assert info["visibility"] == "connections"
    me = client.get("/profiles/me", headers=student).json()
    assert me["resume"]["filename"] == "Alex_Chen_Resume.pdf"
    me_id = me["user_id"]
    dl = client.get(f"/profiles/{me_id}/resume", headers=student)
    assert dl.status_code == 200 and dl.content == PDF and dl.headers["content-type"] == "application/pdf"

    assert upload(client, student, name="v2.pdf").json()["filename"] == "v2.pdf"
    assert client.delete("/profiles/me/resume", headers=student).status_code == 204
    assert client.get("/profiles/me", headers=student).json()["resume"] is None
    assert client.get(f"/profiles/{me_id}/resume", headers=student).status_code == 404
    assert client.delete("/profiles/me/resume", headers=student).status_code == 404


def test_resume_validation(client, student, alumni):
    assert upload(client, student, data=b"not a pdf", name="cv.pdf").status_code == 415
    big = PDF + b"0" * (5 * 1024 * 1024)
    assert upload(client, student, data=big).status_code == 413
    assert upload(client, alumni).status_code == 403  # students only


def test_resume_visibility_rules(client, student, alumni):
    upload(client, student)
    alex_id = user_id(client, student)
    # default "connections": hidden from an unconnected alum
    assert client.get(f"/profiles/{alex_id}", headers=alumni).json()["resume"] is None
    assert client.get(f"/profiles/{alex_id}/resume", headers=alumni).status_code == 404
    # visible after a confirmed coffee chat
    when = (datetime.now() + timedelta(days=2)).replace(microsecond=0).isoformat()
    chat = client.post("/connections/coffee-chats", headers=student,
                       json={"recipient_id": user_id(client, alumni), "proposed_time": when}).json()
    client.patch(f"/connections/coffee-chats/{chat['id']}", headers=alumni, json={"action": "accept"})
    assert client.get(f"/profiles/{alex_id}/resume", headers=alumni).status_code == 200
    # private: nobody else
    client.put("/profiles/me/settings", headers=student, json={"resume_visibility": "private"})
    assert client.get(f"/profiles/{alex_id}/resume", headers=alumni).status_code == 404
    # everyone: any signed-in user
    client.put("/profiles/me/settings", headers=student, json={"resume_visibility": "everyone"})
    kevin = login(client, "kevin.tran@alumni.example.com")
    assert client.get(f"/profiles/{alex_id}/resume", headers=kevin).status_code == 200


def test_settings_defaults_and_update(client, student, alumni):
    s = client.get("/profiles/me/settings", headers=student).json()
    assert s == {"discoverable": True, "show_email_to_connections": True, "resume_visibility": "connections"}
    a = client.get("/profiles/me/settings", headers=alumni).json()
    assert a["resume_visibility"] is None
    assert client.put("/profiles/me/settings", headers=alumni, json={"resume_visibility": "everyone"}).status_code == 422
    assert client.put("/profiles/me/settings", headers=student, json={"resume_visibility": "public"}).status_code == 422


def test_discoverable_hides_from_search_and_recommendations(client, student, alumni):
    client.put("/profiles/me/settings", headers=alumni, json={"discoverable": False})
    names = {c["full_name"] for c in client.get("/connections/alumni", headers=student).json()["items"]}
    assert "Sarah Kim" not in names
    recs = client.post("/ai/recommend-alumni", headers=student,
                       json={"career_interests": ["Software Engineering"]}).json()["items"]
    assert "Sarah Kim" not in {r["alumni"]["full_name"] for r in recs}
    client.put("/profiles/me/settings", headers=student, json={"discoverable": False})
    priya = login(client, "priya.patel@student.example.com")
    assert "Alex Chen" not in {s["full_name"] for s in client.get("/connections/students", headers=priya).json()["items"]}


def test_show_email_setting(client, student, alumni):
    sarah_id = user_id(client, alumni)
    conn = client.post("/connections/requests", headers=student, json={"addressee_id": sarah_id}).json()
    client.patch(f"/connections/requests/{conn['id']}", headers=alumni, json={"action": "accept"})
    assert client.get(f"/profiles/{sarah_id}", headers=student).json()["email"]
    client.put("/profiles/me/settings", headers=alumni, json={"show_email_to_connections": False})
    assert client.get(f"/profiles/{sarah_id}", headers=student).json()["email"] is None


def test_student_experience_and_directory_filters(client, student):
    r = client.put("/profiles/me", headers=student, json={"experience": "Summer intern at a fictional startup"})
    assert r.json()["student"]["experience"] == "Summer intern at a fictional startup"

    def names(**params):
        return {c["full_name"] for c in client.get("/connections/alumni", params=params, headers=student).json()["items"]}

    assert names(degree="M.S.") == {"David Okafor", "Rachel Lee"}
    assert names(graduation_year=2018) == {"Sarah Kim"}
    card = find_alumni(client, student, "Sarah Kim")
    assert card["bio"].startswith("Happy to talk") and "seminar_available" not in card


def test_seminar_endpoints_removed(client, student):
    assert client.get("/connections/seminars", headers=student).status_code == 404
    assert client.post("/connections/seminars/1/register", headers=student).status_code == 404


def test_resume_service_reuse_for_future_modules(client, student):
    """The storage helpers other modules (e.g. Job Posts applications) are expected to reuse."""
    from app.database import SessionLocal
    from app.models import User
    from app.services import resumes

    upload(client, student)
    with SessionLocal() as db:
        sp = db.query(User).filter_by(email="alex.chen@student.example.com").one().student_profile
        assert resumes.read_resume(sp) == PDF
        snap = resumes.snapshot_resume(sp, prefix="application-1")
        assert snap and snap.startswith("application-1-")
    # replacing the profile resume does not change the snapshot
    upload(client, student, data=PDF + b"% v2\n", name="v2.pdf")
    from app.config import settings
    assert (settings.upload_dir / snap).read_bytes() == PDF
    resumes.delete_file(snap)
    assert not (settings.upload_dir / snap).exists()
