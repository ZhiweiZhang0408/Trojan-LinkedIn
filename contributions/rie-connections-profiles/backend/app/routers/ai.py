from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, UserRole
from ..schemas.ai import (
    GenerateMessageRequest,
    GenerateMessageResponse,
    Recommendation,
    RecommendRequest,
    RecommendResponse,
    ScoreBreakdown,
)
from ..security import require_role
from ..services import llm
from ..services.message_generator import MessageInputs, generate_template_message
from ..services.presenters import alumni_card, connection_statuses, ensure_profile
from ..services.recommendation import (
    DISCLAIMER,
    WEIGHTS,
    StudentCriteria,
    conversation_topics,
    explain,
    score_alumni,
)

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/status", summary="Whether an LLM is configured (the deterministic fallback always works)")
def ai_status() -> dict:
    return {"llm_configured": llm.llm_available(), "fallback": "deterministic"}


@router.post("/recommend-alumni", response_model=RecommendResponse, summary="Recommend alumni for the student")
def recommend_alumni(
    body: RecommendRequest,
    me: User = Depends(require_role(UserRole.student)),
    db: Session = Depends(get_db),
) -> RecommendResponse:
    profile = ensure_profile(db, me)
    criteria = StudentCriteria.from_profile(
        profile, career_interests=body.career_interests, skills=body.skills, target_roles=body.target_roles
    )
    if not criteria.goals and not criteria.skills:
        raise HTTPException(422, "Add at least one career interest, target role or skill to get recommendations")

    statuses = connection_statuses(db, me.id)
    alumni = db.scalars(select(User).where(User.role == UserRole.alumni, User.discoverable.is_(True))).all()
    scored = []
    for u in alumni:
        a = ensure_profile(db, u)
        scored.append((score_alumni(criteria, a), u, a))
    scored.sort(key=lambda t: (-t[0].score, t[1].full_name))
    top = [t for t in scored if t[0].score > 0][: body.limit]

    items = [
        Recommendation(
            alumni=alumni_card(u, m.score, statuses.get(u.id)),
            match_score=m.score,
            breakdown=ScoreBreakdown(**m.breakdown),
            explanation=explain(criteria, a, u.full_name, m),
            shared_skills=m.shared_skills,
            shared_interests=m.shared_interests,
            conversation_topics=conversation_topics(criteria, a, m),
        )
        for m, u, a in top
    ]

    if body.use_llm and llm.llm_available() and items:
        student_facts = {
            "major": criteria.major,
            "career_interests": criteria.career_interests,
            "target_roles": criteria.target_roles,
            "skills": criteria.skills,
        }
        match_facts = [
            {
                "user_id": r.alumni.user_id,
                "title": r.alumni.current_title,
                "company": r.alumni.current_company,
                "industry": r.alumni.industry,
                "shared_skills": r.shared_skills,
                "shared_interests": r.shared_interests,
            }
            for r in items[:5]
        ]
        improved = llm.llm_explanations(student_facts, match_facts)
        for r in items:
            if r.alumni.user_id in improved:
                r.explanation = improved[r.alumni.user_id]
                r.explanation_source = "llm"

    db.commit()
    return RecommendResponse(
        items=items,
        total=len(items),
        criteria={
            "career_interests": criteria.career_interests,
            "target_roles": criteria.target_roles,
            "skills": criteria.skills,
        },
        weights=WEIGHTS,
        disclaimer=DISCLAIMER,
    )


@router.post("/generate-message", response_model=GenerateMessageResponse, summary="Draft an introduction message")
def generate_message(
    body: GenerateMessageRequest,
    me: User = Depends(require_role(UserRole.student)),
    db: Session = Depends(get_db),
) -> GenerateMessageResponse:
    """Returns a draft for the student to edit. Nothing is ever sent automatically."""
    alum = db.get(User, body.alumni_id)
    if alum is None or alum.role != UserRole.alumni:
        raise HTTPException(404, "Alumni profile not found")
    sp = ensure_profile(db, me)
    ap = ensure_profile(db, alum)
    inputs = MessageInputs.build(me.full_name, sp, alum.full_name, ap, body.purpose, body.tone, body.personal_note)
    subject, message = generate_template_message(inputs)
    source = "template"
    if body.use_llm and llm.llm_available():
        improved = llm.llm_message(inputs.as_dict(), message)
        if improved:
            message, source = improved, "llm"
    db.commit()
    return GenerateMessageResponse(
        subject=subject,
        message=message,
        source=source,
        inputs_used=inputs.as_dict(),
        notice="Draft only — review and edit before using it. TrojanLink never sends messages automatically.",
    )
