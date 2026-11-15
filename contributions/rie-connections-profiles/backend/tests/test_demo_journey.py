"""End-to-end API run of the demo scenario (final MVP scope: no seminars) on the seeded demo database."""
from datetime import datetime, timedelta

from conftest import login

from app.services.seed import DEMO_ALUMNI_EMAIL, DEMO_STUDENT_EMAIL


def test_required_demo_journey(client):
    # 1. A fictional USC student logs in.
    student = login(client, DEMO_STUDENT_EMAIL)
    # 2. The student opens their profile.
    profile = client.get("/profiles/me", headers=student).json()
    assert profile["full_name"] == "Alex Chen"
    # 3. The student selects Software Engineering as a career interest.
    interests = profile["student"]["career_interests"] + ["Software Engineering"]
    r = client.put("/profiles/me", headers=student, json={"career_interests": interests})
    assert "Software Engineering" in r.json()["student"]["career_interests"]
    # 4. The AI recommends relevant fictional alumni.
    recs = client.post("/ai/recommend-alumni", headers=student, json={}).json()["items"]
    sarah = next(r for r in recs if r["alumni"]["full_name"] == "Sarah Kim")
    assert recs.index(sarah) < 3
    # 5. The student opens a recommended alumni profile.
    detail = client.get(f"/profiles/{sarah['alumni']['user_id']}", headers=student).json()
    assert detail["alumni"]["current_company"] == "Brightline Cloud"
    # 6. The student generates a personalized cold message.
    draft = client.post("/ai/generate-message", headers=student,
                        json={"alumni_id": detail["user_id"]}).json()["message"]
    # 7. The student edits the message.
    edited = draft.replace("Thank you for your time!", "Thank you so much for your time — Fight On!")
    # 8. The student submits a coffee chat request.
    when = (datetime.now() + timedelta(days=4)).replace(hour=15, minute=0, second=0, microsecond=0)
    chat = client.post("/connections/coffee-chats", headers=student,
                       json={"recipient_id": detail["user_id"], "proposed_time": when.isoformat(),
                             "message": edited}).json()
    assert chat["status"] == "pending" and "Fight On!" in chat["message"]
    # 9. A fictional alumnus logs in.
    alumni = login(client, DEMO_ALUMNI_EMAIL)
    # 10. The alumnus accepts the request.
    pending = client.get("/connections/coffee-chats", headers=alumni,
                         params={"direction": "incoming", "status": "pending"}).json()["items"]
    target = next(c for c in pending if c["requester"]["full_name"] == "Alex Chen")
    assert client.patch(f"/connections/coffee-chats/{target['id']}", headers=alumni,
                        json={"action": "accept"}).json()["status"] == "accepted"
    # 11. The student sees the confirmed coffee chat.
    confirmed = client.get("/connections/coffee-chats", headers=student, params={"status": "accepted"}).json()
    assert any(c["id"] == chat["id"] for c in confirmed["items"])
    # 12. With the chat confirmed, the student and alumna can exchange messages.
    r = client.post(f"/connections/messages/{detail['user_id']}", headers=student,
                    json={"body": "Thanks for accepting, Sarah! Looking forward to it."})
    assert r.status_code == 201
    reply = client.post(f"/connections/messages/{profile['user_id']}", headers=alumni,
                        json={"body": "Happy to help. See you then!"})
    assert reply.status_code == 201
    convo = client.get(f"/connections/messages/{detail['user_id']}", headers=student).json()
    assert [m["is_mine"] for m in convo["items"]] == [True, False]
