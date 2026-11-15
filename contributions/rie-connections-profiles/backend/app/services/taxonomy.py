"""Small career taxonomy used by the deterministic recommender.

Each category maps to keywords (matched against titles, interests and experience text)
and to industries that are typically relevant to it.
"""
from __future__ import annotations

import re

CAREER_TAXONOMY: dict[str, dict[str, list[str]]] = {
    "Software Engineering": {
        "keywords": ["software", "engineer", "engineering", "developer", "backend", "frontend",
                     "full stack", "full-stack", "platform", "cloud", "devops", "infrastructure", "swe"],
        "industries": ["technology", "software", "cloud computing", "fintech", "gaming", "e-commerce"],
    },
    "Machine Learning & AI": {
        "keywords": ["machine learning", "ml", "ai", "artificial intelligence", "deep learning", "nlp",
                     "computer vision", "llm", "research scientist", "applied scientist"],
        "industries": ["technology", "artificial intelligence", "healthcare ai", "robotics", "autonomous vehicles"],
    },
    "Data Science & Analytics": {
        "keywords": ["data", "analytics", "analyst", "data scientist", "statistics", "sql",
                     "business intelligence", "insights"],
        "industries": ["technology", "finance", "healthcare", "consulting", "sports analytics", "e-commerce"],
    },
    "Product Management": {
        "keywords": ["product", "product manager", "product management", "roadmap", "pm", "product strategy"],
        "industries": ["technology", "software", "fintech", "e-commerce", "gaming"],
    },
    "UX & Product Design": {
        "keywords": ["design", "designer", "ux", "ui", "user research", "interaction design", "figma"],
        "industries": ["technology", "media & entertainment", "gaming", "e-commerce"],
    },
    "Finance & Investment": {
        "keywords": ["finance", "financial", "investment", "banking", "private equity", "valuation",
                     "venture capital", "asset management", "trading"],
        "industries": ["finance", "investment banking", "venture capital", "fintech", "asset management"],
    },
    "Consulting & Strategy": {
        "keywords": ["consulting", "consultant", "strategy", "strategic", "operations", "advisory"],
        "industries": ["consulting", "management consulting"],
    },
    "Marketing & Growth": {
        "keywords": ["marketing", "brand", "growth", "content", "social media", "communications", "seo"],
        "industries": ["marketing", "media & entertainment", "consumer goods", "e-commerce"],
    },
    "Media & Entertainment": {
        "keywords": ["media", "entertainment", "film", "production", "studio", "streaming", "music", "producer"],
        "industries": ["media & entertainment", "gaming"],
    },
    "Game Development": {
        "keywords": ["game", "games", "gaming", "unity", "unreal", "gameplay"],
        "industries": ["gaming", "media & entertainment"],
    },
    "Healthcare & Biotech": {
        "keywords": ["health", "healthcare", "biotech", "clinical", "medical", "bioinformatics", "pharma"],
        "industries": ["healthcare", "healthcare ai", "biotech"],
    },
    "Cybersecurity": {
        "keywords": ["security", "cybersecurity", "cyber", "threat", "privacy", "infosec"],
        "industries": ["technology", "cybersecurity", "government"],
    },
    "Entrepreneurship": {
        "keywords": ["founder", "startup", "entrepreneur", "entrepreneurship", "co-founder", "venture"],
        "industries": ["technology", "venture capital"],
    },
    "Sustainability & Energy": {
        "keywords": ["sustainability", "energy", "climate", "renewable", "clean tech", "environmental"],
        "industries": ["energy", "clean energy"],
    },
}

SKILL_SYNONYMS = {
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "js": "javascript",
    "ts": "typescript",
    "react.js": "react",
    "reactjs": "react",
    "node": "node.js",
    "nodejs": "node.js",
    "py": "python",
    "postgres": "postgresql",
    "k8s": "kubernetes",
    "aws cloud": "aws",
    "data analytics": "data analysis",
    "nlp": "natural language processing",
    "ux": "ux design",
    "ui/ux": "ux design",
}

STOPWORDS = {"and", "of", "the", "a", "an", "in", "at", "for", "to", "with", "&", "senior", "junior",
             "sr", "jr", "lead", "staff", "principal", "ii", "iii", "i", "associate"}


def norm(text: str) -> str:
    return " ".join(str(text).lower().replace("/", " / ").split()).replace(" / ", "/")


def norm_skill(skill: str) -> str:
    s = norm(skill)
    return SKILL_SYNONYMS.get(s, s)


def tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9+#.]+", norm(text)) if t not in STOPWORDS and len(t) > 1 or t in {"ai", "ml", "ux", "ui", "pm"}}


def contains_keyword(text: str, keyword: str) -> bool:
    """Whole-word / whole-phrase match, so 'ai' does not match 'maintain'."""
    pattern = r"(?<![a-z0-9])" + re.escape(keyword.lower()) + r"(?![a-z0-9])"
    return re.search(pattern, text.lower()) is not None


def categories_for(goal: str) -> list[str]:
    """Map a free-text career goal / interest to taxonomy categories."""
    g = norm(goal)
    found: list[str] = []
    for name, data in CAREER_TAXONOMY.items():
        n = norm(name)
        if g == n or g in n or n in g:
            found.append(name)
            continue
        if any(contains_keyword(g, kw) for kw in data["keywords"]):
            found.append(name)
    return found
