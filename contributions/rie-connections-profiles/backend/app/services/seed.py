"""Fictional demo data for local development.

Every person, company and email address below is invented. Email addresses use the
reserved example.com domain. These accounts are NOT USC-verified and exist only so
the demo journey works out of the box.

The seed is deterministic: the same users, profiles, relationships and messages are
created in the same order every time (so ids are stable: Alex Chen = 1, Sarah Kim = 7).
Only dates are relative to "now", so coffee chats are always in the near future.
See docs/demo-data.md for which account demonstrates which feature.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import (
    AlumniProfile,
    CoffeeChat,
    CoffeeChatStatus,
    Connection,
    ConnectionStatus,
    Message,
    StudentProfile,
    User,
    UserRole,
)
from ..security.passwords import hash_password
from . import resumes
from .sample_pdf import text_pdf

DEMO_STUDENT_EMAIL = "alex.chen@student.example.com"
DEMO_ALUMNI_EMAIL = "sarah.kim@alumni.example.com"

STUDENTS = [
    {
        "full_name": "Alex Chen", "email": DEMO_STUDENT_EMAIL,
        "major": "Computer Science", "degree_program": "B.S.", "graduation_year": 2027,
        "skills": ["Python", "Machine Learning", "Data Analysis", "SQL", "React"],
        "career_interests": ["Machine Learning & AI"],
        "target_roles": [],
        "bio": "Junior studying computer science. I enjoy building small ML projects and web apps, "
               "and I'm exploring which engineering path fits me best.",
        "experience": "Undergraduate research assistant on a course-recommendation project (Python, scikit-learn). "
                      "Built a React study-group finder for a class project.",
        "portfolio_url": "https://portfolio.example.com/alex-chen",
    },
    {
        "full_name": "Priya Patel", "email": "priya.patel@student.example.com",
        "major": "Computer Science and Business Administration", "degree_program": "B.S.", "graduation_year": 2026,
        "skills": ["Product Strategy", "SQL", "Figma", "Python"],
        "career_interests": ["Product Management", "Entrepreneurship"],
        "target_roles": ["Associate Product Manager"],
        "bio": "Senior interested in the overlap of technology and business.",
    },
    {
        "full_name": "Jordan Rivera", "email": "jordan.rivera@student.example.com",
        "major": "Film and Television Production", "degree_program": "B.A.", "graduation_year": 2027,
        "skills": ["Video Editing", "Storytelling", "Adobe Premiere"],
        "career_interests": ["Media & Entertainment"],
        "target_roles": ["Production Assistant"],
        "bio": "Aspiring producer who loves documentary storytelling.",
    },
    {
        "full_name": "Mia Nguyen", "email": "mia.nguyen@student.example.com",
        "major": "Applied Data Science", "degree_program": "M.S.", "graduation_year": 2026,
        "skills": ["Python", "Statistics", "Machine Learning", "Tableau", "SQL"],
        "career_interests": ["Data Science & Analytics", "Healthcare & Biotech"],
        "target_roles": ["Data Scientist"],
        "bio": "Graduate student focused on applied statistics for health outcomes.",
    },
    {
        "full_name": "Ethan Brooks", "email": "ethan.brooks@student.example.com",
        "major": "Business Administration", "degree_program": "B.S.", "graduation_year": 2027,
        "skills": ["Financial Modeling", "Excel", "Valuation"],
        "career_interests": ["Finance & Investment"],
        "target_roles": ["Investment Banking Analyst"],
        "bio": "Business student preparing for finance recruiting.",
    },
    {
        "full_name": "Sofia Martinez", "email": "sofia.martinez@student.example.com",
        "major": "Computer Engineering and Computer Science", "degree_program": "B.S.", "graduation_year": 2028,
        "skills": ["Python", "C++", "Linux", "Networking"],
        "career_interests": ["Software Engineering", "Cybersecurity"],
        "target_roles": ["Software Engineer", "Security Engineer"],
        "bio": "Sophomore who enjoys systems programming and CTF competitions.",
    },
]

ALUMNI = [
    {
        "full_name": "Sarah Kim", "email": DEMO_ALUMNI_EMAIL,
        "usc_degree": "B.S. Computer Science", "graduation_year": 2018,
        "current_company": "Brightline Cloud", "current_title": "Senior Software Engineer", "industry": "Technology",
        "skills": ["Python", "Go", "Distributed Systems", "AWS", "Machine Learning"],
        "career_interests": ["Software Engineering", "Machine Learning & AI"],
        "experience": "Builds backend services for a cloud data platform. Previously a software engineer "
                      "on an ML infrastructure team. Mentors new-grad engineers.",
        "bio": "Happy to talk about the transition from USC to full-time software engineering.",
        "coffee_chat_available": True,
    },
    {
        "full_name": "David Okafor", "email": "david.okafor@alumni.example.com",
        "usc_degree": "M.S. Computer Science", "graduation_year": 2016,
        "current_company": "Northstar Robotics", "current_title": "Machine Learning Engineer", "industry": "Robotics",
        "skills": ["Python", "PyTorch", "Machine Learning", "Computer Vision", "C++"],
        "career_interests": ["Machine Learning & AI", "Software Engineering"],
        "experience": "Trains perception models for warehouse robots and ships them to production.",
        "bio": "Interested in helping students get into applied ML.",
        "coffee_chat_available": True,
    },
    {
        "full_name": "Emily Zhang", "email": "emily.zhang@alumni.example.com",
        "usc_degree": "B.S. Computer Science (Games)", "graduation_year": 2020,
        "current_company": "Sunset Games", "current_title": "Software Engineer", "industry": "Gaming",
        "skills": ["C++", "Unity", "Python", "Gameplay Programming"],
        "career_interests": ["Game Development", "Software Engineering"],
        "experience": "Gameplay and tools engineer on a mobile game team.",
        "bio": "Ask me about building a games portfolio.",
        "coffee_chat_available": True,
    },
    {
        "full_name": "Marcus Johnson", "email": "marcus.johnson@alumni.example.com",
        "usc_degree": "B.S. Business Administration", "graduation_year": 2015,
        "current_company": "Pacific Analytics", "current_title": "Senior Product Manager", "industry": "Technology",
        "skills": ["Product Strategy", "SQL", "Data Analysis", "User Research"],
        "career_interests": ["Product Management", "Data Science & Analytics"],
        "experience": "Leads a B2B analytics product. Started as a business analyst before moving into product.",
        "bio": "Glad to share how I moved from analytics into product management.",
        "coffee_chat_available": True,
    },
    {
        "full_name": "Rachel Lee", "email": "rachel.lee@alumni.example.com",
        "usc_degree": "M.S. Applied Data Science", "graduation_year": 2019,
        "current_company": "Harbor Health AI", "current_title": "Data Scientist", "industry": "Healthcare AI",
        "skills": ["Python", "SQL", "Machine Learning", "Statistics", "Data Analysis"],
        "career_interests": ["Data Science & Analytics", "Healthcare & Biotech", "Machine Learning & AI"],
        "experience": "Builds risk models that help clinics prioritize patient outreach.",
        "bio": "Passionate about responsible data science in healthcare.",
        "coffee_chat_available": True,
    },
    {
        "full_name": "Carlos Ramirez", "email": "carlos.ramirez@alumni.example.com",
        "usc_degree": "B.S. Business Administration", "graduation_year": 2012,
        "current_company": "Golden Coast Capital", "current_title": "Vice President, Investment Banking",
        "industry": "Finance",
        "skills": ["Financial Modeling", "Valuation", "M&A", "Excel"],
        "career_interests": ["Finance & Investment"],
        "experience": "Advises technology companies on mergers and acquisitions.",
        "bio": "Happy to help students prepare for finance recruiting.",
        "coffee_chat_available": True,
    },
    {
        "full_name": "Hannah Park", "email": "hannah.park@alumni.example.com",
        "usc_degree": "B.A. Film and Television Production", "graduation_year": 2014,
        "current_company": "Cardinal Media Studios", "current_title": "Senior Producer",
        "industry": "Media & Entertainment",
        "skills": ["Storytelling", "Production Management", "Budgeting"],
        "career_interests": ["Media & Entertainment"],
        "experience": "Produces documentary series for a streaming studio.",
        "bio": "Always happy to talk to fellow Trojans about life on set.",
        "coffee_chat_available": True,
    },
    {
        "full_name": "Kevin Tran", "email": "kevin.tran@alumni.example.com",
        "usc_degree": "B.S. Computer Engineering", "graduation_year": 2017,
        "current_company": "Ironclad Systems", "current_title": "Security Engineer", "industry": "Cybersecurity",
        "skills": ["Python", "Linux", "Networking", "Threat Modeling"],
        "career_interests": ["Cybersecurity", "Software Engineering"],
        "experience": "Works on cloud security tooling and incident response automation.",
        "bio": "Ex-CTF player, happy to talk security careers.",
        "coffee_chat_available": True,
    },
    {
        "full_name": "Olivia Bennett", "email": "olivia.bennett@alumni.example.com",
        "usc_degree": "B.A. Communication", "graduation_year": 2019,
        "current_company": "Brightline Cloud", "current_title": "Lead UX Designer", "industry": "Technology",
        "skills": ["Figma", "User Research", "Prototyping"],
        "career_interests": ["UX & Product Design"],
        "experience": "Leads design for developer-facing products.",
        "bio": "Proof that you can get into design from any major.",
        "coffee_chat_available": False,
    },
    {
        "full_name": "Nathan Wright", "email": "nathan.wright@alumni.example.com",
        "usc_degree": "B.S. Industrial and Systems Engineering", "graduation_year": 2013,
        "current_company": "Lumen Consulting", "current_title": "Strategy Consultant", "industry": "Consulting",
        "skills": ["Strategy", "Data Analysis", "Excel"],
        "career_interests": ["Consulting & Strategy"],
        "experience": "Advises healthcare and energy clients on operations strategy.",
        "bio": "Can share what consulting interviews look like.",
        "coffee_chat_available": True,
    },
    {
        "full_name": "Aisha Rahman", "email": "aisha.rahman@alumni.example.com",
        "usc_degree": "B.S. Computer Science", "graduation_year": 2021,
        "current_company": "Trellis Pay", "current_title": "Backend Software Engineer", "industry": "Fintech",
        "skills": ["Python", "Java", "PostgreSQL", "Kubernetes", "SQL"],
        "career_interests": ["Software Engineering"],
        "experience": "Builds payment APIs. Joined as a new grad after a summer internship.",
        "bio": "Recent grad — happy to talk about the new-grad job search.",
        "coffee_chat_available": True,
    },
    {
        "full_name": "Daniel Cho", "email": "daniel.cho@alumni.example.com",
        "usc_degree": "Ph.D. Electrical Engineering", "graduation_year": 2017,
        "current_company": "Mesa Energy Labs", "current_title": "Co-founder & CEO", "industry": "Clean Energy",
        "skills": ["Fundraising", "Power Systems", "Leadership"],
        "career_interests": ["Entrepreneurship", "Sustainability & Energy"],
        "experience": "Founded a startup building grid-scale battery software.",
        "bio": "Interested in mentoring student founders.",
        "coffee_chat_available": True,
    },
]


def _at(days: int, hour: int, minute: int = 0) -> datetime:
    base = datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)
    return base + timedelta(days=days)


def seed_demo(db: Session, password: str) -> bool:
    """Insert demo data if the database has no users. Returns True if seeded."""
    if db.scalar(select(User.id).limit(1)) is not None:
        return False

    hashed = hash_password(password)  # one hash shared by all fictional demo accounts
    users: dict[str, User] = {}
    for s in STUDENTS:
        data = dict(s)
        u = User(email=data.pop("email"), full_name=data.pop("full_name"), role=UserRole.student,
                 hashed_password=hashed, is_demo=True)
        u.student_profile = StudentProfile(**data)
        db.add(u)
        users[u.full_name] = u
    for a in ALUMNI:
        data = dict(a)
        u = User(email=data.pop("email"), full_name=data.pop("full_name"), role=UserRole.alumni,
                 hashed_password=hashed, is_demo=True)
        u.alumni_profile = AlumniProfile(**data)
        db.add(u)
        users[u.full_name] = u
    db.flush()

    db.add_all([
        CoffeeChat(requester_id=users["Priya Patel"].id, recipient_id=users["Marcus Johnson"].id,
                   proposed_time=_at(3, 12), message="Hi Marcus, I'd love to hear how you moved into product.",
                   status=CoffeeChatStatus.accepted),
        CoffeeChat(requester_id=users["Mia Nguyen"].id, recipient_id=users["Sarah Kim"].id,
                   proposed_time=_at(4, 15), message="Hi Sarah, I'm curious about ML infrastructure work.",
                   status=CoffeeChatStatus.pending),
        Connection(requester_id=users["Sofia Martinez"].id, addressee_id=users["Alex Chen"].id,
                   message="Hi Alex! Fellow CS Trojan here.", status=ConnectionStatus.accepted),
        Connection(requester_id=users["Mia Nguyen"].id, addressee_id=users["Alex Chen"].id,
                   message="Saw we both like ML — let's connect!", status=ConnectionStatus.pending),
        Connection(requester_id=users["Alex Chen"].id, addressee_id=users["David Okafor"].id,
                   message="Hi David, I'd love to learn about applied ML in robotics.",
                   status=ConnectionStatus.pending),
        Connection(requester_id=users["Priya Patel"].id, addressee_id=users["Marcus Johnson"].id,
                   message="Hi Marcus, fellow Marshall Trojan here!", status=ConnectionStatus.accepted),
        CoffeeChat(requester_id=users["Alex Chen"].id, recipient_id=users["Carlos Ramirez"].id,
                   proposed_time=_at(6, 11), message="Hi Carlos, I'm curious about tech M&A.",
                   response_note="Thanks for reaching out. Recruiting season is busy for me right now.",
                   status=CoffeeChatStatus.declined),
    ])
    db.flush()
    sofia, alex = users["Sofia Martinez"].id, users["Alex Chen"].id
    priya, marcus = users["Priya Patel"].id, users["Marcus Johnson"].id
    db.add_all([
        Message(sender_id=sofia, recipient_id=alex, created_at=_at(-2, 10), read_at=_at(-2, 10, 30),
                body="Hi Alex! Want to team up for the next hackathon? I could use an ML person."),
        Message(sender_id=alex, recipient_id=sofia, created_at=_at(-2, 11), read_at=_at(-2, 12),
                body="Definitely! I've been wanting to try a recommender project."),
        Message(sender_id=sofia, recipient_id=alex, created_at=_at(-1, 9),
                body="Great, let's sketch ideas this week."),
        Message(sender_id=priya, recipient_id=marcus, created_at=_at(-1, 14), read_at=_at(-1, 15),
                body="Thanks for accepting! Is there anything I should read before we chat?"),
        Message(sender_id=marcus, recipient_id=priya, created_at=_at(-1, 16),
                body="Bring one product you use daily and what you'd change about it."),
    ])
    _seed_resumes(db, users)
    db.commit()
    return True


SAMPLE_RESUMES = {
    # name: (visibility, lines)
    "Mia Nguyen": ("everyone", [
        "Mia Nguyen (FICTIONAL DEMO RESUME)",
        "M.S. Applied Data Science, Class of 2026",
        "Skills: Python, Statistics, Machine Learning, Tableau, SQL",
        "Experience: Graduate research assistant, health outcomes analytics (fictional)",
        "This document is sample data for local TrojanLink development only.",
    ]),
    "Priya Patel": ("connections", [
        "Priya Patel (FICTIONAL DEMO RESUME)",
        "B.S. Computer Science and Business Administration, Class of 2026",
        "Skills: Product Strategy, SQL, Figma, Python",
        "Experience: Product intern at a fictional startup",
        "This document is sample data for local TrojanLink development only.",
    ]),
}


def _seed_resumes(db: Session, users: dict[str, User]) -> None:
    for name, (visibility, lines) in SAMPLE_RESUMES.items():
        profile = users[name].student_profile
        resumes.save_resume(profile, users[name].id, text_pdf(lines), f"{name.replace(' ', '_')}_Resume.pdf")
        profile.resume_visibility = visibility
