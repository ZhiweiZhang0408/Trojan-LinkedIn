"""Shared AI service (owner: Backend B).

Backend A's endpoints call these functions; implement them here without touching the routers.
Keep API keys server-side (read them from environment variables in app/config.py).
"""
from .schemas import ResumeContent


def organize_resume(text: str) -> ResumeContent | None:
    """Organize text extracted from an uploaded resume into ResumeContent.

    Called by POST /resumes/upload. Return None (or raise) to fall back to the
    rule-based parser in app/resume_import.py, so uploads keep working without AI.

    Rules from the product plan: preserve the source wording, dates and numbers;
    leave fields empty rather than guessing.
    """
    return None  # not implemented yet -> rule-based fallback
