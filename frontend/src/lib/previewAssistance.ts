import type { Job, Review, Suggestion } from "../types";
const stop = new Set([
  "the",
  "and",
  "with",
  "for",
  "that",
  "this",
  "from",
  "your",
  "have",
  "experience",
  "ability",
  "knowledge",
  "familiarity",
  "understanding",
  "interest",
  "strong",
  "clear",
  "using",
  "work",
  "working",
]);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .match(/[a-z][a-z+#./-]{1,}/g)
    ?.filter((x) => !stop.has(x)) || [];
export function previewReview(resume: string, job: Job): Review {
  const sentences = resume
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const evidence = job.requirements
    .split(/\n/)
    .map((s) => s.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((requirement) => {
      const keys = [...new Set(tokens(requirement))];
      const ranked = sentences
        .map((line) => ({
          line,
          count: keys.filter((k) => tokens(line).includes(k)).length,
        }))
        .sort((a, b) => b.count - a.count);
      const top = ranked[0];
      return {
        requirement,
        status: !top?.count
          ? ("missing" as const)
          : top.count >= Math.min(2, keys.length)
            ? ("found" as const)
            : ("partial" as const),
        evidence: top?.count
          ? top.line
          : "No supporting passage found in the submitted resume.",
      };
    });
  return {
    summary:
      "This local preview highlights keyword overlap in the submitted resume. Read the supporting passages and confirm relevance with the student.",
    evidence,
    questions: evidence
      .filter((e) => e.status !== "found")
      .slice(0, 3)
      .map(
        (e) =>
          `Could you share an example related to: ${e.requirement.toLowerCase()}?`,
      ),
  };
}
export function previewSuggestions(resume: string, job: Job): Suggestion[] {
  const lines = resume
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x.length > 45 && !/@/.test(x));
  const relevant = lines
    .filter((x) => tokens(job.requirements).some((k) => tokens(x).includes(k)))
    .slice(0, 3);
  return (relevant.length ? relevant : lines.slice(0, 2)).map((original) => {
    let suggested = original
      .replace(/^[-•]\s*/, "")
      .replace(/^Responsible for\s+/i, "")
      .replace(/^Worked on\s+/i, "Contributed to ");
    const m = suggested.match(/^Analyzed (.+?) with (SQL|Python|R)(.*)$/i);
    if (m) suggested = `Used ${m[2]} to analyze ${m[1]}${m[3]}`;
    return {
      original,
      suggested,
      reason: `This passage shares terms with the ${job.title} requirements. Review its relevance and edit the wording; this preview does not add facts.`,
    };
  });
}
