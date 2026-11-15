import { useCallback, useEffect, useMemo, useState } from "react";
import { makeSeed } from "./data";
import type {
  BoardState,
  ImportResult,
  Job,
  Message,
  Person,
  RequestItem,
  Resume,
  Review,
  Settings,
  TailorResult,
} from "./types";
import { loadState, saveState } from "./lib/storage";
import {
  ApiClient,
  ApiError,
  type AuthResponse,
  type CodeResponse,
  jobBody,
  mapJob,
  mapResume,
  mapThread,
  mapUser,
  type RawJob,
  type RawRequest,
  type RawResume,
  type RawPersona,
  type RawConnection,
  mapPersona,
  mapConnection,
  connectionApiId,
  type RawTailorRun,
  type RawUser,
} from "./lib/api";
import { errorText, profileResume, uid } from "./lib/utils";
import {
  profileFromResume,
  resumeContent,
  splitResume,
} from "./lib/resumeContent";
import {
  previewDraft,
  previewReview,
  previewTailor,
  type DraftKind,
} from "./lib/previewAssistance";
const empty: BoardState = {
  people: [],
  jobs: [],
  resumes: [],
  requests: [],
  messages: [],
};
const sessionKey = "trojan-board-session";
const sampleKey = "trojan-board-sample-user";

// A hosted build (VITE_HOSTED=true) is served by the backend itself, so it talks
// to its own origin and starts connected instead of in sample mode.
const hosted = import.meta.env.VITE_HOSTED === "true";
function initialSettings(): Settings {
  let apiUrl =
    import.meta.env.VITE_API_BASE_URL ||
    (hosted ? window.location.origin : "http://localhost:8000");
  try {
    apiUrl = localStorage.getItem("trojan-api-url") || apiUrl;
    const saved = JSON.parse(
      sessionStorage.getItem(sessionKey) || "null",
    ) as Settings | null;
    if (saved?.mode === "api" && saved.apiUrl === apiUrl) return saved;
  } catch {
    /* Browser settings are optional. */
  }
  return { mode: hosted ? "api" : "demo", apiUrl };
}
export function useBoard() {
  const [demo, setDemo] = useState<BoardState>(makeSeed);
  const [live, setLive] = useState<BoardState>(empty);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(sampleKey);
    } catch {
      return null;
    }
  });
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [requestDraft, setRequestDraft] = useState({
    jobId: "",
    note: "",
    resumeId: "",
  });
  const notify = useCallback(
    (text: string, error = false) => setToast({ text, error }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let alive = true;
    loadState()
      .then((s) => {
        if (
          alive &&
          s?.people &&
          s.jobs &&
          s.resumes &&
          s.requests &&
          s.messages
        )
          setDemo(s);
      })
      .catch((e) => notify(errorText(e), true))
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [notify]);
  useEffect(() => {
    if (ready) saveState(demo).catch((e) => notify(errorText(e), true));
  }, [demo, ready, notify]);
  const state = settings.mode === "demo" ? demo : live;
  const update = settings.mode === "demo" ? setDemo : setLive;
  const currentId = settings.mode === "demo" ? activeId : settings.apiUserId;
  const user = state.people.find((p) => p.id === currentId);
  const api = useMemo(() => new ApiClient(settings), [settings]);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (settings.mode !== "api") return;
      setLoading(true);
      try {
        const data = await api.request<{ items: RawJob[] }>(
          "/jobs?include_closed=true&include_expired=true&limit=100",
          { signal },
        );
        if (signal?.aborted) return;
        setLive((s) => ({
          ...s,
          jobs: data.items.map(mapJob),
          people: [
            ...s.people.filter(
              (p) => !data.items.some((j) => String(j.alumni.id) === p.id),
            ),
            ...Array.from(
              new Map(
                data.items.map((j) => [j.alumni.id, mapUser(j.alumni)]),
              ).values(),
            ),
          ],
        }));
        const directory = await api
          .request<RawPersona[]>("/connections/alumni", { signal })
          .catch(() => [] as RawPersona[]);
        if (signal?.aborted) return;
        const alumni = directory.map(mapPersona);
        setLive((s) => ({
          ...s,
          people: [
            ...s.people.filter((p) => !alumni.some((a) => a.id === p.id)),
            ...alumni,
          ],
        }));
        if (settings.token && settings.apiUserId) {
          const raw = await api.request<RawPersona>("/persona/me", { signal });
          const me = mapPersona(raw);
          const path =
            me.role === "student"
              ? "/job-requests/sent"
              : "/job-requests/received";
          const [requests, resumes, invitations] = await Promise.all([
            api.request<RawRequest[]>(path, { signal }),
            me.role === "student"
              ? api.request<RawResume[]>("/resumes/mine", { signal })
              : Promise.resolve([]),
            api.request<RawConnection[]>("/connections/requests", { signal }),
          ]);
          if (signal?.aborted) return;
          const base = resumes.find(
            (r) => r.status === "confirmed" && r.job_id == null,
          );
          const profile = base ? profileFromResume(me, base.content) : me;
          const threads = requests.map(mapThread);
          const links = invitations.map(mapConnection);
          const known = new Set(alumni.map((a) => a.id));
          const students = [
            ...new Map(
              [
                ...threads.map((t) => t.student),
                ...links.flatMap((l) => l.people),
              ].map((p) => [p.id, p]),
            ).values(),
          ].filter((p) => p.id !== me.id && !known.has(p.id));
          setLive((s) => ({
            ...s,
            requests: [
              ...threads.map((t) => t.request),
              ...links.map((l) => l.request),
            ],
            messages: [
              ...threads.flatMap((t) => t.messages),
              ...links.flatMap((l) => l.messages),
            ],
            resumes: resumes
              .filter((r) => r.status === "confirmed")
              .map(mapResume),
            people: [
              ...s.people.filter(
                (p) =>
                  p.id !== me.id &&
                  !students.some((student) => student.id === p.id),
              ),
              profile,
              ...students,
            ],
          }));
        }
      } catch (e) {
        if (!signal?.aborted) {
          if (e instanceof ApiError && e.status === 401 && settings.token) {
            setSettings({ mode: "api", apiUrl: settings.apiUrl });
            setLive(empty);
            notify("Your session expired. Sign in again.", true);
          } else notify(errorText(e), true);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [
      api,
      settings.apiUrl,
      settings.mode,
      settings.token,
      settings.apiUserId,
      notify,
    ],
  );
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    try {
      if (settings.mode === "api")
        sessionStorage.setItem(sessionKey, JSON.stringify(settings));
      else sessionStorage.removeItem(sessionKey);
    } catch {
      // The session still works in memory if tab storage is disabled.
    }
  }, [settings]);
  function rememberSample(id: string | null) {
    setActiveId(id);
    try {
      if (id) sessionStorage.setItem(sampleKey, id);
      else sessionStorage.removeItem(sampleKey);
    } catch {
      /* The sample session still works in memory. */
    }
  }
  function signInSample(id: string) {
    rememberSample(id);
    setRequestDraft({ jobId: "", note: "", resumeId: "" });
    if (settings.mode !== "demo") {
      setLive(empty);
      setSettings({ mode: "demo", apiUrl: settings.apiUrl });
    }
  }
  function configure(next: Settings) {
    setSettings(next);
    setRequestDraft({ jobId: "", note: "", resumeId: "" });
    setLive(empty);
    try {
      localStorage.setItem("trojan-api-url", next.apiUrl);
    } catch {
      /* URL settings can remain in memory. */
    }
  }
  const authApi = new ApiClient({ mode: "api", apiUrl: settings.apiUrl });
  function acceptSession(response: AuthResponse) {
    const me = mapUser(response.user);
    rememberSample(null);
    setRequestDraft({ jobId: "", note: "", resumeId: "" });
    setLive({ ...empty, people: [me] });
    setSettings({
      mode: "api",
      apiUrl: settings.apiUrl,
      token: response.access_token,
      apiUserId: me.id,
    });
  }
  async function login(email: string, password: string) {
    acceptSession(
      await authApi.request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    );
  }
  async function register(input: {
    full_name: string;
    email: string;
    password: string;
    role: Person["role"];
  }) {
    return authApi.request<CodeResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  async function verifyEmail(email: string, code: string) {
    acceptSession(
      await authApi.request<AuthResponse>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      }),
    );
  }
  async function resendCode(email: string) {
    return authApi.request<CodeResponse>("/auth/resend-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }
  function signOut() {
    setRequestDraft({ jobId: "", note: "", resumeId: "" });
    if (settings.mode === "demo") return rememberSample(null);
    setLive(empty);
    setSettings({ mode: "api", apiUrl: settings.apiUrl });
  }
  async function saveProfile(person: Person) {
    let saved = person;
    if (settings.mode === "api")
      saved = {
        ...mapPersona(
          await api.request<RawPersona>("/persona/me", {
            method: "PATCH",
            body: JSON.stringify(person),
          }),
        ),
        color: person.color,
      };
    update((s) => ({
      ...s,
      people: s.people.map((p) => (p.id === saved.id ? saved : p)),
    }));
    notify("Profile saved.");
  }
  async function importResume(file: File): Promise<ImportResult> {
    if (settings.mode === "demo")
      return (await import("./lib/resume")).readResume(file);
    const data = new FormData();
    data.set("file", file);
    const draft = mapResume(
      await api.request<RawResume>("/resumes/upload", {
        method: "POST",
        body: data,
      }),
    );
    return {
      importId: draft.id,
      fileName: draft.fileName || file.name,
      text: draft.text,
      sourceText: draft.sourceText,
      content: draft.content,
      name: draft.content?.contact.name || undefined,
      email: draft.content?.contact.email || undefined,
      skills: draft.content?.skills,
    };
  }
  async function confirmResume(
    person: Person,
    text: string,
    source?: ImportResult,
    previous?: Resume,
  ) {
    const content = resumeContent(
      text,
      { name: person.name, email: person.email, location: person.location },
      source?.content || previous?.content,
      person.skills,
    );
    let resume: Resume;
    if (settings.mode === "api") {
      const path = source?.importId
        ? `/resumes/${source.importId}/confirm`
        : previous
          ? `/resumes/${previous.id}`
          : "/resumes";
      const raw = await api.request<RawResume>(path, {
        method: previous && !source?.importId ? "PATCH" : "POST",
        body: JSON.stringify({
          label: source?.fileName || previous?.label || "My base resume",
          content,
        }),
      });
      resume = mapResume(raw);
    } else {
      resume = {
        ...previous,
        id: previous?.id || uid(),
        ownerId: person.id,
        label: source?.fileName || previous?.label || "My base resume",
        text,
        content,
        sourceText: source?.text || previous?.sourceText || text,
        fileName: source?.fileName || previous?.fileName,
        fileData: source?.fileData || previous?.fileData,
        createdAt: previous?.createdAt || new Date().toISOString(),
      };
    }
    const parts = splitResume(text);
    const confirmedPerson = {
      ...person,
      education: parts.education.join("\n") || person.education,
      experience: parts.experience.join("\n") || person.experience,
      projects: parts.projects.join("\n") || person.projects,
    };
    update((s) => ({
      ...s,
      people:
        settings.mode === "demo"
          ? s.people.map((p) => (p.id === person.id ? confirmedPerson : p))
          : s.people,
      resumes: [resume, ...s.resumes.filter((r) => r.id !== resume.id)],
    }));
    notify(
      settings.mode === "demo"
        ? "Your information and resume are saved."
        : "Resume saved.",
    );
    return resume;
  }
  async function saveManualProfile(person: Person) {
    await saveProfile(person);
    if (
      person.role === "student" &&
      !state.resumes.some((r) => r.ownerId === person.id)
    ) {
      await confirmResume(person, profileResume(person));
    }
  }
  async function saveTailored(resume: Resume, job: Job, text: string) {
    const content = resumeContent(
      text,
      resume.content?.contact || {
        name: user?.name,
        email: user?.email,
        location: user?.location,
      },
      resume.content,
    );
    const label = `${job.company} · ${job.title}`;
    const next =
      settings.mode === "api"
        ? mapResume(
            await api.request<RawResume>(`/resumes/${resume.id}/versions`, {
              method: "POST",
              body: JSON.stringify({ job_id: Number(job.id), label, content }),
            }),
          )
        : {
            ...resume,
            id: uid(),
            jobId: job.id,
            label,
            text,
            content,
            createdAt: new Date().toISOString(),
          };
    update((s) => ({ ...s, resumes: [next, ...s.resumes] }));
    notify("Job-specific version saved. Your base resume is unchanged.");
    return next;
  }
  async function tailor(resume: Resume, job: Job): Promise<TailorResult> {
    if (settings.mode === "demo") return previewTailor(resume.text, job);
    const run = await api.request<RawTailorRun>(`/resumes/${resume.id}/tailor`, {
      method: "POST",
      body: JSON.stringify({ job_id: Number(job.id) }),
    });
    return {
      suggestions: run.suggestions
        .filter((x) => x.action === "replace" && x.original.trim())
        .map(({ original, suggested, reason, requirement }) => ({
          original,
          suggested,
          reason,
          requirement,
        })),
      additions: run.suggestions
        .filter((x) => x.action !== "replace" && x.suggested.trim())
        .map((x) => x.suggested),
      emphasize: run.emphasize,
      questions: run.missing_info_questions,
    };
  }
  async function draftMessage(input: {
    kind: DraftKind;
    job?: Job;
    resume?: Resume;
    person?: Person;
    request?: RequestItem;
    topic?: string;
    draft?: string;
  }): Promise<string> {
    if (!user) throw new Error("Please sign in first.");
    if (settings.mode === "api") {
      const res = await api.request<{ message: string }>("/ai/draft-message", {
        method: "POST",
        body: JSON.stringify({
          kind: input.kind,
          job_id: input.job ? Number(input.job.id) : null,
          resume_id: input.resume ? Number(input.resume.id) : null,
          alum_id: input.person ? Number(input.person.id) : null,
          request_id: input.request ? Number(input.request.id) : null,
          topic: input.topic || null,
          draft: input.draft || null,
        }),
      });
      return res.message;
    }
    const request = input.request;
    const otherId = request
      ? request.studentId === user.id
        ? request.alumniId
        : request.studentId
      : input.person?.id || input.job?.alumniId;
    const thread = request
      ? state.messages.filter((m) => m.requestId === request.id)
      : [];
    return previewDraft({
      kind: input.kind,
      sender: user,
      recipient: state.people.find((p) => p.id === otherId),
      job: input.job || state.jobs.find((j) => j.id === request?.jobId),
      resume: input.resume?.text,
      topic: input.topic,
      lastMessage: thread[thread.length - 1]?.text || request?.note,
      status: request?.status,
    });
  }
  async function review(request: RequestItem, job: Job): Promise<Review> {
    if (settings.mode === "demo")
      return previewReview(request.resumeSnapshot || "", job);
    return api.request("/ai/request-review", {
      method: "POST",
      body: JSON.stringify({ requestId: request.id }),
    });
  }
  async function saveJob(job: Job, edit = false) {
    let saved = job;
    if (settings.mode === "api")
      saved = mapJob(
        await api.request<RawJob>(edit ? `/jobs/${job.id}` : "/jobs", {
          method: edit ? "PATCH" : "POST",
          body: JSON.stringify(jobBody(job)),
        }),
      );
    update((s) => ({
      ...s,
      jobs: edit
        ? s.jobs.map((j) => (j.id === saved.id ? saved : j))
        : [saved, ...s.jobs],
    }));
    notify(edit ? "Job updated." : "Your opening is published.");
    return saved;
  }
  async function closeJob(job: Job) {
    if (settings.mode === "api") {
      await api.request(`/jobs/${job.id}/close`, { method: "POST" });
      await refresh();
    } else
      update((s) => ({
        ...s,
        jobs: s.jobs.map((j) =>
          j.id === job.id ? { ...j, status: "closed" } : j,
        ),
      }));
    notify("Role closed to new requests.");
  }
  async function reopenJob(job: Job) {
    if (settings.mode === "api") {
      await api.request(`/jobs/${job.id}/reopen`, { method: "POST" });
      await refresh();
    } else
      update((s) => ({
        ...s,
        jobs: s.jobs.map((j) =>
          j.id === job.id ? { ...j, status: "open" } : j,
        ),
      }));
    notify("Role reopened.");
  }
  async function submitRequest(
    job: Job,
    purpose: "referral" | "question",
    note: string,
    resume?: Resume,
    shareFile = false,
  ) {
    if (!user) throw new Error("Please sign in first.");
    const item: RequestItem = {
      id: uid(),
      kind: "job",
      studentId: user.id,
      alumniId: job.alumniId,
      jobId: job.id,
      purpose,
      note,
      status: "pending",
      resumeSnapshot: resume?.text,
      resumeLabel: resume?.label,
      resumeId: resume?.id,
      profileSnapshot: structuredClone(user),
      shareFile,
      fileName: shareFile ? resume?.fileName : undefined,
      fileData: shareFile ? resume?.fileData : undefined,
      createdAt: new Date().toISOString(),
    };
    if (settings.mode === "api") {
      const result = await api.request<RawRequest>(`/jobs/${job.id}/requests`, {
        method: "POST",
        body: JSON.stringify({
          kind: purpose,
          note,
          resume_id: resume ? Number(resume.id) : null,
          share_original_file: shareFile,
        }),
      });
      notify("Request sent. You can follow up from your Profile.");
      return saveThread(result);
    }
    if (
      state.requests.some(
        (r) =>
          r.kind === "job" && r.jobId === job.id && r.studentId === user.id,
      )
    )
      throw new Error(
        "You already have a conversation about this role. Open it from Profile.",
      );
    if (job.status !== "open")
      throw new Error("This role is no longer accepting requests.");
    update((s) => ({ ...s, requests: [item, ...s.requests] }));
    notify("Request sent. You can follow up from your Profile.");
    return item;
  }
  async function connect(
    person: Person,
    purpose: "connection" | "coffee",
    note: string,
    topic: string,
    availability: string,
  ) {
    if (!user) throw new Error("Please sign in first.");
    if (
      state.requests.some(
        (r) =>
          r.kind === "connection" &&
          r.studentId === user.id &&
          r.alumniId === person.id &&
          ["pending", "accepted"].includes(r.status),
      )
    )
      throw new Error("You already have an invitation with this alum.");
    let item: RequestItem = {
      id: uid(),
      kind: "connection",
      studentId: user.id,
      alumniId: person.id,
      purpose,
      note,
      topic,
      availability,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    if (settings.mode === "api") {
      const saved = mapConnection(
        await api.request<RawConnection>("/connections/requests", {
          method: "POST",
          body: JSON.stringify({
            alumni_id: Number(person.id),
            purpose,
            note,
            topic: topic || null,
            availability: availability || null,
          }),
        }),
      );
      item = saved.request;
    }
    update((s) => ({ ...s, requests: [item, ...s.requests] }));
    notify("Your invitation is on its way.");
    return item;
  }
  async function decide(
    request: RequestItem,
    status: "interested" | "declined" | "accepted",
    reply?: string,
  ) {
    if (!user || user.id !== request.alumniId)
      throw new Error("Only the receiving alum can respond.");
    if (settings.mode === "api") {
      if (request.kind === "job") {
        const result = await api.request<RawRequest>(
          `/job-requests/${request.id}/status`,
          { method: "PATCH", body: JSON.stringify({ status }) },
        );
        saveThread(result);
        notify("Response saved.");
        return;
      }
      saveConnection(
        await api.request<RawConnection>(
          `/connections/requests/${connectionApiId(request.id)}/decision`,
          { method: "PATCH", body: JSON.stringify({ status, reply: reply || null }) },
        ),
      );
      notify("Response saved.");
      return;
    }
    update((s) => ({
      ...s,
      requests: s.requests.map((r) =>
        r.id === request.id ? { ...r, status } : r,
      ),
      messages: reply
        ? [
            ...s.messages,
            {
              id: uid(),
              requestId: request.id,
              senderId: user.id,
              text: reply,
              createdAt: new Date().toISOString(),
            },
          ]
        : s.messages,
    }));
    notify("Response saved.");
  }
  async function sendMessage(request: RequestItem, text: string) {
    if (!user || ![request.studentId, request.alumniId].includes(user.id))
      throw new Error("You cannot access this conversation.");
    if (settings.mode === "api" && request.kind === "job") {
      saveThread(
        await api.request<RawRequest>(`/job-requests/${request.id}/messages`, {
          method: "POST",
          body: JSON.stringify({ body: text }),
        }),
      );
      return;
    }
    let message: Message = {
      id: uid(),
      requestId: request.id,
      senderId: user.id,
      text,
      createdAt: new Date().toISOString(),
    };
    if (settings.mode === "api") {
      saveConnection(
        await api.request<RawConnection>(
          `/connections/requests/${connectionApiId(request.id)}/messages`,
          { method: "POST", body: JSON.stringify({ body: text }) },
        ),
      );
      return;
    }
    update((s) => ({ ...s, messages: [...s.messages, message] }));
  }
  function saveConnection(raw: RawConnection) {
    const { request, messages } = mapConnection(raw);
    update((s) => ({
      ...s,
      requests: s.requests.map((r) => (r.id === request.id ? request : r)),
      messages: [
        ...s.messages.filter((m) => m.requestId !== request.id),
        ...messages,
      ],
    }));
  }
  function saveThread(raw: RawRequest) {
    const thread = mapThread(raw);
    setLive((s) => ({
      ...s,
      requests: [
        thread.request,
        ...s.requests.filter(
          (r) => r.id !== thread.request.id || r.kind !== "job",
        ),
      ],
      messages: [
        ...s.messages.filter((m) => m.requestId !== thread.request.id),
        ...thread.messages,
      ],
    }));
    return thread.request;
  }
  async function downloadResumeFile(resume: Pick<Resume, "id">) {
    return URL.createObjectURL(
      await api.request<Blob>(`/resumes/${resume.id}/file`),
    );
  }
  async function downloadOriginal(request: RequestItem) {
    if (settings.mode === "demo") return request.fileData;
    const blob = await api.request<Blob>(
      `/job-requests/${request.id}/attachment`,
    );
    return URL.createObjectURL(blob);
  }
  function resetDemo() {
    setDemo(makeSeed());
    setActiveId("alex");
    setRequestDraft({ jobId: "", note: "", resumeId: "" });
    notify("Sample data reset.");
  }
  return {
    state,
    user,
    activeId,
    settings,
    ready,
    loading,
    toast,
    requestDraft,
    setRequestDraft,
    notify,
    signInSample,
    configure,
    login,
    register,
    verifyEmail,
    resendCode,
    signOut,
    refresh,
    saveProfile,
    saveManualProfile,
    importResume,
    confirmResume,
    saveTailored,
    tailor,
    review,
    draftMessage,
    saveJob,
    closeJob,
    reopenJob,
    submitRequest,
    connect,
    decide,
    sendMessage,
    downloadOriginal,
    downloadResumeFile,
    resetDemo,
  };
}
export type Board = ReturnType<typeof useBoard>;
