from __future__ import annotations

import re
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict

T = TypeVar("T")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    """Consistent envelope for list endpoints."""

    items: list[T]
    total: int


class Message(BaseModel):
    detail: str


def _clean_list(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        item = " ".join(str(value).split())[:60]
        if item and item.lower() not in seen:
            seen.add(item.lower())
            out.append(item)
    if len(out) > 30:
        raise ValueError("At most 30 items are allowed")
    return out


def _clean_url(value: str) -> str:
    value = value.strip()
    if value and not re.match(r"^https?://[^\s]+$", value):
        raise ValueError("Must be an http(s) URL")
    if len(value) > 500:
        raise ValueError("URL is too long")
    return value


def _clean_email(value: str) -> str:
    value = value.strip().lower()
    if not EMAIL_RE.match(value) or len(value) > 255:
        raise ValueError("Enter a valid email address")
    return value


TagList = Annotated[list[str], AfterValidator(_clean_list)]
UrlStr = Annotated[str, AfterValidator(_clean_url)]
EmailStr = Annotated[str, AfterValidator(_clean_email)]
