import type { ResumeContent } from "./lib/resumeContent";

export type Role = "student" | "alumni";
export type Mode = "demo" | "api";
export type Tab = "jobs" | "connections" | "profile";
export interface Person {
  id: string;
  name: string;
  role: Role;
  email: string;
  school: string;
  program: string;
  year: number;
  company: string;
  title: string;
  location: string;
  bio: string;
  skills: string[];
  experience: string;
  education: string;
  projects: string;
  openToConnect: boolean;
  coffeeChats: boolean;
  schedulingUrl: string;
  color: string;
}
export interface Job {
  id: string;
  title: string;
  company: string;
  team: string;
  industry: string;
  location: string;
  workMode: string;
  type: string;
  description: string;
  requirements: string;
  instructions: string;
  applicationUrl: string;
  deadline: string;
  referralAvailable: boolean;
  alumniId: string;
  status: "open" | "closed" | "filled";
  createdAt: string;
  color: string;
  acceptsNewRequests?: boolean;
  applicationInstructions?: string;
  referralDisclaimer?: string;
}
export interface Resume {
  id: string;
  ownerId: string;
  label: string;
  text: string;
  sourceText: string;
  jobId?: string;
  fileName?: string;
  fileData?: string;
  content?: ResumeContent;
  createdAt: string;
}
export type RequestStatus =
  "pending" | "interested" | "accepted" | "declined" | "closed" | "withdrawn";
export interface RequestItem {
  id: string;
  kind: "job" | "connection";
  studentId: string;
  alumniId: string;
  jobId?: string;
  purpose: "referral" | "question" | "connection" | "coffee";
  note: string;
  status: RequestStatus;
  resumeSnapshot?: string;
  resumeLabel?: string;
  resumeId?: string;
  profileSnapshot?: Person;
  shareFile?: boolean;
  fileName?: string;
  fileData?: string;
  topic?: string;
  availability?: string;
  createdAt: string;
  readOnly?: boolean;
  jobTitle?: string;
  jobCompany?: string;
}
export interface Message {
  id: string;
  requestId: string;
  senderId: string;
  text: string;
  createdAt: string;
}
export interface BoardState {
  people: Person[];
  jobs: Job[];
  resumes: Resume[];
  requests: RequestItem[];
  messages: Message[];
}
export interface Settings {
  mode: Mode;
  apiUrl: string;
  token?: string;
  apiUserId?: string;
}
export interface Evidence {
  requirement: string;
  status: "found" | "partial" | "missing";
  evidence: string;
}
export interface Review {
  summary: string;
  evidence: Evidence[];
  questions: string[];
}
export interface Suggestion {
  original: string;
  suggested: string;
  reason: string;
}
export interface ImportResult {
  text: string;
  fileName: string;
  fileData?: string;
  name?: string;
  email?: string;
  skills?: string[];
}
export type ModalState =
  | { type: "job"; job: Job }
  | { type: "post"; job?: Job }
  | { type: "compose"; job: Job; purpose: "referral" | "question" }
  | {
      type: "resume";
      job?: Job;
      returnTo?: "compose";
      purpose?: "referral" | "question";
      resumeId?: string;
    }
  | { type: "tailor"; job: Job; resume: Resume; returnTo?: "compose" }
  | { type: "connect"; person: Person }
  | { type: "person"; person: Person }
  | { type: "thread"; request: RequestItem }
  | { type: "profile" }
  | { type: "settings" }
  | { type: "login" }
  | null;
