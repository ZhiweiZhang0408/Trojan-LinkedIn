import type {
  Job,
  Message,
  Person,
  RequestItem,
  Resume,
  Settings,
} from "../types";
import { resumeText, type ResumeContent } from "./resumeContent";

export class ApiClient {
  constructor(private settings: Settings) {}
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (this.settings.token)
      headers.set("Authorization", `Bearer ${this.settings.token}`);
    if (options.body && !(options.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    let res: Response;
    try {
      res = await fetch(this.settings.apiUrl.replace(/\/$/, "") + path, {
        ...options,
        headers,
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new Error(
        "Could not reach the backend. Check that it is running and the API URL allows this frontend origin.",
      );
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail.map((d: { msg: string }) => d.msg).join("; ")
            : `Request failed (${res.status}).`;
      throw new Error(detail);
    }
    if (res.status === 204) return undefined as T;
    const ct = res.headers.get("content-type") || "";
    return (
      ct.includes("application/json") ? await res.json() : await res.blob()
    ) as T;
  }
}
export interface RawUser {
  id: number;
  full_name: string;
  role: "student" | "alumni";
  email?: string;
  major?: string;
  grad_year?: number;
  company?: string;
  title?: string;
  linkedin_url?: string;
  is_usc_verified?: boolean;
}
export interface RawJob {
  id: number;
  role_title: string;
  company: string;
  team?: string;
  industry?: string;
  location?: string;
  work_mode: string;
  job_type: string;
  description: string;
  requirements?: string;
  referral_notes?: string;
  application_link?: string;
  deadline?: string;
  referral_available: boolean;
  alumni: RawUser;
  status: Job["status"];
  created_at: string;
  accepts_new_requests?: boolean;
  application_instructions?: string;
  referral_disclaimer?: string;
}
export interface RawRequest {
  id: number;
  job: { id: number; alumni_id: number; role_title: string; company: string };
  student: RawUser;
  kind: "referral" | "question";
  note: string;
  status: RequestItem["status"];
  resume_id: number | null;
  resume_snapshot: ResumeContent | null;
  has_attachment: boolean;
  attachment_filename: string | null;
  is_read_only: boolean;
  messages: { id: number; sender: RawUser; body: string; created_at: string }[];
  created_at: string;
}
export interface RawResume {
  id: number;
  owner_id: number;
  label: string;
  content: ResumeContent;
  status: "confirmed" | "draft";
  job_id: number | null;
  has_original_file: boolean;
  original_filename: string | null;
  created_at: string;
}
export function mapResume(raw: RawResume): Resume {
  const text = resumeText(raw.content);
  return {
    id: String(raw.id),
    ownerId: String(raw.owner_id),
    label: raw.label,
    content: raw.content,
    text,
    sourceText: text,
    jobId: raw.job_id == null ? undefined : String(raw.job_id),
    fileName: raw.has_original_file
      ? raw.original_filename || "Resume"
      : undefined,
    createdAt: raw.created_at,
  };
}
export function mapThread(raw: RawRequest): {
  request: RequestItem;
  messages: Message[];
  student: Person;
} {
  return {
    request: {
      id: String(raw.id),
      kind: "job",
      studentId: String(raw.student.id),
      alumniId: String(raw.job.alumni_id),
      jobId: String(raw.job.id),
      jobTitle: raw.job.role_title,
      jobCompany: raw.job.company,
      purpose: raw.kind,
      note: raw.note,
      status: raw.status,
      readOnly: raw.is_read_only,
      resumeId: raw.resume_id == null ? undefined : String(raw.resume_id),
      resumeSnapshot: raw.resume_snapshot
        ? resumeText(raw.resume_snapshot)
        : undefined,
      fileName: raw.has_attachment
        ? raw.attachment_filename || "Resume"
        : undefined,
      createdAt: raw.created_at,
    },
    messages: raw.messages.map((message) => ({
      id: String(message.id),
      requestId: String(raw.id),
      senderId: String(message.sender.id),
      text: message.body,
      createdAt: message.created_at,
    })),
    student: mapUser(raw.student),
  };
}
export const mapUser = (u: RawUser): Person => ({
  id: String(u.id),
  name: u.full_name,
  role: u.role,
  email: u.email || "",
  school: "USC",
  program: u.major || "",
  year: u.grad_year || 2026,
  company: u.company || "",
  title: u.title || "",
  location: "",
  bio: "",
  skills: [],
  experience: "",
  education: "",
  projects: "",
  openToConnect: false,
  coffeeChats: false,
  schedulingUrl: "",
  color: "rose",
});
export const mapJob = (j: RawJob): Job => ({
  id: String(j.id),
  title: j.role_title,
  company: j.company,
  team: j.team || "",
  industry: j.industry || "",
  location: j.location || "",
  workMode:
    (
      { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" } as Record<
        string,
        string
      >
    )[j.work_mode] || j.work_mode,
  type:
    (
      {
        full_time: "Full-time",
        part_time: "Part-time",
        internship: "Internship",
        contract: "Contract",
      } as Record<string, string>
    )[j.job_type] || j.job_type,
  description: j.description,
  requirements: j.requirements || "",
  instructions: j.referral_notes || "",
  applicationUrl: j.application_link || "",
  deadline: j.deadline || "",
  referralAvailable: j.referral_available,
  alumniId: String(j.alumni.id),
  status: j.status,
  createdAt: j.created_at,
  color: "blue",
  acceptsNewRequests: j.accepts_new_requests,
  applicationInstructions: j.application_instructions,
  referralDisclaimer: j.referral_disclaimer,
});
export const jobBody = (j: Job) => ({
  role_title: j.title,
  company: j.company,
  team: j.team,
  industry: j.industry,
  location: j.location,
  work_mode:
    (
      { "On-site": "onsite", Hybrid: "hybrid", Remote: "remote" } as Record<
        string,
        string
      >
    )[j.workMode] || "onsite",
  job_type:
    (
      {
        "Full-time": "full_time",
        "Part-time": "part_time",
        Internship: "internship",
        Contract: "contract",
      } as Record<string, string>
    )[j.type] || "full_time",
  description: j.description,
  requirements: j.requirements,
  referral_notes: j.instructions,
  application_instructions: j.applicationInstructions || null,
  application_link: j.applicationUrl || null,
  deadline: j.deadline || null,
  referral_available: j.referralAvailable,
});
