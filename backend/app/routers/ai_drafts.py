"""AI message drafts: referral and question intros, connection and coffee chat invites, and
thread replies. Nothing is sent; the frontend puts the draft in the composer for the user to edit.

On any AI failure the endpoint returns 503 and the user can still write the message by hand.
"""
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..ai_review import AIUnavailable, _call_model, _job_payload
from ..database import get_db
from ..models import JobPost, JobRequest, Resume, ResumeStatus, User
from ..security import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


class DraftBody(BaseModel):
    kind: Literal["referral", "question", "connection", "coffee", "reply"]
    job_id: int | None = None
    resume_id: int | None = None
    request_id: int | None = None
    alum_id: int | None = None
    topic: str | None = Field(default=None, max_length=300)
    draft: str | None = Field(default=None, max_length=2000)  # what the user already typed


class Draft(BaseModel):
    message: str


SYSTEM = """You draft short messages on a referral board that connects USC students with USC alumni.
The user will review and edit your draft before sending it.

Message types:
- referral: a student asks the alum who posted a role for a referral. Name the one or two resume items that best match the role's requirements, say the resume is attached, and ask whether they would be open to referring. Never ask for a guaranteed referral or interview.
- question: a student asks the alum one or two specific questions about the role or team. No resume pitch beyond one clause of context.
- connection: a student asks an alum to connect for career advice on the given topic. Mention the alum's role or company.
- coffee: a student proposes a short coffee chat about the given topic and asks what time works.
- reply: continue the thread as the sender, answering the most recent message from the other person. An alum must not promise a referral or interview unless the request status is "interested", and even then only offer next steps.

Rules:
- Use only facts in <sender>, <resume>, <recipient>, <job>, and <thread>. Never invent experience, numbers, skills, dates, schools, or mutual connections.
- If <draft> is given, improve it while keeping its intent and every fact in it.
- Length: referral, connection, and coffee 70 to 130 words; question 40 to 90 words; reply 25 to 90 words.
- Start with "Hi <recipient first name>," and end with the sender's first name on its own line.
- Plain text in the first person. No subject line, no placeholders like [Company], no emoji, no hashtags.
- Warm and specific, not flattering."""


def _person(u: User) -> dict:
    fields = {"name": u.full_name, "role": u.role.value if hasattr(u.role, "value") else u.role,
              "major": u.major, "grad_year": u.grad_year, "title": u.title, "company": u.company}
    return {k: v for k, v in fields.items() if v}


def _own_resume(db: Session, resume_id: int | None, user: User) -> dict | None:
    if resume_id is None:
        return None
    resume = db.get(Resume, resume_id)
    if not resume or resume.owner_id != user.id or resume.status != ResumeStatus.confirmed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return resume.content


@router.post("/draft-message", response_model=Draft)
def draft_message(body: DraftBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    parts: dict[str, object] = {"type": body.kind, "sender": _person(user)}

    if body.kind in ("referral", "question"):
        job = db.get(JobPost, body.job_id) if body.job_id else None
        if not job:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
        parts["job"] = json.loads(_job_payload(job))
        parts["recipient"] = _person(job.alumni)
        parts["resume"] = _own_resume(db, body.resume_id, user)
    elif body.kind in ("connection", "coffee"):
        alum = db.get(User, body.alum_id) if body.alum_id else None
        if not alum:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Alum not found")
        parts["recipient"] = _person(alum)
        parts["resume"] = _own_resume(db, body.resume_id, user)
        parts["topic"] = body.topic
    else:
        req = db.get(JobRequest, body.request_id) if body.request_id else None
        if not req or user.id not in (req.student_id, req.job.alumni_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
        other = req.job.alumni if user.id == req.student_id else req.student
        parts["recipient"] = _person(other)
        parts["job"] = json.loads(_job_payload(req.job))
        parts["thread"] = {
            "status": req.status.value if hasattr(req.status, "value") else req.status,
            "messages": [{"from": req.student.full_name, "text": req.note}]
            + [{"from": m.sender.full_name, "text": m.body} for m in req.messages],
        }
        if user.id == req.student_id:
            parts["resume"] = req.resume_snapshot

    if body.draft and body.draft.strip():
        parts["draft"] = body.draft.strip()
    prompt = "\n\n".join(
        f"<{k}>\n{v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, indent=1)}\n</{k}>"
        for k, v in parts.items()
        if v
    )
    try:
        out = _call_model(SYSTEM, prompt, Draft, effort="low")
    except AIUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    return Draft(message=out.message.strip())
