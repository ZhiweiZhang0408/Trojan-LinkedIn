"""Demo data for the persona module: one fictional profile per shared seed user."""
from sqlalchemy.orm import Session

from ..models import User
from ..models_persona import Profile

PROFILES = {
    "maya": dict(
        bio="Backend engineer at Nimbus Cloud working on storage infrastructure. Happy to talk "
            "about systems interviews, new-grad roles, and moving from class projects to production.",
        skills=["Distributed systems", "Go", "Storage", "System design"],
        location="Seattle, WA", open_to_connect=True, coffee_chats=True,
    ),
    "jordan": dict(
        bio="Product manager at Brightpath Health. I enjoy helping Trojans figure out whether "
            "product management is the right fit and how to prepare for PM interviews.",
        skills=["Product management", "Healthcare", "User research", "Roadmapping"],
        location="Los Angeles, CA", open_to_connect=True, coffee_chats=True,
    ),
    "priya": dict(
        bio="Data science lead at Lumen Analytics. Glad to chat about analytics careers, "
            "building a portfolio, and what data teams look for in interns.",
        skills=["Data science", "SQL", "Python", "Experimentation"],
        location="San Francisco, CA", open_to_connect=True, coffee_chats=False,
    ),
    "sam": dict(
        bio="Post-production supervisor at Westlight Studios. Open to questions about breaking "
            "into film and TV post-production.",
        skills=["Post-production", "Editing", "Production management"],
        location="Burbank, CA", open_to_connect=False, coffee_chats=True,
    ),
    "alex": dict(
        bio="CS junior at USC Viterbi who likes building reliable backend systems. Interned on a "
            "logistics data platform, built a Raft key-value store in Go, and works as a student "
            "developer for Viterbi IT.",
        skills=["Go", "Python", "SQL", "Kafka", "Docker", "Distributed systems"],
        experience="Software Engineering Intern, Ridgeline Logistics (May 2025 – Aug 2025)\n"
                   "Student Developer, USC Viterbi IT (Sep 2024 – Present)\n"
                   "Course Producer, CSCI 104 Data Structures (Jan 2025 – May 2025)",
        education="University of Southern California · B.S. Computer Science · May 2027",
        projects="Distributed Key-Value Store (Go, gRPC)\nTrojanEats (React, TypeScript)\n"
                 "Bus Arrival Predictor (Python, scikit-learn)",
        location="Los Angeles, CA",
    ),
    "taylor": dict(
        bio="Business Analytics student interested in product and marketing analytics.",
        skills=["SQL", "Tableau", "Excel", "A/B testing"],
        education="University of Southern California · B.S. Business Analytics · May 2026",
        location="Los Angeles, CA",
    ),
}


def seed_persona(db: Session, users: dict[str, User]) -> None:
    """Add one fictional profile per shared user. seed.py commits once at the end."""
    for key, fields in PROFILES.items():
        if key in users:
            db.add(Profile(user=users[key], **fields))
