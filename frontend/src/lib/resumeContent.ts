export interface ResumeContent {
  contact: {
    name?: string | null;
    email?: string | null;
    location?: string | null;
    phone?: string | null;
    linkedin?: string | null;
    website?: string | null;
  };
  summary?: string | null;
  education: {
    school?: string | null;
    degree?: string | null;
    major?: string | null;
    start?: string | null;
    end?: string | null;
    gpa?: string | null;
    details: string[];
  }[];
  experience: {
    company?: string | null;
    title?: string | null;
    location?: string | null;
    start?: string | null;
    end?: string | null;
    bullets: string[];
  }[];
  projects: {
    name?: string | null;
    role?: string | null;
    link?: string | null;
    start?: string | null;
    end?: string | null;
    bullets: string[];
  }[];
  skills: string[];
}
const join = (values: (string | null | undefined)[]) =>
  values.filter(Boolean).join(" · ");
export const educationHeading = (e: ResumeContent["education"][number]) =>
  join([e.school, e.degree, e.major, e.start, e.end, e.gpa]);
export const experienceHeading = (e: ResumeContent["experience"][number]) =>
  join([e.company, e.title, e.location, e.start, e.end]);
export const projectHeading = (e: ResumeContent["projects"][number]) =>
  join([e.name, e.role, e.link, e.start, e.end]);

export function resumeText(c: ResumeContent): string {
  const section = (heading: string, lines: (string | null | undefined)[]) =>
    lines.some(Boolean) ? [heading, ...lines.filter(Boolean)].join("\n") : "";
  return [
    [
      c.contact.name,
      join([
        c.contact.email,
        c.contact.phone,
        c.contact.location,
        c.contact.linkedin,
        c.contact.website,
      ]),
    ]
      .filter(Boolean)
      .join("\n"),
    section("SUMMARY", [c.summary]),
    section(
      "EDUCATION",
      c.education.flatMap((e) => [educationHeading(e), ...e.details]),
    ),
    section(
      "EXPERIENCE",
      c.experience.flatMap((e) => [experienceHeading(e), ...e.bullets]),
    ),
    section(
      "PROJECTS",
      c.projects.flatMap((e) => [projectHeading(e), ...e.bullets]),
    ),
    section("SKILLS", [c.skills.join(", ")]),
  ]
    .filter(Boolean)
    .join("\n\n");
}
export function splitResume(text: string) {
  const parts = {
    intro: [] as string[],
    summary: [] as string[],
    education: [] as string[],
    experience: [] as string[],
    projects: [] as string[],
    skills: [] as string[],
  };
  let section: keyof typeof parts = "intro";
  for (const line of text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)) {
    const heading = line.toLowerCase().replace(/:$/, "");
    if (
      ["summary", "professional summary", "objective", "profile"].includes(
        heading,
      )
    )
      section = "summary";
    else if (heading === "education") section = "education";
    else if (
      [
        "experience",
        "work experience",
        "professional experience",
        "employment",
      ].includes(heading)
    )
      section = "experience";
    else if (
      ["projects", "selected projects", "academic projects"].includes(heading)
    )
      section = "projects";
    else if (
      ["skills", "technical skills", "skills & interests"].includes(heading)
    )
      section = "skills";
    else parts[section].push(line);
  }
  return parts;
}
function readGroup<T>(
  lines: string[],
  previous: T[],
  heading: (item: T) => string,
  replace: (item: T, lines: string[]) => T,
  create: (lines: string[]) => T,
): T[] {
  if (!lines.length) return [];
  if (!previous.length) return [create(lines)];
  if (previous.length === 1 && !heading(previous[0]))
    return [replace(previous[0], lines)];
  const positions = previous.map((item) => lines.indexOf(heading(item)));
  if (
    positions.some(
      (position, index) =>
        position < 0 || (index > 0 && position <= positions[index - 1]),
    )
  )
    return [create(lines)];
  const prefix = lines.slice(0, positions[0]);
  return [
    ...(prefix.length ? [create(prefix)] : []),
    ...previous.map((item, index) =>
      replace(item, lines.slice(positions[index] + 1, positions[index + 1])),
    ),
  ];
}
export function resumeContent(
  text: string,
  contact: ResumeContent["contact"],
  previous?: ResumeContent,
  skills?: string[],
): ResumeContent {
  const parts = splitResume(text);
  // Keep header lines that could not be identified as contact information.
  const headerValues = [
    ...Object.values(previous?.contact || {}),
    ...Object.values(contact),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  const intro = parts.intro.filter(
    (line) =>
      !line
        .split(/\s*[·|]\s*/)
        .every((value) => headerValues.includes(value.toLowerCase())),
  );
  return {
    contact: { ...previous?.contact, ...contact },
    summary: [...intro, ...parts.summary].join("\n") || null,
    education: readGroup(
      parts.education,
      previous?.education || [],
      educationHeading,
      (item, details) => ({ ...item, details }),
      (details) => ({ details }),
    ),
    experience: readGroup(
      parts.experience,
      previous?.experience || [],
      experienceHeading,
      (item, bullets) => ({ ...item, bullets }),
      (bullets) => ({ bullets }),
    ),
    projects: readGroup(
      parts.projects,
      previous?.projects || [],
      projectHeading,
      (item, bullets) => ({ ...item, bullets }),
      (bullets) => ({ bullets }),
    ),
    skills:
      skills ??
      parts.skills.flatMap((line) =>
        line
          .split(/[,;·]/)
          .map((skill) => skill.trim())
          .filter(Boolean),
      ),
  };
}
