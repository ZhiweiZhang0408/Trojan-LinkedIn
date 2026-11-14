"""Generate the fictional demo resumes in samples/: python scripts/make_sample_resumes.py

Used for the demo walkthrough and by the tests. Alex Kim is a fictional student.
"""
from pathlib import Path

from docx import Document

OUT = Path(__file__).resolve().parent.parent / "samples"

LINES = [
    "Alex Kim",
    "Los Angeles, CA | alex.kim@usc.edu | (213) 555-0142 | linkedin.com/in/alex-kim-demo | github.com/alexkim-demo",
    "EDUCATION",
    "University of Southern California    Aug 2023 – May 2027",
    "B.S. Computer Science, GPA: 3.7/4.0",
    "• Coursework: Operating Systems, Distributed Systems, Databases",
    "EXPERIENCE",
    "USC Viterbi IT    Los Angeles, CA",
    "Student Developer    Sep 2024 – Present",
    "• Built a Python service that syncs lab reservations for 1,200 students",
    "• Cut nightly job runtime from 40 to 12 minutes by batching database writes",
    "Trojan Robotics Club",
    "Software Lead    Jan 2024 – Aug 2024",
    "• Led a team of 5 building ROS navigation for a campus delivery robot",
    "PROJECTS",
    "Toy Distributed KV Store | github.com/alexkim-demo/kv    Jan 2025 – Apr 2025",
    "• Raft-based replication in Go across 5 nodes",
    "• Wrote a fault-injection test harness that found 3 leader-election bugs",
    "SKILLS",
    "Languages: Go, Python, Java, SQL",
    "Tools: Docker, Linux, Git, PostgreSQL",
]


def make_pdf(lines: list[str] = LINES) -> bytes:
    """A minimal one-page text PDF (Helvetica, WinAnsi) with no extra dependencies."""

    def esc(line: str) -> bytes:
        raw = line.encode("cp1252")
        return raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")

    stream = b"BT /F1 10 Tf 14 TL 50 760 Td " + b" ".join(b"(" + esc(ln) + b") Tj T*" for ln in lines) + b" ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % off for off in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


def make_docx(path: Path, lines: list[str] = LINES) -> None:
    """A DOCX using real Word bullets and a table for the header, like common templates."""
    doc = Document()
    header = doc.add_table(rows=1, cols=2)
    header.cell(0, 0).text = lines[0]
    header.cell(0, 1).text = lines[1]
    for line in lines[2:]:
        if line.startswith("• "):
            doc.add_paragraph(line[2:], style="List Bullet")
        else:
            doc.add_paragraph(line)
    doc.save(path)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    (OUT / "alex_kim_resume.pdf").write_bytes(make_pdf())
    make_docx(OUT / "alex_kim_resume.docx")
    print(f"Wrote samples to {OUT}")
