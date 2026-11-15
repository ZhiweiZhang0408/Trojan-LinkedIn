"""Connection request lifecycle: send, accept/decline, withdraw, remove, re-connect."""
from datetime import datetime, timedelta

from conftest import find_alumni, login, user_id
from sqlalchemy import text

from app.database import SessionLocal, engine
from app.models import Connection, Message, User


def send(client, headers, other_id, message=""):
    return client.post("/connections/requests", headers=headers, json={"addressee_id": other_id, "message": message})


def act(client, headers, conn_id, action):
    return client.patch(f"/connections/requests/{conn_id}", headers=headers, json={"action": action})


def test_withdraw_pending_request(client, student, alumni):
    sarah_id = user_id(client, alumni)
    conn = send(client, student, sarah_id, "Hi Sarah").json()
    assert client.get(f"/profiles/{sarah_id}", headers=student).json()["connection_id"] == conn["id"]
    # the recipient cannot withdraw, the requester can
    assert act(client, alumni, conn["id"], "withdraw").status_code == 403
    r = act(client, student, conn["id"], "withdraw")
    assert r.status_code == 200 and r.json()["status"] == "withdrawn"
    # it disappears from the recipient's pending list and statuses reset
    pending = client.get("/connections/requests", headers=alumni, params={"status": "pending"}).json()["items"]
    assert conn["id"] not in {c["id"] for c in pending}
    profile = client.get(f"/profiles/{sarah_id}", headers=student).json()
    assert profile["connection_status"] is None and profile["connection_id"] is None
    # cannot accept or withdraw again; can send a fresh request
    assert act(client, alumni, conn["id"], "accept").status_code == 409
    assert act(client, student, conn["id"], "withdraw").status_code == 409
    assert send(client, student, sarah_id).status_code == 201


def test_remove_accepted_connection_by_either_side(client, student, alumni):
    sarah_id, alex_id = user_id(client, alumni), user_id(client, student)
    conn = send(client, student, sarah_id).json()
    act(client, alumni, conn["id"], "accept")
    assert client.get(f"/profiles/{sarah_id}", headers=student).json()["can_message"] is True
    assert client.post(f"/connections/messages/{sarah_id}", headers=student, json={"body": "Hello!"}).status_code == 201

    r = act(client, alumni, conn["id"], "remove")  # the recipient removes it
    assert r.status_code == 200 and r.json()["status"] == "removed"
    profile = client.get(f"/profiles/{sarah_id}", headers=student).json()
    assert profile["connection_status"] is None and profile["can_message"] is False and profile["email"] is None
    # messaging is closed, but history remains readable
    assert client.post(f"/connections/messages/{sarah_id}", headers=student, json={"body": "Hi?"}).status_code == 403
    convo = client.get(f"/connections/messages/{alex_id}", headers=alumni).json()
    assert convo["can_message"] is False and [m["body"] for m in convo["items"]] == ["Hello!"]
    # cannot remove twice; can re-connect later (either direction)
    assert act(client, student, conn["id"], "remove").status_code == 409
    again = send(client, alumni, alex_id).json()
    assert act(client, student, again["id"], "accept").json()["status"] == "accepted"


def test_remove_keeps_messaging_if_coffee_chat_confirmed(client, student, alumni):
    sarah_id = user_id(client, alumni)
    conn = send(client, student, sarah_id).json()
    act(client, alumni, conn["id"], "accept")
    when = (datetime.now() + timedelta(days=2)).replace(microsecond=0).isoformat()
    chat = client.post("/connections/coffee-chats", headers=student,
                       json={"recipient_id": sarah_id, "proposed_time": when}).json()
    client.patch(f"/connections/coffee-chats/{chat['id']}", headers=alumni, json={"action": "accept"})
    act(client, student, conn["id"], "remove")
    assert client.get(f"/profiles/{sarah_id}", headers=student).json()["can_message"] is True


def test_remove_and_withdraw_rules(client, student, alumni):
    sarah_id = user_id(client, alumni)
    conn = send(client, student, sarah_id).json()
    assert act(client, student, conn["id"], "remove").status_code == 409  # pending can't be "removed"
    act(client, alumni, conn["id"], "accept")
    assert act(client, student, conn["id"], "withdraw").status_code == 409  # accepted can't be withdrawn
    outsider = login(client, "kevin.tran@alumni.example.com")
    assert act(client, outsider, conn["id"], "remove").status_code == 404
    assert client.patch(f"/connections/requests/{conn['id']}", headers=student,
                        json={"action": "block"}).status_code == 422


def test_seeded_network_for_demo(client, student):
    """The demo student has one connection to remove, one request to withdraw, one to answer."""
    items = client.get("/connections/requests", headers=student).json()["items"]
    states = {(c["direction"], c["status"]) for c in items}
    assert ("incoming", "pending") in states and ("outgoing", "pending") in states
    assert any(c["status"] == "accepted" for c in items)


def test_clear_conflict_messages(client, student, alumni):
    sarah_id, alex_id = user_id(client, alumni), user_id(client, student)
    conn = send(client, student, sarah_id).json()
    assert "already sent Sarah Kim" in send(client, student, sarah_id).json()["detail"]
    assert "Accept it under Connections" in send(client, alumni, alex_id).json()["detail"]
    act(client, alumni, conn["id"], "accept")
    assert "already connected" in send(client, student, sarah_id).json()["detail"]


def test_sqlite_enforces_foreign_keys_and_cascades(client, student):
    with engine.connect() as c:
        assert c.execute(text("PRAGMA foreign_keys")).scalar() == 1
    with SessionLocal() as db:
        sofia = db.query(User).filter_by(email="sofia.martinez@student.example.com").one()
        sofia_id = sofia.id
        assert db.query(Message).filter((Message.sender_id == sofia_id) | (Message.recipient_id == sofia_id)).count() > 0
        db.delete(sofia)
        db.commit()
        assert db.query(Message).filter((Message.sender_id == sofia_id) | (Message.recipient_id == sofia_id)).count() == 0
        assert db.query(Connection).filter(
            (Connection.requester_id == sofia_id) | (Connection.addressee_id == sofia_id)).count() == 0


def test_connect_from_directory_card_status(client, student):
    david = find_alumni(client, student, "David Okafor")
    assert david["connection_status"] == "pending_outgoing"  # seeded outgoing request
