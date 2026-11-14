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
  Suggestion,
} from "./types";
import { loadState, saveState } from "./lib/storage";
import {
  ApiClient,
  jobBody,
  mapJob,
  mapResume,
  mapThread,
  mapUser,
  type RawJob,
  type RawRequest,
  type RawResume,
  type RawUser,
} from "./lib/api";
import { errorText, profileResume, uid } from "./lib/utils";
import { resumeContent, splitResume } from "./lib/resumeContent";
import { previewReview, previewSuggestions } from "./lib/previewAssistance";
const empty: BoardState = {
  people: [],
  jobs: [],
  resumes: [],
  requests: [],
  messages: [],
};
function initialSettings(): Settings {
  let apiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  try {
    apiUrl = localStorage.getItem("trojan-api-url") || apiUrl;
  } catch {
    /* Browser settings are optional. */
  }
  return { mode: "demo", apiUrl };
}
export function useBoard() {
  const [demo, setDemo] = useState<BoardState>(makeSeed);
  const [live, setLive] = useState<BoardState>(empty);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [activeId, setActiveId] = useState("alex");
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
  const refresh = useCallback(async () => {
    if (settings.mode !== "api") return;
    setLoading(true);
    try {
      const data = await api.request<{ items: RawJob[] }>(
        "/jobs?include_closed=true&include_expired=true&limit=100",
      );
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
      if (settings.token && settings.apiUserId) {
        const raw = await api.request<RawUser>("/auth/me");
        const me = mapUser(raw);
        const path =
          me.role === "student"
            ? "/job-requests/sent"
            : "/job-requests/received";
        const [requests, resumes] = await Promise.all([
          api.request<RawRequest[]>(path),
          me.role === "student"
            ? api.request<RawResume[]>("/resumes/mine")
            : Promise.resolve([]),
        ]);
        const threads = requests.map(mapThread);
        const students = [
          ...new Map(threads.map((t) => [t.student.id, t.student])).values(),
        ].filter((p) => p.id !== me.id);
        setLive((s) => ({
          ...s,
          requests: threads.map((t) => t.request),
          messages: threads.flatMap((t) => t.messages),
          resumes: resumes
            .filter((r) => r.status === "confirmed")
            .map(mapResume),
          people: [
            ...s.people.filter(
              (p) =>
                p.id !== me.id &&
                !students.some((student) => student.id === p.id),
            ),
            me,
            ...students,
          ],
        }));
      }
    } catch (e) {
      notify(errorText(e), true);
    } finally {
      setLoading(false);
    }
  }, [api, settings.mode, settings.token, settings.apiUserId, notify]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  function switchIdentity(id: string) {
    setActiveId(id);
    setRequestDraft({ jobId: "", note: "", resumeId: "" });
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
  async function login(email: string, password: string) {
    const response = await api.request<{ access_token: string; user: RawUser }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
    const me = mapUser(response.user);
    setLive((s) => ({
      ...s,
      people: [...s.people.filter((p) => p.id !== me.id), me],
    }));
    setSettings((s) => ({
      ...s,
      token: response.access_token,
      apiUserId: me.id,
    }));
    notify(`Welcome, ${me.name.split(" ")[0]}.`);
  }
  async function saveProfile(person: Person) {
    if (settings.mode === "api")
      await api.request("/persona/me", {
        method: "PATCH",
        body: JSON.stringify(person),
      });
    update((s) => ({
      ...s,
      people: s.people.map((p) => (p.id === person.id ? person : p)),
    }));
    notify("Profile saved.");
  }
  async function importResume(file: File): Promise<ImportResult> {
    return (await import("./lib/resume")).readResume(file);
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
      previous?.content,
      person.skills,
    );
    let resume: Resume;
    if (settings.mode === "api") {
      const path = previous ? `/resumes/${previous.id}` : "/resumes";
      const raw = await api.request<RawResume>(path, {
        method: previous ? "PATCH" : "POST",
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
    if (settings.mode === "api" && person.role === "student") {
      await confirmResume(person, profileResume(person));
      return;
    }
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
  async function tailor(resume: Resume, job: Job): Promise<Suggestion[]> {
    if (settings.mode === "demo") return previewSuggestions(resume.text, job);
    return api.request("/ai/resume-tailoring", {
      method: "POST",
      body: JSON.stringify({ resumeId: resume.id, jobId: job.id }),
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
          r.alumniId === person.id,
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
    if (settings.mode === "api")
      item = await api.request("/connections/requests", {
        method: "POST",
        body: JSON.stringify(item),
      });
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
      await api.request(`/connections/requests/${request.id}/decision`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
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
    if (settings.mode === "api")
      message = await api.request("/messages", {
        method: "POST",
        body: JSON.stringify(message),
      });
    update((s) => ({ ...s, messages: [...s.messages, message] }));
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
  async function downloadResumeFile(resume: Resume) {
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
  async function loadAlumni() {
    if (settings.mode === "demo") return;
    const people = await api.request<Person[]>("/persona/alumni");
    setLive((s) => ({
      ...s,
      people: [
        ...s.people.filter((p) => !people.some((a) => a.id === p.id)),
        ...people,
      ],
    }));
  }
  function resetDemo() {
    setDemo(makeSeed());
    setActiveId("alex");
    setRequestDraft({ jobId: "", note: "", resumeId: "" });
    notify("Sample workspace reset.");
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
    switchIdentity,
    configure,
    login,
    refresh,
    saveProfile,
    saveManualProfile,
    importResume,
    confirmResume,
    saveTailored,
    tailor,
    review,
    saveJob,
    closeJob,
    submitRequest,
    connect,
    decide,
    sendMessage,
    downloadOriginal,
    downloadResumeFile,
    loadAlumni,
    resetDemo,
  };
}
export type Board = ReturnType<typeof useBoard>;
