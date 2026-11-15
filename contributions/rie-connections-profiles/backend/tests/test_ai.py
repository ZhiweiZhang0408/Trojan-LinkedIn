from conftest import find_alumni, login

from app.services.message_generator import MessageInputs, generate_template_message
from app.services.recommendation import StudentCriteria, score_alumni
from app.models import AlumniProfile


def test_recommend_software_engineering(client, student):
    r = client.post("/ai/recommend-alumni", headers=student,
                    json={"career_interests": ["Software Engineering"], "skills": ["Python", "Machine Learning",
                          "Data Analysis"], "target_roles": ["Software Engineer"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == len(body["items"]) > 0
    top = [i["alumni"]["full_name"] for i in body["items"][:3]]
    assert "Sarah Kim" in top
    assert "Carlos Ramirez" not in [i["alumni"]["full_name"] for i in body["items"]]
    first = body["items"][0]
    assert 0 <= first["match_score"] <= 100
    assert abs(sum(first["breakdown"].values()) - first["match_score"]) <= 1
    assert first["explanation"] and first["conversation_topics"]
    assert first["shared_skills"] and first["explanation_source"] == "rules"
    assert "not a scientific" in body["disclaimer"]
    assert sum(body["weights"].values()) == 100


def test_recommend_uses_saved_profile(client, student):
    client.put("/profiles/me", headers=student, json={"career_interests": ["Finance & Investment"],
                                                         "skills": ["Valuation"], "target_roles": []})
    body = client.post("/ai/recommend-alumni", headers=student, json={}).json()
    assert body["items"][0]["alumni"]["full_name"] == "Carlos Ramirez"
    assert body["criteria"]["career_interests"] == ["Finance & Investment"]


def test_recommend_is_deterministic(client, student):
    a = client.post("/ai/recommend-alumni", headers=student, json={"limit": 10}).json()
    b = client.post("/ai/recommend-alumni", headers=student, json={"limit": 10}).json()
    assert a == b


def test_recommend_requires_criteria_and_student_role(client, student, alumni):
    client.put("/profiles/me", headers=student, json={"career_interests": [], "skills": [], "target_roles": []})
    assert client.post("/ai/recommend-alumni", headers=student, json={}).status_code == 422
    assert client.post("/ai/recommend-alumni", headers=alumni, json={}).status_code == 403
    assert client.post("/ai/recommend-alumni", json={}).status_code == 401


def test_llm_opt_in_without_key_falls_back(client, student):
    r = client.post("/ai/recommend-alumni", headers=student, json={"use_llm": True}).json()
    assert all(i["explanation_source"] == "rules" for i in r["items"])
    sarah = find_alumni(client, student, "Sarah Kim")
    m = client.post("/ai/generate-message", headers=student, json={"alumni_id": sarah["user_id"], "use_llm": True})
    assert m.json()["source"] == "template"


def test_generate_message(client, student):
    sarah = find_alumni(client, student, "Sarah Kim")
    r = client.post("/ai/generate-message", headers=student, json={"alumni_id": sarah["user_id"]})
    assert r.status_code == 200, r.text
    body = r.json()
    msg = body["message"]
    assert msg.startswith("Hi Sarah,")
    assert "Alex Chen" in msg and "Computer Science" in msg
    assert "Senior Software Engineer at Brightline Cloud" in msg
    assert "coffee chat" in msg
    assert "Python" in msg  # a real shared skill
    assert "Go" not in msg.split()  # a skill only Sarah has is not claimed by the student
    assert body["source"] == "template" and "never sends" in body["notice"]
    assert body["inputs_used"]["alumni_company"] == "Brightline Cloud"


def test_generate_message_variants_and_errors(client, student, alumni):
    sarah = find_alumni(client, student, "Sarah Kim")
    formal = client.post("/ai/generate-message", headers=student,
                         json={"alumni_id": sarah["user_id"], "tone": "formal", "purpose": "industry_insight",
                               "personal_note": "I am currently taking a distributed systems course."}).json()
    assert formal["message"].startswith("Dear Sarah Kim,")
    assert "Technology" in formal["message"] and "distributed systems course" in formal["message"]
    assert "Kind regards" in formal["message"]
    priya = login(client, "priya.patel@student.example.com")
    priya_id = client.get("/auth/me", headers=priya).json()["id"]
    assert client.post("/ai/generate-message", headers=student, json={"alumni_id": priya_id}).status_code == 404
    assert client.post("/ai/generate-message", headers=alumni, json={"alumni_id": sarah["user_id"]}).status_code == 403
    assert client.post("/ai/generate-message", headers=student,
                       json={"alumni_id": sarah["user_id"], "purpose": "ask_for_job"}).status_code == 422


def test_template_never_invents_shared_experience():
    a = AlumniProfile(current_company="Acme", current_title="Engineer", industry="Technology", skills=["Rust"])
    m = MessageInputs.build("Test Student", None, "Pat Doe", a, "coffee_chat", "friendly", "")
    _, msg = generate_template_message(m)
    for phrase in ("we met", "we both", "mutual", "also attended", "same class", "skills in"):
        assert phrase not in msg.lower()


def test_score_components_are_bounded():
    a = AlumniProfile(current_company="X", current_title="Software Engineer", industry="Technology",
                      skills=["Python"], career_interests=["Software Engineering"], experience="software", bio="")
    c = StudentCriteria(career_interests=["Software Engineering"], skills=["Python"], target_roles=["Software Engineer"])
    m = score_alumni(c, a)
    assert m.score >= 90 and m.breakdown["skills"] == 30
    empty = score_alumni(StudentCriteria([], [], []), a)
    assert empty.score == 0
