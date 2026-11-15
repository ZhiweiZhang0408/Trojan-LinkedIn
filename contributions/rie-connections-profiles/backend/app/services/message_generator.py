"""Template-based introduction message generator (the default, offline path).

Only facts present in the two profiles (plus the student's own optional note) are used.
The generator never invents shared experiences, mutual contacts, or qualifications.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..models import AlumniProfile, StudentProfile
from .taxonomy import norm_skill

PURPOSE_LINES = {
    "coffee_chat": (
        "I'd love to learn more about your career journey and would really appreciate the chance "
        "to schedule a short 20-30 minute coffee chat at a time that works for you."
    ),
    "career_advice": (
        "If you have a few minutes, I'd be grateful for any advice on how you would approach "
        "building a career in {interest} as a current student."
    ),
    "industry_insight": (
        "I'd love to hear your perspective on {industry} and which skills you think matter most "
        "for people entering the field."
    ),
    "application_advice": (
        "I'm exploring roles similar to yours and would value any advice on how to prepare "
        "strong applications for positions like {title}."
    ),
    "mentorship": (
        "I'm looking for guidance as I plan my next steps, and I'd appreciate the chance to learn "
        "from your experience, even through a brief conversation."
    ),
}

PURPOSE_SUBJECTS = {
    "coffee_chat": "USC student hoping to learn about your path",
    "career_advice": "USC student seeking career advice",
    "industry_insight": "Question from a USC student about {industry}",
    "application_advice": "USC student exploring {title} roles",
    "mentorship": "USC student reaching out",
}


@dataclass
class MessageInputs:
    student_name: str
    student_major: str
    degree_program: str
    career_interests: list[str]
    student_skills: list[str]
    alumni_name: str
    alumni_company: str
    alumni_title: str
    alumni_industry: str
    alumni_skills: list[str]
    purpose: str
    tone: str
    personal_note: str

    @classmethod
    def build(cls, student_name: str, sp: StudentProfile | None, alumni_name: str, ap: AlumniProfile,
              purpose: str, tone: str, personal_note: str) -> "MessageInputs":
        return cls(
            student_name=student_name,
            student_major=(sp.major if sp else "") or "",
            degree_program=(sp.degree_program if sp else "") or "",
            career_interests=list(sp.career_interests or []) if sp else [],
            student_skills=list(sp.skills or []) if sp else [],
            alumni_name=alumni_name,
            alumni_company=ap.current_company or "",
            alumni_title=ap.current_title or "",
            alumni_industry=ap.industry or "",
            alumni_skills=list(ap.skills or []),
            purpose=purpose,
            tone=tone,
            personal_note=" ".join(personal_note.split()),
        )

    @property
    def shared_skills(self) -> list[str]:
        theirs = {norm_skill(s) for s in self.alumni_skills}
        return [s for s in self.student_skills if norm_skill(s) in theirs]

    def as_dict(self) -> dict[str, str | list[str]]:
        return {
            "student_name": self.student_name,
            "student_major": self.student_major,
            "career_interests": self.career_interests,
            "alumni_name": self.alumni_name,
            "alumni_company": self.alumni_company,
            "alumni_role": self.alumni_title,
            "purpose": self.purpose,
            "shared_skills": self.shared_skills,
        }


def _join(items: list[str]) -> str:
    items = [i for i in items if i]
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def _soft_lower(text: str) -> str:
    """'Software Engineering' -> 'software engineering', keeping acronyms like AI / UX."""
    return " ".join(w if (w.isupper() and len(w) <= 4) else w.lower() for w in text.split())


def generate_template_message(m: MessageInputs) -> tuple[str, str]:
    first_name = m.alumni_name.split()[0] if m.alumni_name else "there"
    interest_text = _join([_soft_lower(i) for i in m.career_interests[:2]])
    fmt = {
        "interest": interest_text or "your field",
        "industry": m.alumni_industry or "your industry",
        "title": m.alumni_title or "yours",
    }

    greeting = f"Hi {first_name}," if m.tone == "friendly" else f"Dear {m.alumni_name},"
    program = m.student_major or "student"
    if m.student_major:
        intro = f"I'm {m.student_name}, a USC {m.student_major} student"
        if m.degree_program:
            intro += f" ({m.degree_program})"
    else:
        intro = f"I'm {m.student_name}, a USC {program}"
    intro += f" interested in {interest_text}." if interest_text else "."

    if m.alumni_title and m.alumni_company:
        art = "an" if m.alumni_title[:1].lower() in "aeiou" else "a"
        noticed = f"I noticed that you're a USC alum working as {art} {m.alumni_title} at {m.alumni_company}."
    elif m.alumni_company:
        noticed = f"I noticed that you're a USC alum working at {m.alumni_company}."
    else:
        noticed = "I noticed that you're a fellow member of the USC community."

    shared = m.shared_skills
    skills_line = ""
    if shared:
        skills_line = f" I've been building my skills in {_join(shared[:3])}, which I saw on your profile as well."

    paragraphs = [greeting, intro, noticed + skills_line, PURPOSE_LINES[m.purpose].format(**fmt)]
    if m.personal_note:
        paragraphs.append(m.personal_note)
    if m.tone == "friendly":
        paragraphs.append("Thank you for your time!")
        paragraphs.append(f"Best,\n{m.student_name}")
    else:
        paragraphs.append("Thank you for considering my request.")
        paragraphs.append(f"Kind regards,\n{m.student_name}")

    subject = PURPOSE_SUBJECTS[m.purpose].format(**fmt)
    return subject, "\n\n".join(paragraphs)
