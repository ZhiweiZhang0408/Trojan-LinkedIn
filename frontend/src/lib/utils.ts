import type { Person } from "../types";
export const uid = () => crypto.randomUUID();
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
export const readableDate = (date: string) =>
  date
    ? new Date(
        date.length === 10 ? date + "T12:00:00" : date,
      ).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "No deadline listed";
export function timeAgo(date: string) {
  const n = Math.max(0, Math.floor((Date.now() - +new Date(date)) / 86400000));
  return n === 0 ? "Today" : n === 1 ? "1 day ago" : `${n} days ago`;
}
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
export const isExpired = (date: string) =>
  !!date && date < new Date().toLocaleDateString("en-CA");
export function profileResume(p: Person) {
  return `${p.name}\n${p.email} | ${p.location}\n\nEDUCATION\n${p.education || `${p.school} — ${p.program}, ${p.year}`}\n\nEXPERIENCE\n${p.experience}\n\nPROJECTS\n${p.projects}\n\nSKILLS\n${p.skills.join(", ")}`;
}
export function safeUrl(value: string): string | undefined {
  try {
    const u = new URL(value);
    return ["https:", "http:", "mailto:"].includes(u.protocol)
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
