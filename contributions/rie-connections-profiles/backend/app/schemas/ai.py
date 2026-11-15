from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .common import TagList
from .connections import AlumniCard


class RecommendRequest(BaseModel):
    """Optional overrides; anything omitted falls back to the student's saved profile."""

    career_interests: TagList | None = None
    skills: TagList | None = None
    target_roles: TagList | None = None
    limit: int = Field(default=6, ge=1, le=20)
    use_llm: bool = Field(
        default=False,
        description="Explicit consent to send profile fields to the configured LLM for richer explanations",
    )


class ScoreBreakdown(BaseModel):
    career_goal: float
    skills: float
    industry: float
    job_title: float
    background: float


class Recommendation(BaseModel):
    alumni: AlumniCard
    match_score: int = Field(description="Weighted heuristic 0-100; not a validated compatibility probability")
    breakdown: ScoreBreakdown
    explanation: str
    shared_skills: list[str]
    shared_interests: list[str]
    conversation_topics: list[str]
    explanation_source: Literal["rules", "llm"] = "rules"


class RecommendResponse(BaseModel):
    items: list[Recommendation]
    total: int
    criteria: dict[str, list[str]]
    weights: dict[str, int]
    disclaimer: str


Purpose = Literal["coffee_chat", "career_advice", "industry_insight", "application_advice", "mentorship"]


class GenerateMessageRequest(BaseModel):
    alumni_id: int
    purpose: Purpose = "coffee_chat"
    tone: Literal["friendly", "formal"] = "friendly"
    personal_note: str = Field(
        default="",
        max_length=400,
        description="Optional fact the student wants included, written by the student",
    )
    use_llm: bool = Field(default=False, description="Explicit consent to use the configured LLM")


class GenerateMessageResponse(BaseModel):
    subject: str
    message: str
    source: Literal["template", "llm"]
    inputs_used: dict[str, str | list[str]]
    notice: str
