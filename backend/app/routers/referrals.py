import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..config import ALLOWED_RESUME_EXTS, MAX_RESUME_BYTES, UPLOAD_DIR
from ..database import get_db
from ..models import JobPost, JobStatus, ReferralRequest, RequestStatus, User
from ..schemas import ReferralDecision, ReferralRequestOut
from ..security import get_current_user, require_alumni, require_student

router = APIRouter(tags=["referral requests"])


async def _save_resume(file: UploadFile) -> tuple[str, str]:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_RESUME_EXTS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Resume must be a PDF, DOC, or DOCX file")
    data = await file.read(MAX_RESUME_BYTES + 1)
    if len(data) > MAX_RESUME_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Resume must be 5 MB or smaller")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Resume file is empty")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    stored.write_bytes(data)
    return str(stored), Path(file.filename).name


def _get_request_or_404(db: Session, request_id: int) -> ReferralRequest:
    req = db.get(ReferralRequest, request_id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Referral request not found")
    return req


def _ensure_party(req: ReferralRequest, user: User) -> None:
    """Only the requesting student and the job poster may view"""
    if user.id not in (req.student_id, req.job.alumni_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")


@router.post(
    "/jobs/{job_id}/referral-requests",
    response_model=ReferralRequestOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_referral_request(
    job_id: int,
    note: str = Form(..., min_length=20, max_length=2000, description="Short note on why you are a good fit"),
    profile_link: str | None = Form(None),
    resume: UploadFile | None = File(None),
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Student requests a referral: multipart/form-data with note / profile_link / resume (file)"""
    job = db.get(JobPost, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    if job.status != JobStatus.open or job.is_expired:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This job is no longer accepting requests")
    if not job.referral_available:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The alum is not offering referrals for this role")

    existing = db.scalar(
        select(ReferralRequest).where(
            ReferralRequest.job_id == job_id, ReferralRequest.student_id == user.id
        )
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already requested a referral for this job")

    resume_path = resume_filename = None
    if resume is not None and resume.filename:
        resume_path, resume_filename = await _save_resume(resume)

    req = ReferralRequest(
        job_id=job_id,
        student_id=user.id,
        note=note.strip(),
        profile_link=profile_link,
        resume_path=resume_path,
        resume_filename=resume_filename,
    )
    db.add(req)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You already requested a referral for this job")
    db.refresh(req)
    return req


@router.get("/referral-requests/sent", response_model=list[ReferralRequestOut])
def my_sent_requests(user: User = Depends(require_student), db: Session = Depends(get_db)):
    """Student: all referral requests I have sent"""
    stmt = (
        select(ReferralRequest)
        .where(ReferralRequest.student_id == user.id)
        .order_by(ReferralRequest.created_at.desc(), ReferralRequest.id.desc())
        .options(selectinload(ReferralRequest.job), selectinload(ReferralRequest.student))
    )
    return db.scalars(stmt).all()


@router.get("/referral-requests/received", response_model=list[ReferralRequestOut])
def my_received_requests(
    job_id: int | None = None,
    status_filter: RequestStatus | None = None,
    user: User = Depends(require_alumni),
    db: Session = Depends(get_db),
):
    """Alumni inbox: all requests received (filterable by job and status)"""
    stmt = (
        select(ReferralRequest)
        .join(JobPost)
        .where(JobPost.alumni_id == user.id)
        .order_by(ReferralRequest.created_at.desc(), ReferralRequest.id.desc())
        .options(selectinload(ReferralRequest.job), selectinload(ReferralRequest.student))
    )
    if job_id is not None:
        stmt = stmt.where(ReferralRequest.job_id == job_id)
    if status_filter is not None:
        stmt = stmt.where(ReferralRequest.status == status_filter)
    return db.scalars(stmt).all()


@router.get("/referral-requests/{request_id}", response_model=ReferralRequestOut)
def get_referral_request(
    request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    req = _get_request_or_404(db, request_id)
    _ensure_party(req, user)
    return req


@router.patch("/referral-requests/{request_id}/decision", response_model=ReferralRequestOut)
def decide_referral_request(
    request_id: int,
    body: ReferralDecision,
    user: User = Depends(require_alumni),
    db: Session = Depends(get_db),
):
    """Alumni accepts / declines a pending request"""
    req = _get_request_or_404(db, request_id)
    if req.job.alumni_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your job post")
    if req.status != RequestStatus.pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Request is already {req.status.value}")
    req.status = RequestStatus(body.status)
    req.alumni_response = body.alumni_response
    db.commit()
    db.refresh(req)
    return req


@router.post("/referral-requests/{request_id}/withdraw", response_model=ReferralRequestOut)
def withdraw_referral_request(
    request_id: int, user: User = Depends(require_student), db: Session = Depends(get_db)
):
    req = _get_request_or_404(db, request_id)
    if req.student_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your request")
    if req.status != RequestStatus.pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Request is already {req.status.value}")
    req.status = RequestStatus.withdrawn
    db.commit()
    db.refresh(req)
    return req


@router.get("/referral-requests/{request_id}/resume")
def download_resume(
    request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    req = _get_request_or_404(db, request_id)
    _ensure_party(req, user)
    if not req.resume_path or not Path(req.resume_path).exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No resume attached")
    return FileResponse(req.resume_path, filename=req.resume_filename)
