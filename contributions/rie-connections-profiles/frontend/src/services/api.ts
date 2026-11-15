// Thin REST client for the TrojanLink FastAPI backend.
// Every call goes through `request`, which attaches the JWT and normalizes errors,
// so a different frontend can reuse this module unchanged.
import type {
  AlumniCard,
  ChatStatus,
  CoffeeChat,
  ConnectionRequest,
  Conversation,
  GenerateMessageResponse,
  Inbox,
  Message,
  MessagePurpose,
  Page,
  Profile,
  ProfileSettings,
  ProfileUpdate,
  RecommendResponse,
  ResumeInfo,
  Role,
  StudentCard,
  TokenResponse,
  User,
} from './types';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'trojanlink.token';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: session-only login */
    }
  },
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(params?: Query): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

function errorMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '';
        const msg = (d.msg || 'Invalid value').replace(/^Value error, /, '');
        return field && field !== 'body' ? `${String(field).replace(/_/g, ' ')}: ${msg}` : msg;
      })
      .join('; ');
  }
  return 'Something went wrong';
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}${qs(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, `Can't reach the TrojanLink API at ${API_BASE_URL}. Is the backend running?`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, errorMessage((data as { detail?: unknown }).detail));
  }
  return data as T;
}

/** Authenticated binary download (e.g. a resume PDF). */
async function requestBlob(path: string): Promise<Blob> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(0, `Can't reach the TrojanLink API at ${API_BASE_URL}. Is the backend running?`);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorMessage((data as { detail?: unknown }).detail));
  }
  return res.blob();
}

export const api = {
  // auth
  register: (b: { email: string; password: string; full_name: string; role: Role }) =>
    request<TokenResponse>('POST', '/auth/register', b),
  login: (email: string, password: string) => request<TokenResponse>('POST', '/auth/login', { email, password }),
  me: () => request<User>('GET', '/auth/me'),
  logout: () => request<void>('POST', '/auth/logout'),

  // profiles
  myProfile: () => request<Profile>('GET', '/profiles/me'),
  updateMyProfile: (b: ProfileUpdate) => request<Profile>('PUT', '/profiles/me', b),
  profile: (id: number) => request<Profile>('GET', `/profiles/${id}`),

  // discovery
  alumni: (q?: Query) => request<Page<AlumniCard>>('GET', '/connections/alumni', undefined, q),
  students: (q?: Query) => request<Page<StudentCard>>('GET', '/connections/students', undefined, q),

  // connection requests
  connections: (status?: string) =>
    request<Page<ConnectionRequest>>('GET', '/connections/requests', undefined, { status }),
  connect: (addressee_id: number, message = '') =>
    request<ConnectionRequest>('POST', '/connections/requests', { addressee_id, message }),
  respondConnection: (id: number, action: 'accept' | 'decline' | 'withdraw' | 'remove') =>
    request<ConnectionRequest>('PATCH', `/connections/requests/${id}`, { action }),

  // coffee chats
  coffeeChats: (q?: { status?: ChatStatus; direction?: 'incoming' | 'outgoing' }) =>
    request<Page<CoffeeChat>>('GET', '/connections/coffee-chats', undefined, q),
  requestCoffeeChat: (b: { recipient_id: number; proposed_time: string; duration_minutes: number; message: string }) =>
    request<CoffeeChat>('POST', '/connections/coffee-chats', b),
  updateCoffeeChat: (id: number, action: 'accept' | 'decline' | 'cancel', note = '') =>
    request<CoffeeChat>('PATCH', `/connections/coffee-chats/${id}`, { action, note }),

  // direct messages
  inbox: () => request<Inbox>('GET', '/connections/messages'),
  unreadCount: () => request<{ unread: number }>('GET', '/connections/messages/unread-count'),
  conversation: (userId: number) => request<Conversation>('GET', `/connections/messages/${userId}`),
  sendMessage: (userId: number, body: string) => request<Message>('POST', `/connections/messages/${userId}`, { body }),

  // profile settings + resume
  settings: () => request<ProfileSettings>('GET', '/profiles/me/settings'),
  updateSettings: (b: Partial<ProfileSettings>) => request<ProfileSettings>('PUT', '/profiles/me/settings', b),
  uploadResume: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<ResumeInfo>('PUT', '/profiles/me/resume', form);
  },
  deleteResume: () => request<void>('DELETE', '/profiles/me/resume'),
  downloadResume: (userId: number) => requestBlob(`/profiles/${userId}/resume`),

  // AI
  aiStatus: () => request<{ llm_configured: boolean }>('GET', '/ai/status'),
  recommend: (b: { career_interests?: string[]; skills?: string[]; target_roles?: string[]; limit?: number; use_llm?: boolean }) =>
    request<RecommendResponse>('POST', '/ai/recommend-alumni', b),
  generateMessage: (b: {
    alumni_id: number;
    purpose: MessagePurpose;
    tone: 'friendly' | 'formal';
    personal_note: string;
    use_llm: boolean;
  }) => request<GenerateMessageResponse>('POST', '/ai/generate-message', b),
};
