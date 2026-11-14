"""AI endpoints with the model call mocked (no API key needed)."""
from fastapi.testclient import TestClient

from app import ai_review
from app.ai_review import (
    AIUnavailable,
    RequirementFinding,
    ReviewOutput,
    TailorOutput,
    TailorSuggestion,
)
from app.main import app
from tests.test_flow import register

RESUME = {
    "contact": {"name": "Ai Stu", "email": "ai.stu@usc.edu"},
    "summary": "CS junior interested in backend systems.",
    "experience": [{"company": "USC Viterbi IT", "title": "Student Developer",
                    "bullets": ["Built a Python service that syncs lab reservations for 1,200 students",
                                "Helped with database maintenance"]}],
    "projects": [{"name": "KV Store", "bullets": ["Raft-based replication in Go across 5 nodes"]}],
    "skills": ["Python", "SQL"],
}


def _sugg(**kw):
    base = dict(section="experience", item_index=0, bullet_index=1, action="replace",
                original="Helped with database maintenance", suggested="Maintained the PostgreSQL database",
                requirement="Databases", reason="Clearer ownership")
    return TailorSuggestion(**{**base, **kw})


TAILOR = TailorOutput(
    suggestions=[
        _sugg(),  # 0: valid replace
        _sugg(original="Text that is not in the resume"),  # 1: original mismatch
        _sugg(suggested="Maintained a database serving 50,000 users"),  # 2: invents a number
        _sugg(section="skills", item_index=None, bullet_index=None, action="add_skill",
              original="", suggested="Go"),  # 3: demonstrated in a project bullet -> ok
        _sugg(section="skills", item_index=None, bullet_index=None, action="add_skill",
              original="", suggested="Kubernetes"),  # 4: not in the resume -> skipped
    ],
    emphasize=["KV Store"],
    missing_info_questions=["How many users did the reservation service handle per day?"],
)

REVIEW = ReviewOutput(
    summary="Backend-focused CS student with a production Python service and a Go systems project.",
    requirements=[
        RequirementFinding(requirement="Go", importance="must_have", status="evidence_found",
                           evidence=["Raft-based replication in Go across 5 nodes"],
                           explanation="Built a replicated store in Go.", follow_up_question=None),
        RequirementFinding(requirement="Kubernetes", importance="nice_to_have", status="evidence_found",
                           evidence=["Deployed services on Kubernetes"],  # hallucinated excerpt
                           explanation="Mentions Kubernetes.", follow_up_question=None),
        RequirementFinding(requirement="On-call experience", importance="nice_to_have",
                           status="information_missing", evidence=["something"],
                           explanation="Not mentioned.", follow_up_question="Have you been on call?"),
    ],
    follow_up_questions=["What was your role in the Raft implementation?"],
)


def test_tailor_and_review(monkeypatch):
    calls = []

    def fake_call(system, user, schema):
        calls.append(schema)
        assert "<resume>" in user and "<job>" in user
        return TAILOR if schema is TailorOutput else REVIEW

    monkeypatch.setattr(ai_review, "_call_model", fake_call)

    with TestClient(app) as c:
        stu = register(c, "ai.stu@usc.edu", "student")
        other = register(c, "ai.other@usc.edu", "student")
        alum = register(c, "ai.alum@alumni.usc.edu", "alumni")
        alum2 = register(c, "ai.alum2@alumni.usc.edu", "alumni")
        job_id = c.post("/jobs", headers=alum, json={
            "company": "Nimbus", "role_title": "Backend Intern", "description": "Storage team",
            "requirements": "Go, databases, Kubernetes a plus"}).json()["id"]
        base = c.post("/resumes", headers=stu, json={"content": RESUME}).json()

        # --- tailoring ---
        assert c.post(f"/resumes/{base['id']}/tailor", headers=other, json={"job_id": job_id}).status_code == 404
        r = c.post(f"/resumes/{base['id']}/tailor", headers=stu, json={"job_id": job_id})
        assert r.status_code == 200, r.text
        run = r.json()
        assert len(run["suggestions"]) == 5 and run["cached"] is False
        # same input -> stored result, no second model call
        assert c.post(f"/resumes/{base['id']}/tailor", headers=stu, json={"job_id": job_id}).json()["cached"]
        assert len(calls) == 1

        r = c.post(f"/resumes/{base['id']}/tailor/{run['id']}/apply", headers=stu,
                   json={"accepted": [0, 1, 2, 3, 4]})
        assert r.status_code == 201, r.text
        out = r.json()
        applied = {x["index"]: x for x in out["results"]}
        assert applied[0]["applied"] and applied[3]["applied"]
        assert not applied[1]["applied"] and "doesn't match" in applied[1]["reason"]
        assert not applied[2]["applied"] and "50,000" in applied[2]["reason"]
        assert not applied[4]["applied"]
        v = out["resume"]
        assert v["parent_id"] == base["id"] and v["job_id"] == job_id and v["label"] == "Nimbus — Backend Intern"
        assert v["content"]["experience"][0]["bullets"][1] == "Maintained the PostgreSQL database"
        assert "Go" in v["content"]["skills"]
        # base untouched
        assert c.get(f"/resumes/{base['id']}", headers=stu).json()["content"]["experience"][0]["bullets"][1] \
            == "Helped with database maintenance"
        # nothing applicable -> 400, no version created
        assert c.post(f"/resumes/{base['id']}/tailor/{run['id']}/apply", headers=stu,
                      json={"accepted": [1, 4]}).status_code == 400

        # --- alumni review ---
        req_id = c.post(f"/jobs/{job_id}/requests", headers=stu,
                        json={"note": "I'd love a referral", "resume_id": v["id"]}).json()["id"]
        assert c.post(f"/job-requests/{req_id}/ai-review", headers=stu).status_code == 403
        assert c.post(f"/job-requests/{req_id}/ai-review", headers=alum2).status_code == 403
        assert c.get(f"/job-requests/{req_id}/ai-review", headers=alum).status_code == 404

        r = c.post(f"/job-requests/{req_id}/ai-review", headers=alum)
        assert r.status_code == 200, r.text
        rev = r.json()
        go, k8s, oncall = rev["requirements"]
        assert go["status"] == "evidence_found" and go["evidence"]
        # hallucinated excerpt removed and finding downgraded
        assert k8s["status"] == "partial_evidence" and k8s["evidence"] == []
        assert k8s["unverified_excerpts_removed"] == 1 and k8s["follow_up_question"]
        assert oncall["evidence"] == []
        assert c.get(f"/job-requests/{req_id}/ai-review", headers=alum).json()["id"] == rev["id"]

        # question-only request has nothing to review
        q_id = c.post(f"/jobs/{job_id}/requests", headers=other, json={"kind": "question", "note": "Remote?"}).json()["id"]
        assert c.post(f"/job-requests/{q_id}/ai-review", headers=alum).status_code == 400


def test_ai_failure_keeps_manual_flow(monkeypatch):
    def broken(system, user, schema):
        raise AIUnavailable("AI is not configured on the server")

    monkeypatch.setattr(ai_review, "_call_model", broken)
    with TestClient(app) as c:
        stu = register(c, "ai.fail@usc.edu", "student")
        alum = register(c, "ai.fail.alum@alumni.usc.edu", "alumni")
        job_id = c.post("/jobs", headers=alum, json={"company": "X", "role_title": "Y",
                                                      "description": "z"}).json()["id"]
        base = c.post("/resumes", headers=stu, json={"content": RESUME}).json()
        r = c.post(f"/resumes/{base['id']}/tailor", headers=stu, json={"job_id": job_id})
        assert r.status_code == 503 and "not configured" in r.json()["detail"]
        # manual path still works
        assert c.post(f"/resumes/{base['id']}/versions", headers=stu, json={"job_id": job_id}).status_code == 201
        assert c.post(f"/jobs/{job_id}/requests", headers=stu,
                      json={"note": "hi", "resume_id": base["id"]}).status_code == 201
