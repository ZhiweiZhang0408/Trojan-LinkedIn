// Types mirroring the FastAPI response schemas (see docs/api-integration.md).

export type Role = 'student' | 'alumni';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_demo: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  user: User;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface StudentProfileData {
  major: string;
  degree_program: string;
  graduation_year: number | null;
  skills: string[];
  career_interests: string[];
  target_roles: string[];
  experience: string;
  bio: string;
  resume_url: string;
  portfolio_url: string;
  linkedin_url: string;
}

export interface AlumniProfileData {
  usc_degree: string;
  graduation_year: number | null;
  current_company: string;
  current_title: string;
  industry: string;
  experience: string;
  skills: string[];
  career_interests: string[];
  bio: string;
  linkedin_url: string;
  coffee_chat_available: boolean;
}

export type ResumeVisibility = 'private' | 'connections' | 'everyone';

export interface ResumeInfo {
  filename: string;
  size: number;
  uploaded_at: string;
  visibility: ResumeVisibility;
}

export interface ProfileSettings {
  discoverable: boolean;
  show_email_to_connections: boolean;
  resume_visibility: ResumeVisibility | null;
}

export type ConnectionState = 'connected' | 'pending_outgoing' | 'pending_incoming' | null;

export interface Profile {
  user_id: number;
  full_name: string;
  role: Role;
  headline: string;
  email: string | null;
  is_me: boolean;
  connection_status: ConnectionState;
  connection_id: number | null;
  can_message: boolean;
  resume: ResumeInfo | null;
  student: StudentProfileData | null;
  alumni: AlumniProfileData | null;
}

export type ProfileUpdate = Partial<StudentProfileData & AlumniProfileData & { full_name: string }>;

export interface UserBrief {
  id: number;
  full_name: string;
  role: Role;
  headline: string;
}

export interface AlumniCard {
  user_id: number;
  full_name: string;
  current_title: string;
  current_company: string;
  industry: string;
  usc_degree: string;
  graduation_year: number | null;
  skills: string[];
  career_interests: string[];
  bio: string;
  coffee_chat_available: boolean;
  match_score: number | null;
  connection_status: ConnectionState;
}

export interface StudentCard {
  user_id: number;
  full_name: string;
  major: string;
  degree_program: string;
  graduation_year: number | null;
  skills: string[];
  career_interests: string[];
  target_roles: string[];
  shared_interests: string[];
  shared_skills: string[];
  connection_status: ConnectionState;
}

export interface ConnectionRequest {
  id: number;
  requester: UserBrief;
  addressee: UserBrief;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'removed';
  direction: 'incoming' | 'outgoing';
  created_at: string;
}

export type ChatStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface CoffeeChat {
  id: number;
  requester: UserBrief;
  recipient: UserBrief;
  proposed_time: string;
  duration_minutes: number;
  message: string;
  response_note: string;
  status: ChatStatus;
  direction: 'incoming' | 'outgoing';
  created_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number;
  body: string;
  created_at: string;
  read_at: string | null;
  is_mine: boolean;
}

export interface Thread {
  other: UserBrief;
  last_message: Message | null;
  unread_count: number;
  can_message: boolean;
}

export interface Inbox {
  items: Thread[];
  total: number;
  total_unread: number;
}

export interface Conversation {
  other: UserBrief;
  can_message: boolean;
  reason: string | null;
  items: Message[];
  total: number;
}

export interface ScoreBreakdown {
  career_goal: number;
  skills: number;
  industry: number;
  job_title: number;
  background: number;
}

export interface Recommendation {
  alumni: AlumniCard;
  match_score: number;
  breakdown: ScoreBreakdown;
  explanation: string;
  shared_skills: string[];
  shared_interests: string[];
  conversation_topics: string[];
  explanation_source: 'rules' | 'llm';
}

export interface RecommendResponse {
  items: Recommendation[];
  total: number;
  criteria: Record<string, string[]>;
  weights: Record<keyof ScoreBreakdown, number>;
  disclaimer: string;
}

export type MessagePurpose = 'coffee_chat' | 'career_advice' | 'industry_insight' | 'application_advice' | 'mentorship';

export interface GenerateMessageResponse {
  subject: string;
  message: string;
  source: 'template' | 'llm';
  inputs_used: Record<string, string | string[]>;
  notice: string;
}
