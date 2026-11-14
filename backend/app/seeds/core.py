"""Core demo data (owner: auth + job posts): users, job posts, referral requests."""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models import JobPost, JobType, ReferralRequest, RequestStatus, Role, User, WorkMode
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
             deadline=today + timedelta(days=21), referral_available=True, referral_slots=3,
             referral_notes="Please include a project link that shows systems work.")
    job(alumni=maya, company="Nimbus Cloud", role_title="New Grad Software Engineer",
        team="Developer Platform", industry="Technology", location="Seattle, WA",
        work_mode=WorkMode.onsite, job_type=JobType.full_time,
        description="Build internal tools used by 2,000+ engineers.",
        requirements="BS/MS in CS or related; internship experience preferred",
        application_link="https://example.com/nimbus/careers/new-grad",
        deadline=today + timedelta(days=35), referral_available=True, referral_slots=2)
    j3 = job(alumni=jordan, company="Brightpath Health", role_title="Associate Product Manager",
             team="Patient Experience", industry="Healthcare", location="Los Angeles, CA",
             work_mode=WorkMode.hybrid, job_type=JobType.full_time,
             description="Own features in our patient scheduling app from discovery to launch.",
             requirements="Strong written communication; SQL a plus; prior PM internship preferred",
             application_link="https://example.com/brightpath/apm",
             deadline=today + timedelta(days=14), referral_available=True, referral_slots=2)
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
        deadline=today + timedelta(days=10), referral_available=True, referral_slots=4)
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
        deadline=today + timedelta(days=7), referral_available=True, referral_slots=1)
    # Expired job: hidden from the default listing
    job(alumni=sam, company="Westlight Studios", role_title="Summer Production Intern",
        team="Production", industry="Media & Entertainment", location="Burbank, CA",
        work_mode=WorkMode.onsite, job_type=JobType.internship,
        description="Summer internship on set.", application_link="https://example.com/westlight/intern",
        deadline=today - timedelta(days=3), referral_available=True)

    db.flush()
    db.add_all([
        ReferralRequest(job=j1, student=alex,
                        note="Hi Maya! I'm a CS junior who built a toy distributed KV store in Go "
                             "for CSCI 499. I'd love to be considered for the storage team.",
                        profile_link="https://example.com/alex-kim"),
        ReferralRequest(job=j3, student=taylor,
                        note="Hi Jordan, I interned as a PM at a health-tech startup last summer "
                             "and led our scheduling redesign. Would love your referral.",
                        status=RequestStatus.accepted,
                        alumni_response="Great background — I've submitted your referral. Good luck!"),
    ])
    db.flush()
    return {"maya": maya, "jordan": jordan, "priya": priya, "sam": sam,
            "alex": alex, "taylor": taylor}
