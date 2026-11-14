"""Demo data for the persona module (owner: persona teammate)."""
from sqlalchemy.orm import Session

from ..models import User


def seed_persona(db: Session, users: dict[str, User]) -> None:
    """Add detailed profiles for the shared users.

    Reuse existing users instead of creating new ones, e.g.:
        db.add(Profile(user=users["alex"], bio="CS junior into distributed systems",
                       skills="Go, Python, React"))

    Available keys: maya, jordan, priya, sam (alumni), alex, taylor (students).
    Don't call db.commit() here; seed.py commits once at the end.
    """
    pass
