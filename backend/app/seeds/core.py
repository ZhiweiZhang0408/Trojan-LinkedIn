"""Core demo data (owner: Backend A): users, job posts, resumes, job request threads."""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models import (
    JobPost,
    JobRequest,
    JobType,
    Message,
    RequestKind,
    RequestStatus,
    Resume,
    ResumeStatus,
    Role,
    User,
    WorkMode,
)
from ..security import hash_password

PASSWORD = "password123"


def seed_core(db: Session) -> dict[str, User]:
    """Create the shared demo users plus job posts and referral requests.

    Returns users keyed by first name (lowercase) so other modules can reuse them.
    """
    pw = hash_password(PASSWORD)
    today = date.today()

    def user(**kw):
        u = User(hashed_password=pw, is_email_verified=True,
                 is_usc_verified=kw["email"].endswith("usc.edu"), **kw)
        db.add(u)
        return u

    maya = user(email="maya.chen@alumni.usc.edu", full_name="Maya Chen", role=Role.alumni,
                grad_year=2019, major="Computer Science", company="Nimbus Cloud",
                title="Senior Software Engineer")
    jordan = user(email="jordan.reyes@alumni.usc.edu", full_name="Jordan Reyes", role=Role.alumni,
                  grad_year=2017, major="Business Administration", company="Brightpath Health",
                  title="Product Manager")
    priya = user(email="priya.nair@alumni.usc.edu", full_name="Priya Nair", role=Role.alumni,
                 grad_year=2020, major="Data Science", company="Lumen Analytics",
                 title="Data Science Lead")
    sam = user(email="sam.okafor@example.com", full_name="Sam Okafor", role=Role.alumni,
               grad_year=2015, major="Film & Television Production", company="Westlight Studios",
               title="Post-Production Supervisor")
    alex = user(email="alex.kim@usc.edu", full_name="Alex Kim", role=Role.student,
                grad_year=2027, major="Computer Science")
    taylor = user(email="taylor.brooks@usc.edu", full_name="Taylor Brooks", role=Role.student,
                  grad_year=2026, major="Business Analytics")

    def job(**kw):
        j = JobPost(**kw)
        db.add(j)
        return j

    j1 = job(alumni=maya, company="Nimbus Cloud", role_title="Software Engineer Intern",
             team="Storage Infrastructure", industry="Technology", location="Seattle, WA",
             work_mode=WorkMode.hybrid, job_type=JobType.internship,
             description="Join the team building our distributed object storage layer. "
                         "You'll ship production code and own a project end to end.",
             requirements="Data structures & algorithms; one of Go/Java/C++; OS fundamentals",
             eligibility="BS/MS students graduating Dec 2027 – Jun 2028",
             application_link="https://example.com/nimbus/careers/swe-intern",
             application_instructions="Apply on the careers site first, then send me your "
                                      "application ID in our thread so I can submit the referral.",
             deadline=today + timedelta(days=21), referral_available=True,
             referral_notes="Please include a project link that shows systems work.")
    job(alumni=maya, company="Nimbus Cloud", role_title="New Grad Software Engineer",
        team="Developer Platform", industry="Technology", location="Seattle, WA",
        work_mode=WorkMode.onsite, job_type=JobType.full_time,
        description="Build internal tools used by 2,000+ engineers.",
        requirements="BS/MS in CS or related; internship experience preferred",
        application_link="https://example.com/nimbus/careers/new-grad",
        deadline=today + timedelta(days=35), referral_available=True)
    j3 = job(alumni=jordan, company="Brightpath Health", role_title="Associate Product Manager",
             team="Patient Experience", industry="Healthcare", location="Los Angeles, CA",
             work_mode=WorkMode.hybrid, job_type=JobType.full_time,
             description="Own features in our patient scheduling app from discovery to launch.",
             requirements="Strong written communication; SQL a plus; prior PM internship preferred",
             application_link="https://example.com/brightpath/apm",
             application_instructions="Submit through the careers page; I'll flag your "
                                      "application to the hiring manager.",
             deadline=today + timedelta(days=14), referral_available=True)
    job(alumni=jordan, company="Brightpath Health", role_title="Product Design Intern",
        team="Design Systems", industry="Healthcare", location="Remote (US)",
        work_mode=WorkMode.remote, job_type=JobType.internship,
        description="Help evolve our design system and accessibility standards.",
        requirements="Portfolio required; Figma",
        application_link="https://example.com/brightpath/design-intern",
        deadline=today + timedelta(days=28), referral_available=False,
        referral_notes="I can't refer for this one, but happy to answer questions about the team.")
    job(alumni=priya, company="Lumen Analytics", role_title="Data Analyst Intern",
        team="Marketing Analytics", industry="Technology", location="New York, NY",
        work_mode=WorkMode.onsite, job_type=JobType.internship,
        description="Build dashboards and run experiments that shape our marketing spend.",
        requirements="SQL, Python (pandas), basic statistics",
        application_link="https://example.com/lumen/da-intern",
        deadline=today + timedelta(days=10), referral_available=True)
    job(alumni=priya, company="Lumen Analytics", role_title="Machine Learning Engineer",
        team="Forecasting", industry="Technology", location="New York, NY",
        work_mode=WorkMode.hybrid, job_type=JobType.full_time,
        description="Productionize time-series forecasting models.",
        requirements="MS preferred; PyTorch; ML system design",
        application_link="https://example.com/lumen/mle",
        deadline=None, referral_available=True)
    job(alumni=sam, company="Westlight Studios", role_title="Post-Production Assistant",
        team="Editorial", industry="Media & Entertainment", location="Burbank, CA",
        work_mode=WorkMode.onsite, job_type=JobType.full_time,
        description="Support the editorial team on a scripted series.",
        requirements="Avid Media Composer; strong organization",
        application_link="https://example.com/westlight/pa",
        deadline=today + timedelta(days=7), referral_available=True)
    # Expired job: hidden from the default listing
    job(alumni=sam, company="Westlight Studios", role_title="Summer Production Intern",
        team="Production", industry="Media & Entertainment", location="Burbank, CA",
        work_mode=WorkMode.onsite, job_type=JobType.internship,
        description="Summer internship on set.", application_link="https://example.com/westlight/intern",
        deadline=today - timedelta(days=3), referral_available=True)

    db.flush()

    # ---- Resumes ----
    alex_base = Resume(owner=alex, label="Base resume", status=ResumeStatus.confirmed, content={
        "contact": {"name": "Alex Kim", "email": "alex.kim@usc.edu", "location": "Los Angeles, CA",
                    "linkedin": "https://example.com/in/alex-kim"},
        "summary": "CS junior interested in distributed systems and backend infrastructure.",
        "education": [{"school": "University of Southern California", "degree": "B.S.",
                       "major": "Computer Science", "start": "Aug 2023", "end": "May 2027",
                       "gpa": "3.7", "details": ["Coursework: Operating Systems, Distributed Systems"]}],
        "experience": [{"company": "USC Viterbi IT", "title": "Student Developer",
                        "location": "Los Angeles, CA", "start": "Sep 2024", "end": "Present",
                        "bullets": ["Built a Python service that syncs lab reservations for 1,200 students",
                                    "Cut nightly job runtime from 40 to 12 minutes"]}],
        "projects": [{"name": "Toy distributed KV store", "role": "Solo project",
                      "link": "https://example.com/alex/kv",
                      "bullets": ["Raft-based replication in Go across 5 nodes",
                                  "Wrote a fault-injection test harness"]}],
        "skills": ["Go", "Python", "SQL", "Docker", "Linux"],
    })
    taylor_base = Resume(owner=taylor, label="Base resume", status=ResumeStatus.confirmed, content={
        "contact": {"name": "Taylor Brooks", "email": "taylor.brooks@usc.edu"},
        "summary": "Business Analytics senior with product management internship experience.",
        "education": [{"school": "University of Southern California", "degree": "B.S.",
                       "major": "Business Analytics", "start": "Aug 2022", "end": "May 2026"}],
        "experience": [{"company": "CareLoop (startup)", "title": "Product Management Intern",
                        "start": "Jun 2025", "end": "Aug 2025",
                        "bullets": ["Led the redesign of appointment scheduling; no-shows fell 18%",
                                    "Ran 12 patient interviews and wrote the PRD"]}],
        "skills": ["SQL", "Figma", "Product discovery", "A/B testing"],
    })
    db.add_all([alex_base, taylor_base])
    db.flush()

    # ---- Job request threads ----
    alex_req = JobRequest(
        job=j1, student=alex, kind=RequestKind.referral, resume_id=alex_base.id,
        resume_snapshot=dict(alex_base.content),
        note="Hi Maya! I'm a CS junior who built a toy distributed KV store in Go "
             "for CSCI 499. I'd love to be considered for the storage team.")
    taylor_req = JobRequest(
        job=j3, student=taylor, kind=RequestKind.referral, resume_id=taylor_base.id,
        resume_snapshot=dict(taylor_base.content), status=RequestStatus.interested,
        note="Hi Jordan, I interned as a PM at a health-tech startup last summer "
             "and led our scheduling redesign. Would love your referral.")
    db.add_all([alex_req, taylor_req])
    db.flush()
    db.add_all([
        Message(job_request=taylor_req, sender=jordan,
                body="Great background! Could you share a bit more about how you measured the no-show drop?"),
        Message(job_request=taylor_req, sender=taylor,
                body="Sure — we compared 6 weeks before/after launch across 3 clinics, about 4,000 appointments."),
        Message(job_request=taylor_req, sender=jordan,
                body="Perfect. Please apply on the careers page and send me your application ID."),
    ])
    db.flush()
    return {"maya": maya, "jordan": jordan, "priya": priya, "sam": sam,
            "alex": alex, "taylor": taylor}
