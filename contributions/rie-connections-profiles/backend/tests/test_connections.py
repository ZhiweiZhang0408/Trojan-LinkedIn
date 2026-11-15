from datetime import datetime, timedelta

from conftest import find_alumni, incoming_pending, login, user_id


def future(days=3):
    return (datetime.now() + timedelta(days=days)).replace(microsecond=0).isoformat()


# ---------------------------------------------------------------- alumni search
def test_alumni_directory_has_cards_with_scores(client, student):
    r = client.get("/connections/alumni", headers=student)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 12 and len(body["items"]) == 12
    card = body["items"][0]
    for key in ("full_name", "current_title", "current_company", "graduation_year", "skills", "match_score"):
        assert key in card
    scores = [c["match_score"] for c in body["items"]]
    assert scores == sorted(scores, reverse=True)
    assert all(0 <= s <= 100 for s in scores)


def test_alumni_search_filters(client, student):
    def names(**params):
        return {c["full_name"] for c in client.get("/connections/alumni", params=params, headers=student).json()["items"]}

    assert names(company="brightline") == {"Sarah Kim", "Olivia Bennett"}
    assert names(industry="finance") == {"Carlos Ramirez"}
    assert names(title="data scientist") == {"Rachel Lee"}
    assert names(skill="pytorch") == {"David Okafor"}
    assert names(skill="python,sql") == {"Rachel Lee", "Aisha Rahman"}
    assert names(interest="cybersecurity") == {"Kevin Tran"}
    assert names(q="robotics") == {"David Okafor"}
    assert "Olivia Bennett" not in names(coffee_chat_only=True)


def test_alumni_view_has_no_match_score(client, alumni):
    items = client.get("/connections/alumni", headers=alumni).json()["items"]
    assert all(i["match_score"] is None for i in items)
    assert "Sarah Kim" not in {i["full_name"] for i in items}  # self excluded


def test_student_discovery(client, student):
    r = client.get("/connections/students", headers=student).json()
    assert r["total"] == 5
    mia = next(s for s in r["items"] if s["full_name"] == "Mia Nguyen")
    assert "Machine Learning" in mia["shared_skills"]
    assert mia["connection_status"] == "pending_incoming"
    sofia = next(s for s in r["items"] if s["full_name"] == "Sofia Martinez")
    assert sofia["connection_status"] == "connected"


# ---------------------------------------------------------------- connection requests
def test_connection_request_flow(client, student, alumni):
    sarah_id = user_id(client, alumni)
    r = client.post("/connections/requests", headers=student, json={"addressee_id": sarah_id, "message": "Hi!"})
    assert r.status_code == 201
    conn = r.json()
    assert conn["status"] == "pending" and conn["direction"] == "outgoing"
    assert client.post("/connections/requests", headers=student, json={"addressee_id": sarah_id}).status_code == 409
    # requester cannot accept their own request
    assert client.patch(f"/connections/requests/{conn['id']}", headers=student, json={"action": "accept"}).status_code == 403
    r = client.patch(f"/connections/requests/{conn['id']}", headers=alumni, json={"action": "accept"})
    assert r.status_code == 200 and r.json()["status"] == "accepted"
    # email becomes visible to accepted connections
    assert client.get(f"/profiles/{sarah_id}", headers=student).json()["email"] == "sarah.kim@alumni.example.com"


def test_connection_rules(client, student, alumni):
    me = user_id(client, student)
    assert client.post("/connections/requests", headers=student, json={"addressee_id": me}).status_code == 400
    david = find_alumni(client, student, "David Okafor")
    assert client.post("/connections/requests", headers=alumni,
                       json={"addressee_id": david["user_id"]}).status_code == 400  # alumni ↔ alumni
    incoming = incoming_pending(client, student)
    assert incoming["requester"]["full_name"] == "Mia Nguyen"
    r = client.patch(f"/connections/requests/{incoming['id']}", headers=student, json={"action": "decline"})
    assert r.json()["status"] == "declined"


# ---------------------------------------------------------------- coffee chats
def test_coffee_chat_request_and_accept(client, student, alumni):
    sarah_id = user_id(client, alumni)
    r = client.post("/connections/coffee-chats", headers=student,
                    json={"recipient_id": sarah_id, "proposed_time": future(), "message": "Hello Sarah"})
    assert r.status_code == 201, r.text
    chat = r.json()
    assert chat["status"] == "pending" and chat["direction"] == "outgoing"

    incoming = client.get("/connections/coffee-chats", headers=alumni,
                          params={"direction": "incoming", "status": "pending"}).json()["items"]
    assert chat["id"] in {c["id"] for c in incoming}

    # the requester cannot accept their own request
    assert client.patch(f"/connections/coffee-chats/{chat['id']}", headers=student,
                        json={"action": "accept"}).status_code == 403
    r = client.patch(f"/connections/coffee-chats/{chat['id']}", headers=alumni,
                     json={"action": "accept", "note": "See you then!"})
    assert r.status_code == 200 and r.json()["status"] == "accepted"
    confirmed = client.get("/connections/coffee-chats", headers=student, params={"status": "accepted"}).json()
    assert confirmed["items"][0]["response_note"] == "See you then!"
    # cannot accept twice
    assert client.patch(f"/connections/coffee-chats/{chat['id']}", headers=alumni,
                        json={"action": "accept"}).status_code == 409
    # either participant may cancel a confirmed chat
    r = client.patch(f"/connections/coffee-chats/{chat['id']}", headers=student, json={"action": "cancel"})
    assert r.json()["status"] == "cancelled"


def test_coffee_chat_decline_and_cancel(client, student, alumni):
    sarah_id = user_id(client, alumni)
    chat = client.post("/connections/coffee-chats", headers=student,
                       json={"recipient_id": sarah_id, "proposed_time": future()}).json()
    # recipient cannot "cancel" a pending request (they decline instead)
    assert client.patch(f"/connections/coffee-chats/{chat['id']}", headers=alumni,
                        json={"action": "cancel"}).status_code == 403
    r = client.patch(f"/connections/coffee-chats/{chat['id']}", headers=alumni, json={"action": "decline"})
    assert r.json()["status"] == "declined"

    chat2 = client.post("/connections/coffee-chats", headers=student,
                        json={"recipient_id": sarah_id, "proposed_time": future(5)}).json()
    r = client.patch(f"/connections/coffee-chats/{chat2['id']}", headers=student, json={"action": "cancel"})
    assert r.json()["status"] == "cancelled"


def test_coffee_chat_validation(client, student, alumni):
    sarah_id = user_id(client, alumni)
    past = (datetime.now() - timedelta(days=1)).isoformat()
    assert client.post("/connections/coffee-chats", headers=student,
                       json={"recipient_id": sarah_id, "proposed_time": past}).status_code == 422
    assert client.post("/connections/coffee-chats", headers=student,
                       json={"recipient_id": user_id(client, student), "proposed_time": future()}).status_code == 400
    assert client.post("/connections/coffee-chats", headers=student,
                       json={"recipient_id": 99999, "proposed_time": future()}).status_code == 404
    olivia = find_alumni(client, student, "Olivia Bennett")  # not accepting chats
    assert client.post("/connections/coffee-chats", headers=student,
                       json={"recipient_id": olivia["user_id"], "proposed_time": future()}).status_code == 409
    ok = {"recipient_id": sarah_id, "proposed_time": future()}
    assert client.post("/connections/coffee-chats", headers=student, json=ok).status_code == 201
    assert client.post("/connections/coffee-chats", headers=student, json=ok).status_code == 409  # duplicate


def test_coffee_chat_outsider_cannot_modify(client, student, alumni):
    sarah_id = user_id(client, alumni)
    chat = client.post("/connections/coffee-chats", headers=student,
                       json={"recipient_id": sarah_id, "proposed_time": future()}).json()
    outsider = login(client, "kevin.tran@alumni.example.com")
    assert client.patch(f"/connections/coffee-chats/{chat['id']}", headers=outsider,
                        json={"action": "accept"}).status_code == 404


def test_student_to_student_coffee_chat(client, student):
    priya = login(client, "priya.patel@student.example.com")
    r = client.post("/connections/coffee-chats", headers=student,
                    json={"recipient_id": user_id(client, priya), "proposed_time": future()})
    assert r.status_code == 201


def test_connections_require_auth(client):
    for path in ("/connections/alumni", "/connections/students", "/connections/coffee-chats", "/connections/requests"):
        assert client.get(path).status_code == 401
    assert client.post("/connections/coffee-chats", json={}).status_code == 401
