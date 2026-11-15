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
    # Same fictional resume as the demo PDF/DOCX, so the profile, resume and AI demos agree
    alex_base = Resume(owner=alex, label="Base resume", status=ResumeStatus.confirmed, content={
        "contact": {"name": "Alex Kim", "email": "alex.kim@usc.edu", "phone": "(213) 555-0142",
                    "location": "Los Angeles, CA", "linkedin": "linkedin.com/in/alex-kim-demo",
                    "website": "github.com/alexkim-demo"},
        "summary": "CS junior at USC Viterbi who likes building reliable backend systems. Interned on "
                   "a logistics data platform, built a Raft key-value store in Go, and works as a "
                   "student developer for Viterbi IT.",
        "education": [{"school": "University of Southern California, Viterbi School of Engineering",
                       "degree": "B.S.", "major": "Computer Science", "start": "Aug 2023",
                       "end": "May 2027", "gpa": "3.72",
                       "details": ["Coursework: Operating Systems, Distributed Systems, Database Systems, "
                                   "Algorithms, Computer Networks",
                                   "Honors: Dean's List (4 semesters), Viterbi Merit Scholarship"]}],
        "experience": [
            {"company": "Ridgeline Logistics", "title": "Software Engineering Intern",
             "location": "San Diego, CA", "start": "May 2025", "end": "Aug 2025",
             "bullets": ["Built a Go service that streams shipment status events from Kafka into "
                         "PostgreSQL, handling about 3M events per day",
                         "Reduced p95 latency of the tracking API from 480 ms to 190 ms by adding Redis "
                         "caching and removing N+1 queries",
                         "Added OpenTelemetry tracing across 4 services, helping the on-call team find "
                         "the failing hop in minutes",
                         "Wrote integration tests with Testcontainers, raising routing module coverage "
                         "from 41% to 78%"]},
            {"company": "USC Viterbi IT", "title": "Student Developer",
             "location": "Los Angeles, CA", "start": "Sep 2024", "end": "Present",
             "bullets": ["Built a Python (FastAPI) service that syncs lab reservations for 1,200+ "
                         "students across 14 labs",
                         "Cut the nightly sync job from 40 to 12 minutes by batching database writes "
                         "and parallelizing API calls",
                         "Containerized 3 legacy cron jobs with Docker and moved them to a monitored "
                         "scheduler"]},
            {"company": "USC Department of Computer Science",
             "title": "Course Producer, CSCI 104 Data Structures",
             "location": "Los Angeles, CA", "start": "Jan 2025", "end": "May 2025",
             "bullets": ["Ran weekly labs for 30 students on C++ linked lists, heaps, and hash tables",
                         "Held 4 hours of office hours per week and graded 120+ homework submissions "
                         "with written feedback"]},
            {"company": "Trojan Robotics Club", "title": "Software Lead",
             "location": "Los Angeles, CA", "start": "Jan 2024", "end": "Aug 2024",
             "bullets": ["Led 5 students building ROS 2 navigation for a campus delivery robot, "
                         "completing 40+ autonomous test runs",
                         "Set up GitHub Actions CI and a code review process, ending a pattern of "
                         "broken builds on main"]},
        ],
        "projects": [
            {"name": "Distributed Key-Value Store", "role": "Go, gRPC, Docker",
             "link": "github.com/alexkim-demo/kv", "start": "Jan 2025", "end": "Apr 2025",
             "bullets": ["Implemented Raft leader election, log replication, and snapshotting across "
                         "a 5-node cluster",
                         "Built a fault-injection harness for network partitions and node crashes that "
                         "found 3 leader-election bugs",
                         "Sustained 12k writes per second with linearizable reads on a local 5-node cluster"]},
            {"name": "TrojanEats", "role": "React, TypeScript, Node.js, PostgreSQL",
             "link": "github.com/alexkim-demo/trojaneats", "start": "Sep 2024", "end": "Dec 2024",
             "bullets": ["Web app showing which campus dining halls are open and what they serve; "
                         "600+ weekly users in fall 2024",
                         "Designed the PostgreSQL schema and a scheduled scraper that ingests menus "
                         "from 9 dining halls"]},
            {"name": "Bus Arrival Predictor", "role": "Python, pandas, scikit-learn",
             "link": "github.com/alexkim-demo/metro-eta", "start": "Mar 2024", "end": "May 2024",
             "bullets": ["Trained a gradient-boosted model on 2M public LA Metro GPS records to "
                         "predict bus arrival delays",
                         "Lowered mean absolute error from 4.1 to 2.3 minutes compared with the "
                         "schedule-only baseline"]},
        ],
        "skills": ["Go", "Python", "Java", "C++", "TypeScript", "SQL", "FastAPI", "React", "gRPC",
                   "Kafka", "Redis", "PostgreSQL", "Docker", "Git", "Linux", "AWS (EC2/S3/RDS)",
                   "GitHub Actions", "OpenTelemetry"],
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
