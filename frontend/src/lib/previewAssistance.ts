import type { Job, Review, Suggestion, TailorResult } from "../types";
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
    summary: `${evidence.filter((e) => e.status === "found").length} of ${evidence.length} requirements have supporting evidence.`,
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
  return (relevant.length ? relevant : lines.slice(0, 2)).flatMap((original) => {
    let suggested = original
      .replace(/^[-•]\s*/, "")
      .replace(/^Responsible for\s+/i, "")
      .replace(/^Worked on\s+/i, "Contributed to ");
    const m = suggested.match(/^Analyzed (.+?) with (SQL|Python|R)(.*)$/i);
    if (m) suggested = `Used ${m[2]} to analyze ${m[1]}${m[3]}`;
    if (suggested === original.replace(/^[-•]\s*/, "")) return [];
    return [
      {
        original,
        suggested,
        reason: `Leads with the skill the ${job.title} role asks for.`,
      },
    ];
  });
}
export function previewTailor(resume: string, job: Job): TailorResult {
  const review = previewReview(resume, job);
  return {
    suggestions: previewSuggestions(resume, job),
    additions: [],
    emphasize: review.evidence
      .filter((e) => e.status === "found")
      .map((e) => e.requirement),
    questions: review.questions,
  };
}
export type DraftKind = "referral" | "question" | "connection" | "coffee" | "reply";
/** Sample-mode stand-in for the backend draft endpoint: built only from the given facts. */
export function previewDraft(input: {
  kind: DraftKind;
  sender: { name: string; program: string; role: string; title: string; company: string };
  recipient?: { name: string; title: string; company: string };
  job?: Job;
  resume?: string;
  topic?: string;
  lastMessage?: string;
  status?: string;
}): string {
  const first = (n?: string) => n?.split(" ")[0] || "there";
  const me = first(input.sender.name);
  const hi = `Hi ${first(input.recipient?.name)},`;
  const who =
    input.sender.role === "student"
      ? `I'm ${input.sender.name}, a ${input.sender.program || "USC"} student at USC.`
      : `Thanks for reaching out.`;
  const sign = `\n\nThanks,\n${me}`;
  const evidence =
    input.job && input.resume
      ? previewReview(input.resume, input.job)
          .evidence.filter((e) => e.status === "found")
          .slice(0, 2)
          .map((e) => e.evidence.replace(/^[-•]\s*/, "").replace(/\.$/, ""))
      : [];
  const roleAt = input.job ? `the ${input.job.title} role at ${input.job.company}` : "";
  switch (input.kind) {
    case "referral":
      return `${hi}\n\n${who} I'm very interested in ${roleAt}.${
        evidence.length
          ? ` The experience most relevant to the role: ${evidence.join("; and ")}.`
          : ""
      }\n\nI've attached my resume. Would you be open to referring me, or to sharing what the team looks for in candidates?${sign}`;
    case "question":
      return `${hi}\n\n${who} I'm interested in ${roleAt} and had two quick questions: what does a typical week look like for this role, and which skills matter most for someone joining the ${input.job?.team || "team"}?${sign}`;
    case "connection":
      return `${hi}\n\n${who} I noticed you're ${input.recipient?.title || "working"} at ${input.recipient?.company || "your company"}, and I'd value your perspective on ${input.topic || "your career path and how you got started"}. Would you be open to connecting?${sign}`;
    case "coffee":
      return `${hi}\n\n${who} I'd love to hear about your work at ${input.recipient?.company || "your company"} over a short coffee chat, especially ${input.topic || "how you got started"}. Would 20 minutes sometime in the next two weeks work for you?${sign}`;
    default:
      return input.sender.role === "student"
        ? `${hi}\n\nThank you for getting back to me. I'm happy to share more about my experience, and I'm flexible on timing for a quick call.${sign}`
        : `${hi}\n\n${who} ${
            input.status === "interested"
              ? "Your background looks relevant. Could you share your availability for a short call next week?"
              : "Could you tell me a bit more about the experience most relevant to this role?"
          }${sign}`;
  }
}
