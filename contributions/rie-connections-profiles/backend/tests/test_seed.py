"""Demo data must be deterministic and must exercise every core feature."""
import re
import sys

from conftest import DEMO_PASSWORD, login, user_id

from app import seed as seed_cli
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import CoffeeChat, Connection, Message, User
from app.services.sample_pdf import text_pdf
from app.services.seed import seed_demo


def snapshot():
    with SessionLocal() as db:
        users = [(u.id, u.email, u.role.value) for u in db.query(User).order_by(User.id)]
        conns = [(c.requester_id, c.addressee_id, c.status.value) for c in db.query(Connection).order_by(Connection.id)]
        chats = [(c.requester_id, c.recipient_id, c.status.value) for c in db.query(CoffeeChat).order_by(CoffeeChat.id)]
        msgs = [(m.sender_id, m.recipient_id, m.body) for m in db.query(Message).order_by(Message.id)]
    return users, conns, chats, msgs


def test_seed_is_deterministic(client):
    first = snapshot()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        assert seed_demo(db, DEMO_PASSWORD) is True
        assert seed_demo(db, DEMO_PASSWORD) is False  # never duplicates
    assert snapshot() == first
    users = first[0]
    assert users[0][1] == "alex.chen@student.example.com" and users[0][0] == 1
    assert users[6][1] == "sarah.kim@alumni.example.com" and users[6][0] == 7
    assert all(email.endswith("example.com") for _, email, _ in users)  # reserved, fictional domain


def test_seed_covers_every_feature(client, student, alumni):
    # coffee chats: pending (Sarah's inbox), accepted (Priya/Marcus), declined (Alex's history)
    _, conns, chats, msgs = snapshot()
    assert {s for *_, s in chats} >= {"pending", "accepted", "declined"}
    assert {s for *_, s in conns} >= {"pending", "accepted"}
    assert len(msgs) >= 5
    assert client.get("/connections/coffee-chats", headers=alumni,
                      params={"direction": "incoming", "status": "pending"}).json()["total"] >= 1
    assert client.get("/connections/messages/unread-count", headers=student).json()["unread"] >= 1


def test_sample_resumes_are_valid_pdfs_with_visibility(client, student):
    priya = login(client, "priya.patel@student.example.com")
    mia_id = user_id(client, login(client, "mia.nguyen@student.example.com"))
    priya_id = user_id(client, priya)
    # Mia: "everyone" → Alex can download
    r = client.get(f"/profiles/{mia_id}/resume", headers=student)
    assert r.status_code == 200 and r.content.startswith(b"%PDF-") and r.content.rstrip().endswith(b"%%EOF")
    assert b"FICTIONAL DEMO RESUME" in r.content
    # Priya: "connections" → Alex (not connected) can't; Marcus (connected) can
    assert client.get(f"/profiles/{priya_id}/resume", headers=student).status_code == 404
    marcus = login(client, "marcus.johnson@alumni.example.com")
    assert client.get(f"/profiles/{priya_id}/resume", headers=marcus).status_code == 200


def test_text_pdf_has_a_valid_xref_table():
    pdf = text_pdf(["Title (with parens)", "Line two"])
    startxref = int(re.search(rb"startxref\n(\d+)", pdf).group(1))
    assert pdf[startxref:startxref + 4] == b"xref"
    offsets = [int(x) for x in re.findall(rb"(\d{10}) 00000 n", pdf)]
    for n, off in enumerate(offsets, start=1):
        assert pdf[off:].startswith(b"%d 0 obj" % n)
    assert b"\\(with parens\\)" in pdf


def test_seed_cli_reset(client, monkeypatch, capsys):
    monkeypatch.setattr(settings, "demo_user_password", DEMO_PASSWORD)
    monkeypatch.setattr(sys, "argv", ["app.seed"])
    assert seed_cli.main() == 0
    assert "already has users" in capsys.readouterr().out
    monkeypatch.setattr(sys, "argv", ["app.seed", "--reset"])
    assert seed_cli.main() == 0
    assert "Seeded demo data" in capsys.readouterr().out
    monkeypatch.setattr(settings, "demo_user_password", None)
    assert seed_cli.main() == 1
