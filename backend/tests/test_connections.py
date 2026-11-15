"""Connections and profiles: invitations, decisions, messages, privacy and the frontend body shapes."""
from fastapi.testclient import TestClient

from app.main import app
from tests.test_flow import register


def setup(c, tag):
    student = register(c, f"student.{tag}@usc.edu", "student", major="Computer Science", grad_year=2027)
    alum = register(c, f"alum.{tag}@alumni.usc.edu", "alumni", company="Nimbus Cloud", title="Engineer")
    other_alum = register(c, f"other.{tag}@alumni.usc.edu", "alumni", company="Lumen", title="Lead")
    alum_id = c.get("/auth/me", headers=alum).json()["id"]
    return student, alum, other_alum, alum_id


def test_profile_accepts_frontend_person_shape():
    with TestClient(app) as c:
        student, alum, _, alum_id = setup(c, "persona")
        # The frontend sends its whole Person object, camelCase, with extra keys
        person = {"id": str(alum_id), "name": "ignored", "color": "rose", "bio": "Happy to help",
                  "skills": ["Go", "go", " Storage "], "openToConnect": True, "coffeeChats": True,
                  "schedulingUrl": "https://example.com/book", "title": "Staff Engineer",
                  "program": "Computer Science", "year": 2018, "location": "Seattle, WA"}
        r = c.patch("/persona/me", json=person, headers=alum)
        assert r.status_code == 200, r.text
        me = r.json()
        assert me["bio"] == "Happy to help" and me["skills"] == ["Go", "Storage"]
        assert me["coffee_chats"] is True and me["title"] == "Staff Engineer" and me["grad_year"] == 2018
        assert me["email"]  # visible to yourself

        # Others see the profile without the email until connected
        seen = c.get(f"/persona/{alum_id}", headers=student).json()
        assert seen["bio"] == "Happy to help" and seen["email"] is None
        assert c.patch("/persona/me", json={"schedulingUrl": "javascript:alert(1)"}, headers=alum).status_code == 422

        directory = c.get("/connections/alumni", params={"q": "storage"}, headers=student).json()
        assert [p["id"] for p in directory] == [alum_id]


def test_invitation_lifecycle_and_messages():
    with TestClient(app) as c:
        student, alum, other_alum, alum_id = setup(c, "life")
        c.patch("/persona/me", json={"coffeeChats": True}, headers=alum)

        # Frontend body: alumniId as a string, client-only fields ignored
        body = {"id": "client-uid", "kind": "connection", "studentId": "999", "alumniId": str(alum_id),
                "purpose": "coffee", "note": "Hi!", "topic": "Systems careers",
                "availability": "Tue 3pm PT", "status": "accepted"}
        r = c.post("/connections/requests", json=body, headers=student)
        assert r.status_code == 201, r.text
        inv = r.json()
        assert inv["status"] == "pending" and inv["purpose"] == "coffee" and inv["alumni"]["id"] == alum_id
        cid = inv["id"]

        # One active invitation per pair; alumni can't invite
        assert c.post("/connections/requests", json=body, headers=student).status_code == 409
        assert c.post("/connections/requests", json=body, headers=alum).status_code == 403

        # No messages before acceptance; other alumni can't see or decide
        assert c.post(f"/connections/requests/{cid}/messages", json={"body": "hello"},
                      headers=student).status_code == 409
        assert c.patch(f"/connections/requests/{cid}/decision", json={"status": "accepted"},
                       headers=other_alum).status_code == 404
        assert c.get("/connections/requests", headers=other_alum).json() == []

        assert c.get("/connections/requests", headers=student).json()[0]["alumni_email"] is None
        r = c.patch(f"/connections/requests/{cid}/decision",
                    json={"status": "accepted", "reply": "Sounds great"}, headers=alum)
        assert r.status_code == 200 and r.json()["status"] == "accepted"
        assert r.json()["alumni_email"].startswith("alum.") and r.json()["student_email"].startswith("student.")
        assert [m["body"] for m in r.json()["messages"]] == ["Sounds great"]
        assert c.patch(f"/connections/requests/{cid}/decision", json={"status": "declined"},
                       headers=alum).status_code == 409

        r = c.post(f"/connections/requests/{cid}/messages", json={"body": "Thanks!"}, headers=student)
        assert r.status_code == 201 and len(r.json()["messages"]) == 2
        # Email becomes visible once connected
        assert c.get(f"/persona/{alum_id}", headers=student).json()["email"]

        # Remove keeps history readable but closes messaging
        assert c.patch(f"/connections/requests/{cid}", json={"action": "remove"},
                       headers=alum).json()["status"] == "removed"
        assert c.post(f"/connections/requests/{cid}/messages", json={"body": "?"},
                      headers=student).status_code == 409
        assert len(c.get("/connections/requests", headers=student).json()[0]["messages"]) == 2


def test_availability_and_withdraw_rules():
    with TestClient(app) as c:
        student, alum, _, alum_id = setup(c, "rules")
        c.patch("/persona/me", json={"openToConnect": False, "coffeeChats": False}, headers=alum)
        body = {"alumniId": alum_id, "purpose": "connection", "note": "Hi"}
        assert c.post("/connections/requests", json=body, headers=student).status_code == 409
        c.patch("/persona/me", json={"openToConnect": True}, headers=alum)
        assert c.post("/connections/requests", json={**body, "purpose": "coffee"},
                      headers=student).status_code == 409  # coffee chats still off

        cid = c.post("/connections/requests", json=body, headers=student).json()["id"]
        assert c.patch(f"/connections/requests/{cid}", json={"action": "withdraw"},
                       headers=alum).status_code == 409  # only the sender withdraws
        assert c.patch(f"/connections/requests/{cid}", json={"action": "withdraw"},
                       headers=student).json()["status"] == "withdrawn"
        # A withdrawn invitation frees the pair for a new one
        assert c.post("/connections/requests", json=body, headers=student).status_code == 201
