"""Deterministic, explainable alumni recommendation.

The score is a transparent weighted heuristic (0-100). It is a ranking aid only and
is NOT a validated compatibility probability.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..models import AlumniProfile, StudentProfile
from .taxonomy import CAREER_TAXONOMY, categories_for, contains_keyword, norm, norm_skill, tokens

WEIGHTS = {"career_goal": 30, "skills": 30, "industry": 15, "job_title": 15, "background": 10}

DISCLAIMER = (
    "Match scores are a transparent weighted heuristic (career goals 30%, skills 30%, industry 15%, "
    "job title 15%, background 10%). They help rank profiles and are not a scientific measure of compatibility."
)


@dataclass
class StudentCriteria:
    career_interests: list[str]
    skills: list[str]
    target_roles: list[str]
    major: str = ""

    @classmethod
    def from_profile(cls, p: StudentProfile | None, **overrides) -> "StudentCriteria":
        base = {
            "career_interests": list(p.career_interests or []) if p else [],
            "skills": list(p.skills or []) if p else [],
            "target_roles": list(p.target_roles or []) if p else [],
            "major": p.major if p else "",
        }
        for key, value in overrides.items():
            if value is not None:
                base[key] = value
        return cls(**base)

    @property
    def goals(self) -> list[str]:
        return [*self.career_interests, *self.target_roles]


@dataclass
class MatchResult:
    score: int
    breakdown: dict[str, float]
    matched_goals: list[str] = field(default_factory=list)
    matched_categories: list[str] = field(default_factory=list)
    shared_skills: list[str] = field(default_factory=list)
    shared_interests: list[str] = field(default_factory=list)
    industry_match: bool = False
    title_match: bool = False


def _alumni_text(a: AlumniProfile) -> dict[str, str]:
    return {
        "headline": norm(f"{a.current_title} {a.industry} {' '.join(a.career_interests or [])}"),
        "title": norm(a.current_title),
        "industry": norm(a.industry),
        "background": norm(f"{a.experience} {a.bio}"),
    }


def score_alumni(c: StudentCriteria, a: AlumniProfile) -> MatchResult:
    text = _alumni_text(a)
    alumni_categories = set()
    for item in [a.current_title, a.industry, *(a.career_interests or [])]:
        alumni_categories.update(categories_for(item))

    # 1) Career goal similarity: does the alumnus work in / care about the student's goal areas?
    goal_hits: list[float] = []
    matched_goals: list[str] = []
    matched_categories: list[str] = []
    for goal in c.goals:
        cats = categories_for(goal)
        hit = 0.0
        if cats and alumni_categories.intersection(cats):
            hit = 1.0
        elif contains_keyword(text["headline"], norm(goal)):
            hit = 1.0
        elif any(contains_keyword(text["background"], kw) for cat in cats for kw in CAREER_TAXONOMY[cat]["keywords"]):
            hit = 0.5
        goal_hits.append(hit)
        if hit >= 1.0:
            matched_goals.append(goal)
            matched_categories.extend(x for x in cats if x in alumni_categories and x not in matched_categories)
    career = (0.7 * max(goal_hits) + 0.3 * (sum(goal_hits) / len(goal_hits))) if goal_hits else 0.0

    # 2) Skills overlap (normalized, synonym-aware)
    alumni_skills = {norm_skill(s): s for s in (a.skills or [])}
    shared = [s for s in c.skills if norm_skill(s) in alumni_skills]
    denom = max(1, min(len(c.skills), 4))
    skills = min(1.0, len(shared) / denom)

    # 3) Industry relevance
    relevant_industries = {norm(i) for g in c.goals for cat in categories_for(g) for i in CAREER_TAXONOMY[cat]["industries"]}
    industry_match = bool(text["industry"]) and any(
        ind in text["industry"] or text["industry"] in ind for ind in relevant_industries
    )
    industry = 1.0 if industry_match else 0.0

    # 4) Job title relevance
    title_score = 0.0
    title_tokens = tokens(a.current_title)
    for role in c.target_roles:
        rt = tokens(role)
        if rt and title_tokens:
            title_score = max(title_score, len(rt & title_tokens) / len(rt))
    if title_score < 0.6:
        goal_keywords = {kw for g in c.goals for cat in categories_for(g) for kw in CAREER_TAXONOMY[cat]["keywords"]}
        if any(contains_keyword(text["title"], kw) for kw in goal_keywords):
            title_score = max(title_score, 0.6)
    job_title = min(1.0, title_score)

    # 5) Professional background: goal keywords and student skills mentioned in experience/bio
    probes = {norm_skill(s) for s in c.skills} | {norm(g) for g in c.goals}
    probes |= {kw for g in c.goals for cat in categories_for(g) for kw in CAREER_TAXONOMY[cat]["keywords"][:4]}
    hits = sum(1 for p in probes if p and contains_keyword(text["background"], p))
    background = min(1.0, hits / 3)

    components = {
        "career_goal": career,
        "skills": skills,
        "industry": industry,
        "job_title": job_title,
        "background": background,
    }
    total = sum(WEIGHTS[k] * v for k, v in components.items())
    breakdown = {k: round(WEIGHTS[k] * v, 1) for k, v in components.items()}

    alumni_interest_norm = {norm(i): i for i in (a.career_interests or [])}
    shared_interests = [i for i in c.career_interests if norm(i) in alumni_interest_norm]
    for cat in matched_categories:
        if cat not in shared_interests:
            shared_interests.append(cat)

    return MatchResult(
        score=int(round(total)),
        breakdown=breakdown,
        matched_goals=matched_goals,
        matched_categories=matched_categories,
        shared_skills=shared,
        shared_interests=shared_interests,
        industry_match=industry_match,
        title_match=job_title >= 0.6,
    )


def article(phrase: str) -> str:
    return "an" if phrase[:1].lower() in "aeiou" else "a"


def _distinct_goals(goals: list[str]) -> list[str]:
    """Drop goals that map to an already-mentioned category (e.g. 'Software Engineer' after 'Software Engineering')."""
    out: list[str] = []
    seen: set[str] = set()
    for g in goals:
        cats = set(categories_for(g)) or {g.lower()}
        if cats <= seen:
            continue
        seen |= cats
        out.append(g)
    return out


def explain(c: StudentCriteria, a: AlumniProfile, name: str, m: MatchResult) -> str:
    parts: list[str] = []
    role = f"{a.current_title} at {a.current_company}" if a.current_company else a.current_title
    goals = _distinct_goals(m.matched_goals)
    if goals:
        parts.append(f"{name} works as {article(role)} {role}, which lines up with your interest in {' and '.join(goals[:2])}.")
    elif m.industry_match:
        parts.append(f"{name} works in {a.industry}, an industry connected to your career goals.")
    else:
        parts.append(f"{name} works as {article(role)} {role}.")
    if m.shared_skills:
        parts.append(f"You both list {', '.join(m.shared_skills[:4])} as skills.")
    if m.industry_match and m.matched_goals:
        parts.append(f"Their industry ({a.industry}) is relevant to the roles you are targeting.")
    if a.coffee_chat_available:
        parts.append("They have marked themselves as open to coffee chats.")
    if m.score < 35:
        parts.append("This is a weaker match; it may still be useful for broadening your network.")
    return " ".join(parts)


def conversation_topics(c: StudentCriteria, a: AlumniProfile, m: MatchResult) -> list[str]:
    topics: list[str] = []
    if a.current_title and a.current_company:
        topics.append(f"What a typical week looks like as {article(a.current_title)} {a.current_title} at {a.current_company}")
    if m.shared_skills:
        topics.append(f"How {m.shared_skills[0]} is used day-to-day on their team")
    if a.industry:
        topics.append(f"How they got started in {a.industry} after USC")
    if c.target_roles:
        topics.append(f"Which experiences best prepare a student for {article(c.target_roles[0])} {c.target_roles[0]} role")
    missing = [s for s in (a.skills or []) if norm_skill(s) not in {norm_skill(x) for x in c.skills}]
    if missing:
        topics.append(f"Whether learning {missing[0]} would be worthwhile for your goals")
    return topics[:4]
