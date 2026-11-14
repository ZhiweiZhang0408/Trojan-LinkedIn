"""Resume import: file -> plain text -> draft ResumeContent.

Pipeline:
1. extract_text()   PDF via pypdf, DOCX via python-docx (paragraphs + tables, in document order)
2. organize_text()  Backend B's AI organizer if available, otherwise the rule-based parser below

The rule-based parser is a fallback so the demo works without AI. It only fills what it can
detect and leaves the rest empty; the student fixes everything on the review screen.
"""
import io
import logging
import re

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from pypdf import PdfReader

from . import ai_service
from .schemas import ResumeContent

log = logging.getLogger("uvicorn.error")


class ResumeReadError(Exception):
    """The file could not be read or contained no extractable text."""


# ---------- 1. Text extraction ----------

PDF_MAGIC = b"%PDF"
DOCX_MAGIC = b"PK\x03\x04"  # DOCX is a zip archive


def sniff_type(data: bytes, ext: str) -> str:
    """Check the real file type against its extension (rejects renamed files)."""
    if ext == ".pdf" and data.startswith(PDF_MAGIC):
        return "pdf"
    if ext == ".docx" and data.startswith(DOCX_MAGIC):
        return "docx"
    raise ResumeReadError("File content does not match a PDF or DOCX file")


def _pdf_text(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:  # pypdf raises many different error types on bad files
        raise ResumeReadError("Could not read this PDF") from exc


def _docx_text(data: bytes) -> str:
    try:
        doc = Document(io.BytesIO(data))
    except Exception as exc:
        raise ResumeReadError("Could not read this DOCX file") from exc

    lines: list[str] = []
    # Walk the body in order so tables (common in resume templates) stay in place
    for child in doc.element.body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            p = Paragraph(child, doc)
            text = p.text.strip()
            if not text:
                continue
            # Word list items carry no bullet character in their text; add one
            is_list = p._p.pPr is not None and p._p.pPr.numPr is not None
            if is_list or "list" in (p.style.name or "").lower():
                text = f"• {text}"
            lines.append(text)
        elif tag == "tbl":
            for row in Table(child, doc).rows:
                seen: set[int] = set()
                for cell in row.cells:
                    if id(cell._tc) in seen:  # merged cells repeat; read once
                        continue
                    seen.add(id(cell._tc))
                    lines.extend(t.strip() for t in cell.text.splitlines() if t.strip())
    return "\n".join(lines)


def extract_text(data: bytes, kind: str) -> str:
    text = _pdf_text(data) if kind == "pdf" else _docx_text(data)
    text = text.replace("\x00", "").strip()
    if len(text) < 20:
        # Usually a scanned (image-only) PDF; OCR is out of scope for the MVP
        raise ResumeReadError("No readable text found. Try another file or fill in the form manually")
    return text


# ---------- 2. Organizing text into ResumeContent ----------

def organize_text(text: str) -> tuple[ResumeContent, str]:
    """Returns (content, parser) where parser is "ai" or "rules"."""
    try:
        content = ai_service.organize_resume(text)
        if content is not None:
            return content, "ai"
    except Exception:
        log.exception("AI resume organizer failed; falling back to rules")
    return parse_with_rules(text), "rules"


# ---------- Rule-based fallback parser ----------

SECTION_ALIASES = {
    "summary": ["summary", "profile", "objective", "about me", "about", "professional summary"],
    "education": ["education", "academic background", "education and coursework"],
    "experience": ["experience", "work experience", "professional experience", "employment",
                   "work history", "relevant experience", "internships", "leadership experience"],
    "projects": ["projects", "personal projects", "selected projects", "academic projects",
                 "technical projects"],
    "skills": ["skills", "technical skills", "skills and interests", "skills & interests",
               "core skills", "technologies", "languages and technologies"],
}
_HEADING_LOOKUP = {alias: section for section, aliases in SECTION_ALIASES.items() for alias in aliases}

BULLET_RE = re.compile(r"^\s*[•●▪◦‣∙·\-\*–]\s*")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE_RE = re.compile(r"(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
URL_RE = re.compile(r"(?:https?://)?(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:/[\w\-./?=&%#]*)?")
MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?"
DATE = rf"(?:{MONTH}\s+\d{{4}}|\b\d{{1,2}}/\d{{4}}|\b\d{{4}}\b)"
DATE_RANGE_RE = re.compile(
    rf"({DATE})\s*(?:-|–|—|to)\s*({DATE}|Present|Current|Now)|(?:Expected\s+)?({MONTH}\s+\d{{4}})",
    re.IGNORECASE,
)
GPA_RE = re.compile(r"GPA[:\s]*([0-4]\.\d{1,2})(?:\s*/\s*4\.0+)?", re.IGNORECASE)
DEGREE_RE = re.compile(
    r"\b(B\.S\.|B\.A\.|M\.S\.|M\.A\.|BS|BA|MS|MBA|Ph\.?D\.?|Bachelor(?:'s)?(?: of [A-Z][a-z]+)?|"
    r"Master(?:'s)?(?: of [A-Z][a-z]+)?|Associate(?:'s)?)(?=\s|,|$)"
)
SCHOOL_RE = re.compile(r"\b(University|College|Institute|School|Academy)\b", re.IGNORECASE)
LOCATION_RE = re.compile(r",\s*[A-Z]{2}\b|\bRemote\b|\bHybrid\b")
SEPARATORS = " ,|–—-\t"


def _as_heading(line: str) -> str | None:
    key = re.sub(r"[^a-z& ]", "", line.lower()).strip()
    return _HEADING_LOOKUP.get(key) if len(key) <= 40 else None


def _pull_dates(text: str) -> tuple[str | None, str | None, str]:
    """Find a date range in text; return (start, end, text without the dates)."""
    m = DATE_RANGE_RE.search(text)
    if not m:
        return None, None, text
    if m.group(1):
        start, end = m.group(1), m.group(2)
    else:
        start, end = None, m.group(3)  # a single date, e.g. "Expected May 2027"
    rest = (text[: m.start()] + " " + text[m.end():]).strip(SEPARATORS)
    return start, end, rest


def _split_header(line: str) -> list[str]:
    # Split on visual separators only; commas stay so "Los Angeles, CA" survives
    parts = re.split(r"\s+[|–—]\s+|\s+-\s+|\s{2,}|\t", line)
    return [p.strip(SEPARATORS) for p in parts if p.strip(SEPARATORS)]


def _group_entries(lines: list[str]) -> list[tuple[list[str], list[str]]]:
    """Split a section into entries of (header lines, bullet lines).

    A non-bullet line after bullets starts a new entry.
    """
    entries: list[tuple[list[str], list[str]]] = []
    headers: list[str] = []
    bullets: list[str] = []
    for line in lines:
        if BULLET_RE.match(line):
            bullets.append(BULLET_RE.sub("", line).strip())
        else:
            if bullets:
                entries.append((headers, bullets))
                headers, bullets = [], []
            headers.append(line)
    if headers or bullets:
        entries.append((headers, bullets))
    return entries


def _header_parts(headers: list[str], item: dict) -> list[str]:
    """Pull dates into item and return the remaining header pieces."""
    parts: list[str] = []
    for h in headers:
        start, end, rest = _pull_dates(h)
        if end and not item.get("end"):
            item["start"], item["end"] = start, end
        parts.extend(_split_header(rest))
    return parts


def _parse_contact(top_lines: list[str], text: str) -> dict:
    contact: dict = {}
    if m := EMAIL_RE.search(text):
        contact["email"] = m.group(0)
    if m := PHONE_RE.search(text):
        contact["phone"] = m.group(0).strip()
    for url in URL_RE.findall(" ".join(top_lines)):
        if "@" in url or "." not in url:
            continue
        if "linkedin" in url.lower():
            contact.setdefault("linkedin", url)
        elif any(s in url.lower() for s in ("github", ".io", ".dev", ".me", "portfolio")):
            contact.setdefault("website", url)
    for line in top_lines[:3]:
        # The name is usually the first short line without contact details
        if not EMAIL_RE.search(line) and not PHONE_RE.search(line) and 1 <= len(line.split()) <= 5:
            contact["name"] = line.strip()
            break
    for line in top_lines[:4]:
        if (m := re.search(r"[A-Z][a-zA-Z .]+,\s*[A-Z]{2}\b", line)) and "location" not in contact:
            contact["location"] = m.group(0)
    return contact


def _parse_education(lines: list[str]) -> list[dict]:
    items: list[dict] = []
    cur: dict | None = None
    for line in lines:
        is_bullet = bool(BULLET_RE.match(line))
        start, end, rest = _pull_dates(BULLET_RE.sub("", line).strip())
        if not is_bullet and SCHOOL_RE.search(rest):
            cur = {"details": []}
            items.append(cur)
            parts = _split_header(rest)
            school = next(p for p in parts if SCHOOL_RE.search(p))
            cur["school"] = school
            rest = "  ".join(p for p in parts if p != school and not LOCATION_RE.search(p))
        if cur is None:
            cur = {"details": []}
            items.append(cur)
        if end and not cur.get("end"):
            cur["start"], cur["end"] = start, end
        if m := GPA_RE.search(rest):
            cur["gpa"] = m.group(1)
            rest = GPA_RE.sub("", rest).strip(SEPARATORS)
        if not cur.get("degree") and (m := DEGREE_RE.search(rest)):
            cur["degree"] = m.group(1)
            major = rest[m.end():].strip(SEPARATORS + ":")
            major = re.sub(r"^(in|of)\s+", "", major, flags=re.IGNORECASE).strip(SEPARATORS)
            if major:
                cur["major"] = major
            rest = ""
        if rest := rest.strip(SEPARATORS):
            cur["details"].append(rest)
    return items


def _parse_experience(lines: list[str]) -> list[dict]:
    items = []
    for headers, bullets in _group_entries(lines):
        item: dict = {"bullets": bullets}
        parts = _header_parts(headers, item)
        if len(parts) == 1 and " at " in parts[0]:
            parts = parts[0].split(" at ", 1)[::-1]  # "Title at Company"
        locations = [p for p in parts if LOCATION_RE.search(p)]
        others = [p for p in parts if p not in locations]
        if locations:
            item["location"] = locations[0]
        # Most templates put the company first, then the title; the student can swap them
        if others:
            item["company"] = others[0]
        if len(others) > 1:
            item["title"] = others[1]
        items.append(item)
    return items


def _parse_projects(lines: list[str]) -> list[dict]:
    items = []
    for headers, bullets in _group_entries(lines):
        item: dict = {"bullets": bullets}
        for i, h in enumerate(headers):
            if (m := URL_RE.search(h)) and "." in m.group(0) and not item.get("link"):
                item["link"] = m.group(0)
                headers[i] = h.replace(m.group(0), "")
        parts = _header_parts(headers, item)
        if parts:
            item["name"] = parts[0]
        if len(parts) > 1:
            item["role"] = parts[1]
        items.append(item)
    return items


def _parse_skills(lines: list[str]) -> list[str]:
    skills: list[str] = []
    for line in lines:
        line = BULLET_RE.sub("", line)
        line = re.sub(r"^[A-Za-z &/]{2,30}:\s*", "", line)  # drop "Languages:" style labels
        for s in re.split(r"[,;|•·]", line):
            s = s.strip(" .")
            if s and len(s) <= 40 and s.lower() not in (x.lower() for x in skills):
                skills.append(s)
    return skills


def parse_with_rules(text: str) -> ResumeContent:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    sections: dict[str, list[str]] = {"_top": []}
    current = "_top"
    for line in lines:
        heading = _as_heading(line)
        if heading:
            current = heading
            sections.setdefault(current, [])
        else:
            sections.setdefault(current, []).append(line)

    top = sections["_top"]
    return ResumeContent.model_validate({
        "contact": _parse_contact(top, text),
        "summary": " ".join(sections["summary"]) if sections.get("summary") else None,
        "education": _parse_education(sections.get("education", [])),
        "experience": _parse_experience(sections.get("experience", [])),
        "projects": _parse_projects(sections.get("projects", [])),
        "skills": _parse_skills(sections.get("skills", [])),
    })
