"""AI endpoints owned by Backend A: Tailor for This Role (student) and Review with AI (alum).

Results are stored in ai_results and reused while the input is unchanged (pass refresh=true
to regenerate). On any AI failure the endpoint returns 503 and nothing else changes, so the
manual edit / send / reply flows keep working.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import config
from ..ai_review import (
    AIUnavailable,
    RequirementFinding,
    TailorSuggestion,
    apply_suggestions,
    input_hash,
    review_request,
    tailor_resume,
    verify_review,
)
from ..database import get_db
from ..models import AIResult, JobPost, JobRequest, Resume, ResumeStatus, User
from ..schemas import ResumeOut
from ..security import require_alumni, require_student

router = APIRouter(tags=["ai"])


# ---------- Request / response shapes ----------

class TailorRequest(BaseModel):
    job_id: int
    refresh: bool = False


class TailorRunOut(BaseModel):
    id: int
    resume_id: int
    job_id: int
    # Suggestions are addressed by their position in this list when applying
    suggestions: list[TailorSuggestion]
    emphasize: list[str]
    missing_info_questions: list[str]
    model: str
    cached: bool
    created_at: datetime


class TailorApply(BaseModel):
    accepted: list[int] = Field(min_length=1, description="Indexes into the run's suggestions")
    label: str | None = Field(default=None, max_length=120)


class ApplyResult(BaseModel):
    index: int
    applied: bool
    reason: str | None  # why it was skipped


class TailorApplyOut(BaseModel):
    resume: ResumeOut  # the new tailored version; the base is unchanged
    results: list[ApplyResult]


class VerifiedFinding(RequirementFinding):
    unverified_excerpts_removed: int  # excerpts dropped because they weren't in the resume


class ReviewRunOut(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: int
    job_request_id: int
    summary: str
    requirements: list[VerifiedFinding]
    follow_up_questions: list[str]
    model: str
    cached: bool
    created_at: datetime


def _ai_error(exc: AIUnavailable) -> HTTPException:
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))


# ---------- Tailor for This Role (student) ----------

def _tailor_out(run: AIResult, cached: bool) -> TailorRunOut:
    return TailorRunOut(id=run.id, resume_id=run.resume_id, job_id=run.job_id, model=run.model,
                        cached=cached, created_at=run.created_at, **run.output)


@router.post("/resumes/{resume_id}/tailor", response_model=TailorRunOut)
def tailor_for_role(
    resume_id: int,
    body: TailorRequest,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Suggest job-specific edits. Nothing changes until the student applies some of them."""
    resume = db.get(Resume, resume_id)
    if not resume or resume.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    if resume.status != ResumeStatus.confirmed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Confirm the resume before tailoring it")
    job = db.get(JobPost, body.job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    h = input_hash("tailor", resume.content, job.description, job.requirements, job.role_title, config.AI_MODEL)
    if not body.refresh:
        cached = db.scalar(
            select(AIResult)
            .where(AIResult.kind == "tailor", AIResult.resume_id == resume.id,
                   AIResult.job_id == job.id, AIResult.input_hash == h)
            .order_by(AIResult.id.desc())
        )
        if cached:
            return _tailor_out(cached, cached=True)

    try:
        output = tailor_resume(resume.content, job)
    except AIUnavailable as exc:
        raise _ai_error(exc)
    run = AIResult(kind="tailor", resume_id=resume.id, job_id=job.id, input_hash=h,
                   model=config.AI_MODEL, output=output.model_dump())
    db.add(run)
    db.commit()
    db.refresh(run)
    return _tailor_out(run, cached=False)


@router.post("/resumes/{resume_id}/tailor/{run_id}/apply", response_model=TailorApplyOut,
             status_code=status.HTTP_201_CREATED)
def apply_tailoring(
    resume_id: int,
    run_id: int,
    body: TailorApply,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Save the accepted suggestions as a new tailored version. The base resume is untouched.

    Each accepted suggestion is re-checked against the resume; ones that no longer match are
    skipped and reported in `results`. The student can still edit the new version afterwards.
    """
    resume = db.get(Resume, resume_id)
    run = db.get(AIResult, run_id)
    if not resume or resume.owner_id != user.id or not run or run.kind != "tailor" \
            or run.resume_id != resume.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tailoring result not found")

    new_content, results = apply_suggestions(resume.content, run.output["suggestions"], body.accepted)
    if not any(r["applied"] for r in results):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"message": "None of the selected suggestions could be applied", "results": results})

    job = db.get(JobPost, run.job_id)
    version = Resume(
        owner_id=user.id,
        label=body.label or (f"{job.company} — {job.role_title}" if job else f"{resume.label} (tailored)"),
        content=new_content,
        status=ResumeStatus.confirmed,
        parent_id=resume.parent_id or resume.id,
        job_id=run.job_id,
        source_text=resume.source_text,
        original_file_path=resume.original_file_path,
        original_filename=resume.original_filename,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return TailorApplyOut(resume=ResumeOut.model_validate(version), results=results)


# ---------- Review with AI (alum) ----------

def _review_out(run: AIResult, cached: bool) -> ReviewRunOut:
    return ReviewRunOut(id=run.id, job_request_id=run.job_request_id, model=run.model,
                        cached=cached, created_at=run.created_at, **run.output)


def _get_alum_request(db: Session, request_id: int, user: User) -> JobRequest:
    req = db.get(JobRequest, request_id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if req.job.alumni_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the role's alum can review this request")
    return req


@router.post("/job-requests/{request_id}/ai-review", response_model=ReviewRunOut)
def ai_review(
    request_id: int,
    refresh: bool = Query(False, description="Regenerate instead of returning the stored review"),
    user: User = Depends(require_alumni),
    db: Session = Depends(get_db),
):
    """Summary + evidence per requirement, based on the exact submitted snapshot."""
    req = _get_alum_request(db, request_id, user)
    if not req.resume_snapshot:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "No resume was submitted with this request; read and reply directly")

    job = req.job
    h = input_hash("review", req.resume_snapshot, req.note, job.description, job.requirements, config.AI_MODEL)
    if not refresh:
        cached = db.scalar(
            select(AIResult)
            .where(AIResult.kind == "review", AIResult.job_request_id == req.id, AIResult.input_hash == h)
            .order_by(AIResult.id.desc())
        )
        if cached:
            return _review_out(cached, cached=True)

    try:
        review = review_request(req.resume_snapshot, req.note, job)
    except AIUnavailable as exc:
        raise _ai_error(exc)
    run = AIResult(kind="review", job_request_id=req.id, job_id=job.id, input_hash=h,
                   model=config.AI_MODEL, output=verify_review(review, req.resume_snapshot, req.note))
    db.add(run)
    db.commit()
    db.refresh(run)
    return _review_out(run, cached=False)


@router.get("/job-requests/{request_id}/ai-review", response_model=ReviewRunOut)
def get_ai_review(request_id: int, user: User = Depends(require_alumni), db: Session = Depends(get_db)):
    """The latest stored review for this request (404 if none yet)."""
    req = _get_alum_request(db, request_id, user)
    run = db.scalar(
        select(AIResult)
        .where(AIResult.kind == "review", AIResult.job_request_id == req.id)
        .order_by(AIResult.id.desc())
    )
    if not run:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No AI review yet")
    return _review_out(run, cached=True)


# ---------- Frontend contract (frontend/src/useBoard.ts: tailor() and review()) ----------
# Thin wrappers over the endpoints above, shaped exactly as the frontend expects.

class FrontendTailorBody(BaseModel):
    resumeId: int
    jobId: int


class FrontendSuggestion(BaseModel):
    original: str
    suggested: str
    reason: str


class FrontendReviewBody(BaseModel):
    requestId: int


class FrontendEvidence(BaseModel):
    requirement: str
    status: str  # "found" | "partial" | "missing"
    evidence: str


class FrontendReview(BaseModel):
    summary: str
    evidence: list[FrontendEvidence]
    questions: list[str]


_STATUS = {"evidence_found": "found", "partial_evidence": "partial", "information_missing": "missing"}


@router.post("/ai/resume-tailoring", response_model=list[FrontendSuggestion])
def frontend_tailor(body: FrontendTailorBody, user: User = Depends(require_student), db: Session = Depends(get_db)):
    """Only text replacements that pass the code checks, since the frontend applies them by
    replacing `original` in the resume text."""
    run = tailor_for_role(body.resumeId, TailorRequest(job_id=body.jobId), user, db)
    resume = db.get(Resume, body.resumeId)
    out = []
    for s in run.suggestions:
        if s.action != "replace" or not s.original.strip():
            continue
        _, results = apply_suggestions(resume.content, [s.model_dump()], [0])
        if results[0]["applied"]:
            out.append(FrontendSuggestion(original=s.original, suggested=s.suggested,
                                          reason=f"{s.reason} (For: {s.requirement})"))
    return out


@router.post("/ai/request-review", response_model=FrontendReview)
def frontend_review(body: FrontendReviewBody, user: User = Depends(require_alumni), db: Session = Depends(get_db)):
    run = ai_review(body.requestId, False, user, db)
    questions: list[str] = []
    for q in [*run.follow_up_questions, *(f.follow_up_question for f in run.requirements)]:
        if q and q not in questions:
            questions.append(q)
    return FrontendReview(
        summary=run.summary,
        evidence=[
            FrontendEvidence(
                requirement=f.requirement,
                status=_STATUS[f.status],
                evidence=" · ".join(f'"{e}"' for e in f.evidence) or f.explanation,
            )
            for f in run.requirements
        ],
        questions=questions[:5],
    )
