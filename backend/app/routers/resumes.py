"""Student resumes: base versions, job-specific (tailored) versions, and confirmation.

Resumes are private to their owner. Alumni only ever see the snapshot stored on a
job request, never the live resume.
Upload + PDF/DOCX extraction (creates a draft) is added in a later step.
"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import JobPost, Resume, ResumeStatus, User
from ..schemas import ResumeConfirm, ResumeCreate, ResumeOut, ResumeUpdate, ResumeVersionCreate
from ..security import require_student

router = APIRouter(prefix="/resumes", tags=["resumes"])


def _get_own_resume(db: Session, resume_id: int, user: User) -> Resume:
    resume = db.get(Resume, resume_id)
    # 404 (not 403) so other users can't probe which resume IDs exist
    if not resume or resume.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return resume


@router.post("", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
def create_resume(body: ResumeCreate, user: User = Depends(require_student), db: Session = Depends(get_db)):
    """Manual entry route: the profile form's sections become a base resume."""
    resume = Resume(
        owner_id=user.id,
        label=body.label,
        content=body.content.model_dump(),
        status=ResumeStatus.confirmed if body.confirm else ResumeStatus.draft,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.get("/mine", response_model=list[ResumeOut])
def my_resumes(user: User = Depends(require_student), db: Session = Depends(get_db)):
    """All my versions, newest first. Base resumes have parent_id = null."""
    stmt = (
        select(Resume)
        .where(Resume.owner_id == user.id)
        .order_by(Resume.updated_at.desc(), Resume.id.desc())
    )
    return db.scalars(stmt).all()


@router.get("/{resume_id}", response_model=ResumeOut)
def get_resume(resume_id: int, user: User = Depends(require_student), db: Session = Depends(get_db)):
    return _get_own_resume(db, resume_id, user)


@router.patch("/{resume_id}", response_model=ResumeOut)
def update_resume(
    resume_id: int,
    body: ResumeUpdate,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Edit in place. Requests already sent keep their own snapshot."""
    resume = _get_own_resume(db, resume_id, user)
    if body.label is not None:
        resume.label = body.label
    if body.content is not None:
        resume.content = body.content.model_dump()
    db.commit()
    db.refresh(resume)
    return resume


@router.post("/{resume_id}/confirm", response_model=ResumeOut)
def confirm_resume(
    resume_id: int,
    body: ResumeConfirm | None = None,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Confirm and Save: a draft (e.g. an import) becomes usable for tailoring and requests."""
    resume = _get_own_resume(db, resume_id, user)
    if body:
        if body.label is not None:
            resume.label = body.label
        if body.content is not None:
            resume.content = body.content.model_dump()
    resume.status = ResumeStatus.confirmed
    db.commit()
    db.refresh(resume)
    return resume


@router.post("/{resume_id}/versions", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
def create_tailored_version(
    resume_id: int,
    body: ResumeVersionCreate,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Save a job-specific version. The parent (base) resume is left untouched."""
    parent = _get_own_resume(db, resume_id, user)
    if parent.status != ResumeStatus.confirmed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Confirm the resume before tailoring it")

    job = None
    if body.job_id is not None:
        job = db.get(JobPost, body.job_id)
        if not job:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    base_id = parent.parent_id or parent.id  # tailoring a tailored version still points at the base
    version = Resume(
        owner_id=user.id,
        label=body.label or (f"{job.company} — {job.role_title}" if job else f"{parent.label} (copy)"),
        content=body.content.model_dump() if body.content else dict(parent.content),
        status=ResumeStatus.confirmed,
        parent_id=base_id,
        job_id=body.job_id,
        # Keep the reference to the original upload so it can still be shared with a request
        source_text=parent.source_text,
        original_file_path=parent.original_file_path,
        original_filename=parent.original_filename,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(resume_id: int, user: User = Depends(require_student), db: Session = Depends(get_db)):
    """Delete a version. Sent requests are unaffected (they hold their own snapshot)."""
    resume = _get_own_resume(db, resume_id, user)
    for child in db.scalars(select(Resume).where(Resume.parent_id == resume.id)):
        child.parent_id = None  # orphaned tailored versions become standalone
    db.delete(resume)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{resume_id}/file")
def download_original(resume_id: int, user: User = Depends(require_student), db: Session = Depends(get_db)):
    """The original uploaded file, owner only."""
    resume = _get_own_resume(db, resume_id, user)
    if not resume.original_file_path or not Path(resume.original_file_path).exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No uploaded file for this resume")
    return FileResponse(resume.original_file_path, filename=resume.original_filename)
