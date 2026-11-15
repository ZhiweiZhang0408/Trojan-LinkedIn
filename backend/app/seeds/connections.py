"""Demo data for the connections module, using only the shared seed users."""
from sqlalchemy.orm import Session

from ..models import User
from ..models_connections import (
    Connection,
    ConnectionMessage,
    ConnectionPurpose,
    ConnectionStatus,
)


def seed_connections(db: Session, users: dict[str, User]) -> None:
    """An accepted connection with a short thread, and a pending coffee chat invitation.

    seed.py commits once at the end.
    """
    alex, priya, taylor, maya = users["alex"], users["priya"], users["taylor"], users["maya"]

    accepted = Connection(
        student=alex, alumni=priya, purpose=ConnectionPurpose.connection,
        note="Hi Priya, I'm Alex, a CS junior at USC. I've been building data pipelines in my "
             "internship and would love your advice on moving toward data platform work.",
        topic="Moving from backend work toward data platforms",
        status=ConnectionStatus.accepted,
    )
    db.add(accepted)
    db.flush()
    db.add_all([
        ConnectionMessage(connection=accepted, sender=priya,
                          body="Happy to help, Alex! What kind of data platform work interests you most?"),
        ConnectionMessage(connection=accepted, sender=alex,
                          body="Streaming pipelines mostly. I worked with Kafka and PostgreSQL this summer."),
    ])

    db.add(Connection(
        student=taylor, alumni=maya, purpose=ConnectionPurpose.coffee,
        note="Hi Maya, I'm Taylor, a Business Analytics student. I'd love to hear how you chose "
             "between backend engineering and data roles.",
        topic="Choosing between engineering and analytics roles",
        availability="Weekday afternoons, Pacific Time",
        status=ConnectionStatus.pending,
    ))
