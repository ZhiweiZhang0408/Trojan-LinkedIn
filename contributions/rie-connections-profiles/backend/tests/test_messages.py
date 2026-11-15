from datetime import datetime, timedelta

from conftest import find_alumni, login, user_id


def accept_chat(client, student, alumni):
    sarah_id = user_id(client, alumni)
    when = (datetime.now() + timedelta(days=2)).replace(microsecond=0).isoformat()
    chat = client.post("/connections/coffee-chats", headers=student,
                       json={"recipient_id": sarah_id, "proposed_time": when}).json()
    client.patch(f"/connections/coffee-chats/{chat['id']}", headers=alumni, json={"action": "accept"})
    return sarah_id


def test_messaging_requires_connection_or_confirmed_chat(client, student, alumni):
    sarah_id = user_id(client, alumni)
    r = client.post(f"/connections/messages/{sarah_id}", headers=student, json={"body": "Hi!"})
    assert r.status_code == 403 and "Connect" in r.json()["detail"]
    convo = client.get(f"/connections/messages/{sarah_id}", headers=student).json()
    assert convo["can_message"] is False and convo["reason"]
    assert client.get(f"/profiles/{sarah_id}", headers=student).json()["can_message"] is False

    accept_chat(client, student, alumni)
    assert client.get(f"/profiles/{sarah_id}", headers=student).json()["can_message"] is True
    r = client.post(f"/connections/messages/{sarah_id}", headers=student, json={"body": "Thanks for accepting!"})
    assert r.status_code == 201 and r.json()["is_mine"] is True


def test_messaging_after_connection_accepted(client, student, alumni):
    sarah_id = user_id(client, alumni)
    conn = client.post("/connections/requests", headers=student, json={"addressee_id": sarah_id}).json()
    client.patch(f"/connections/requests/{conn['id']}", headers=alumni, json={"action": "accept"})
    me_id = user_id(client, student)
    assert client.post(f"/connections/messages/{me_id}", headers=alumni, json={"body": "Hello Alex"}).status_code == 201


def test_inbox_unread_and_read_receipts(client, student, alumni):
    sarah_id = accept_chat(client, student, alumni)
    alex_id = user_id(client, student)
    client.post(f"/connections/messages/{alex_id}", headers=alumni, json={"body": "First"})
    client.post(f"/connections/messages/{alex_id}", headers=alumni, json={"body": "Second"})

    assert client.get("/connections/messages/unread-count", headers=student).json()["unread"] == 3  # +1 seeded
    inbox = client.get("/connections/messages", headers=student).json()
    top = inbox["items"][0]
    assert top["other"]["full_name"] == "Sarah Kim" and top["unread_count"] == 2
    assert top["last_message"]["body"] == "Second" and top["can_message"] is True
    assert inbox["total_unread"] == 3

    convo = client.get(f"/connections/messages/{sarah_id}", headers=student).json()
    assert [m["body"] for m in convo["items"]] == ["First", "Second"]
    assert client.get("/connections/messages/unread-count", headers=student).json()["unread"] == 1
    # the sender sees the read receipt
    mine = client.get(f"/connections/messages/{alex_id}", headers=alumni).json()["items"]
    assert all(m["read_at"] for m in mine)


def test_seeded_peer_thread(client, student):
    inbox = client.get("/connections/messages", headers=student).json()
    sofia = next(t for t in inbox["items"] if t["other"]["full_name"] == "Sofia Martinez")
    assert sofia["can_message"] and sofia["unread_count"] == 1


def test_message_validation_and_privacy(client, student, alumni):
    sarah_id = accept_chat(client, student, alumni)
    assert client.post(f"/connections/messages/{sarah_id}", headers=student, json={"body": ""}).status_code == 422
    assert client.post(f"/connections/messages/{sarah_id}", headers=student, json={"body": "   "}).status_code == 422
    assert client.post(f"/connections/messages/{sarah_id}", headers=student,
                       json={"body": "x" * 4001}).status_code == 422
    assert client.post("/connections/messages/99999", headers=student, json={"body": "hi"}).status_code == 404
    me = user_id(client, student)
    assert client.post(f"/connections/messages/{me}", headers=student, json={"body": "hi"}).status_code == 403
    client.post(f"/connections/messages/{sarah_id}", headers=student, json={"body": "private"})
    # a third party cannot read someone else's thread: they only ever see their own pair
    kevin = login(client, "kevin.tran@alumni.example.com")
    assert client.get(f"/connections/messages/{sarah_id}", headers=kevin).json()["items"] == []
    david = find_alumni(client, student, "David Okafor")
    assert client.post(f"/connections/messages/{david['user_id']}", headers=alumni,
                       json={"body": "hi"}).status_code == 403  # alumni ↔ alumni


def test_messages_require_auth(client):
    assert client.get("/connections/messages").status_code == 401
    assert client.post("/connections/messages/1", json={"body": "x"}).status_code == 401
