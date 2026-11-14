"""Demo data for the connections module (owner: connections teammate)."""
from sqlalchemy.orm import Session

from ..models import User


def seed_connections(db: Session, users: dict[str, User]) -> None:
    """Add demo connections between the shared users.

    Reuse existing users instead of creating new ones, e.g.:
        alex, maya = users["alex"], users["maya"]
        db.add(Connection(requester=alex, addressee=maya, status="accepted"))

    Available keys: maya, jordan, priya, sam (alumni), alex, taylor (students).
    Don't call db.commit() here; seed.py commits once at the end.
    """
    pass
