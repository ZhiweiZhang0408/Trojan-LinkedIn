"""Resume storage, shared by the Profiles module and future modules.

Profiles owns uploading and managing a student's current resume. Other modules should
reuse these helpers instead of touching files directly:

- Job Posts (another teammate) can call `read_resume` / `snapshot_resume` when a student
  applies, so the application keeps the exact file that was submitted even if the student
  later replaces their profile resume.
- A future AI agent (e.g. the optional resume-tailoring idea, not part of Version 1) would
  read the text through `read_resume`, and only with the student's explicit consent.

Access rules for profile viewers live in `presenters.can_view_resume`.
"""
from __future__ import annotations

import secrets
import shutil
from pathlib import Path

from ..config import settings
from ..models import StudentProfile
from ..models.user import utcnow

PDF_MAGIC = b"%PDF-"


class ResumeError(ValueError):
    """Invalid upload; `status_code` maps to the HTTP response."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


def validate_pdf(data: bytes) -> None:
    if len(data) > settings.max_resume_bytes:
        raise ResumeError(413, f"Resume must be {settings.max_resume_bytes // (1024 * 1024)} MB or smaller")
    if not data.startswith(PDF_MAGIC):
        raise ResumeError(415, "Resume must be a PDF file")


def clean_filename(name: str | None) -> str:
    original = (name or "resume.pdf").replace("/", "_").replace("\\", "_")[-200:]
    return original if original.lower().endswith(".pdf") else original + ".pdf"


def resume_path(profile: StudentProfile | None) -> Path | None:
    """Path of the student's current resume on disk, or None if there isn't one."""
    if profile is None or not profile.resume_stored_name:
        return None
    path = settings.upload_dir / profile.resume_stored_name
    return path if path.exists() else None


def read_resume(profile: StudentProfile | None) -> bytes | None:
    path = resume_path(profile)
    return path.read_bytes() if path else None


def save_resume(profile: StudentProfile, user_id: int, data: bytes, filename: str | None) -> str | None:
    """Validate and store a new resume. Returns the previous stored name (to delete after commit)."""
    validate_pdf(data)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    stored = f"{user_id}-{secrets.token_hex(12)}.pdf"  # never trust the client filename on disk
    (settings.upload_dir / stored).write_bytes(data)
    old = profile.resume_stored_name or None
    profile.resume_filename = clean_filename(filename)
    profile.resume_stored_name = stored
    profile.resume_size = len(data)
    profile.resume_uploaded_at = utcnow()
    return old if old != stored else None


def clear_resume(profile: StudentProfile) -> str | None:
    """Remove resume metadata. Returns the stored name to delete after commit."""
    old = profile.resume_stored_name or None
    profile.resume_filename, profile.resume_stored_name, profile.resume_size, profile.resume_uploaded_at = "", "", 0, None
    return old


def delete_file(stored_name: str | None) -> None:
    if stored_name:
        (settings.upload_dir / stored_name).unlink(missing_ok=True)


def snapshot_resume(profile: StudentProfile, prefix: str) -> str | None:
    """Copy the current resume to a new stored file (e.g. for a job application).
    Returns the snapshot's stored name, or None if the student has no resume."""
    src = resume_path(profile)
    if src is None:
        return None
    name = f"{prefix}-{secrets.token_hex(12)}.pdf"
    shutil.copyfile(src, settings.upload_dir / name)
    return name
