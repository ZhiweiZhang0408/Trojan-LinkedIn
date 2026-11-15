"""Optional LLM enhancement (Anthropic Messages API format).

Used only when BOTH an LLM_API_KEY is configured AND the user explicitly opts in
(`use_llm: true` in the request). Any error falls back to the deterministic path.
Only the minimal profile fields needed for the task are sent.
"""
from __future__ import annotations

import json
import logging

import httpx

from ..config import settings

logger = logging.getLogger("trojanlink.llm")

SYSTEM_PROMPT = (
    "You help USC students write short, sincere professional networking messages and explain "
    "alumni matches. Use ONLY the facts provided. Never invent shared experiences, mutual "
    "contacts, classes, internships, qualifications or achievements. Do not exaggerate."
)


def llm_available() -> bool:
    return bool(settings.llm_api_key)


def _call(prompt: str, max_tokens: int = 600) -> str | None:
    if not settings.llm_api_key:
        return None
    try:
        resp = httpx.post(
            settings.llm_api_url,
            headers={
                "x-api-key": settings.llm_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": settings.llm_model,
                "max_tokens": max_tokens,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")
        return text.strip() or None
    except Exception as exc:  # network, auth, schema — always fall back
        logger.warning("LLM call failed, using fallback: %s", exc)
        return None


def llm_message(facts: dict, draft: str) -> str | None:
    prompt = (
        "Rewrite this networking message so it reads naturally (under 170 words). Keep the same facts, "
        "keep the greeting and sign-off, and do not add any new claims.\n\n"
        f"FACTS (JSON): {json.dumps(facts)}\n\nDRAFT:\n{draft}\n\nReturn only the message text."
    )
    return _call(prompt)


def llm_explanations(student: dict, matches: list[dict]) -> dict[int, str]:
    """Returns {alumni_user_id: explanation}. Empty dict on any failure."""
    prompt = (
        "For each alumni match, write a 1-2 sentence explanation of why the student may want to connect, "
        "based only on the given fields. Respond with JSON: {\"<user_id>\": \"explanation\", ...}.\n\n"
        f"STUDENT: {json.dumps(student)}\nMATCHES: {json.dumps(matches)}"
    )
    text = _call(prompt, max_tokens=900)
    if not text:
        return {}
    try:
        start, end = text.find("{"), text.rfind("}")
        data = json.loads(text[start : end + 1])
        return {int(k): str(v) for k, v in data.items()}
    except (ValueError, TypeError):
        return {}
