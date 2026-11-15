import { resumeContent, splitResume } from "./resumeContent";

const RED: [number, number, number] = [153, 27, 30];

/** Lay out resume text (the editable text used everywhere in the app) as a one-column PDF. */
export async function resumePdf(text: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const parts = splitResume(text);
  const c = resumeContent(text, {});
  const [name = "Resume", ...contactLines] = parts.intro;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const L = 43,
    R = W - 43;
  let y = 52;

  const room = (needed: number) => {
    if (y + needed > H - 40) {
      doc.addPage();
      y = 48;
    }
  };
  const font = (style: "normal" | "bold" | "italic", size: number) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };
  const row = (
    left: string,
    right: string,
    style: "bold" | "italic" | "normal",
  ) => {
    room(13);
    y += 13;
    font(style, 9.8);
    const maxLeft = R - L - (right ? doc.getTextWidth(right) + 16 : 0);
    doc.text(doc.splitTextToSize(left, maxLeft)[0] || "", L, y);
    if (right) {
      font(style === "bold" ? "normal" : style, 9.8);
      doc.text(right, R, y, { align: "right" });
    }
  };
  const paragraph = (value: string, indent = 0, bullet = false) => {
    font("normal", 9.8);
    const lines = doc.splitTextToSize(value, R - L - indent - (bullet ? 9 : 0));
    lines.forEach((line: string, i: number) => {
      room(12.6);
      y += 12.6;
      if (bullet && i === 0) doc.text("•", L + indent, y);
      doc.text(line, L + indent + (bullet ? 9 : 0), y);
    });
  };
  const heading = (title: string) => {
    room(34);
    y += 20;
    font("bold", 10.5);
    doc.setTextColor(...RED);
    doc.text(title, L, y);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.7);
    doc.line(L, y + 3, R, y + 3);
    doc.setTextColor(0, 0, 0);
    y += 3;
  };

  font("bold", 18);
  doc.text(name, W / 2, y, { align: "center" });
  if (contactLines.length) {
    y += 15;
    font("normal", 8.6);
    doc.text(
      doc.splitTextToSize(contactLines.join(" | ").replace(/ · /g, " | "), R - L)[0],
      W / 2,
      y,
      { align: "center" },
    );
  }
  if (parts.summary.length) {
    heading("SUMMARY");
    paragraph(parts.summary.join(" "));
  }
  const DATE =
    /^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}$|^(?:Present|Current|Now)$/i;
  const entries = (title: string, lines: string[]) => {
    if (!lines.length) return;
    heading(title);
    for (const line of lines) {
      const fields = line.split(" · ").map((f) => f.trim()).filter(Boolean);
      if (fields.length < 3) {
        paragraph(line.replace(/^[-•]\s*/, ""), 2, true);
        continue;
      }
      const dates = fields.filter((f) => DATE.test(f));
      const location = fields.find((f) => /,\s*[A-Z]{2}$|^Remote$/.test(f));
      const link = fields.find((f) => !/\s/.test(f) && /\w\.\w+\//.test(f));
      const gpa = fields.find((f) => /^[0-4]\.\d{1,2}$/.test(f));
      const rest = fields.filter(
        (f) => !dates.includes(f) && f !== location && f !== link && f !== gpa,
      );
      const [primary = "", ...secondary] = rest;
      row([primary, link].filter(Boolean).join(" | "), dates.join(" – "), "bold");
      const sub = [secondary.join(" "), gpa && `GPA: ${gpa}`]
        .filter(Boolean)
        .join(", ");
      if (sub || location) row(sub, location || "", "italic");
    }
  };
  entries("EDUCATION", parts.education);
  entries("EXPERIENCE", parts.experience);
  entries("PROJECTS", parts.projects);
  if (c.skills.length) {
    heading("SKILLS");
    paragraph(c.skills.join(", "));
  }
  doc.setProperties({ title: `${name} – Resume` });
  return doc.output("blob");
}

export function pdfName(name: string, label: string) {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return `${slug(name) || "resume"}_${slug(label) || "resume"}.pdf`;
}

export async function downloadResumePdf(text: string, filename: string) {
  const url = URL.createObjectURL(await resumePdf(text));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
