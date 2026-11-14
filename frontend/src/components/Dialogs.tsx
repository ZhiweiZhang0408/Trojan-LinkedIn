import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Coffee,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Send,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import type { Board } from "../useBoard";
import type {
  ImportResult,
  Job,
  ModalState,
  Person,
  RequestItem,
  Resume,
  Review,
  Suggestion,
} from "../types";
import {
  Avatar,
  Button,
  Dialog,
  Empty,
  ErrorBox,
  External,
  Field,
  Logo,
  Notice,
  Status,
} from "./ui";
import {
  errorText,
  isExpired,
  profileResume,
  readableDate,
  safeUrl,
  uid,
} from "../lib/utils";
interface Props {
  board: Board;
  modal: NonNullable<ModalState>;
  open: (m: ModalState) => void;
  close: () => void;
}
interface FormProps {
  board: Board;
  open: (m: ModalState) => void;
  close: () => void;
}
function AiLabel({ demo }: { demo: boolean }) {
  return (
    <div className={`ai-label ${demo ? "preview" : ""}`}>
      <Sparkles size={14} />
      {demo
        ? "Local rule-based preview · live AI not connected"
        : "AI assistance · review the evidence"}
    </div>
  );
}
export function Dialogs(props: Props) {
  const { modal: m, ...rest } = props;
  switch (m.type) {
    case "job":
      return <JobDetail {...rest} job={m.job} />;
    case "post":
      return <PostForm {...rest} job={m.job} />;
    case "profile":
      return <ProfileForm {...rest} />;
    case "resume":
      return (
        <ResumeForm
          {...rest}
          job={m.job}
          returnTo={m.returnTo}
          purpose={m.purpose}
          resumeId={m.resumeId}
        />
      );
    case "tailor":
      return (
        <TailorForm
          {...rest}
          job={m.job}
          resume={m.resume}
          returnTo={m.returnTo}
        />
      );
    case "compose":
      return <ComposeForm {...rest} job={m.job} purpose={m.purpose} />;
    case "person":
      return <PersonDetail {...rest} person={m.person} />;
    case "connect":
      return <ConnectForm {...rest} person={m.person} />;
    case "thread":
      return <ThreadView {...rest} request={m.request} />;
    case "settings":
      return <SettingsForm {...rest} />;
    case "login":
      return <LoginForm {...rest} />;
  }
}
function JobDetail({
  board: b,
  job: given,
  open,
  close,
}: FormProps & { job: Job }) {
  const job = b.state.jobs.find((j) => j.id === given.id) || given,
    alum = b.state.people.find((p) => p.id === job.alumniId);
  const mine = b.user?.id === job.alumniId,
    existing = b.state.requests.find(
      (r) =>
        r.kind === "job" && r.jobId === job.id && r.studentId === b.user?.id,
    );
  const closed =
    job.acceptsNewRequests === false ||
    job.status !== "open" ||
    isExpired(job.deadline);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function compose(purpose: "referral" | "question") {
    if (!b.user) return open({ type: "login" });
    if (existing) return open({ type: "thread", request: existing });
    open({ type: "compose", job, purpose });
  }
  return (
    <Dialog
      title="The opportunity"
      description={`${job.company} · Shared by a Trojan`}
      onClose={close}
      wide
    >
      <div className="dialog-body">
        <div className="role-heading">
          <Logo company={job.company} color={job.color} large />
          <div>
            <span className="eyebrow">
              {job.company} · {job.team}
            </span>
            <h2>{job.title}</h2>
            <div className="job-meta">
              <span>
                <MapPin size={14} />
                {job.location}
              </span>
              <span>{job.workMode}</span>
              <span>{job.type}</span>
            </div>
          </div>
        </div>
        <div className="tags">
          {job.referralAvailable ? (
            <span className="tag referral">Open to referral requests</span>
          ) : (
            <span className="tag">Role questions welcome</span>
          )}
          <Status status={closed ? "closed" : "open"} />
        </div>
        <div className="detail-grid">
          <div>
            <section className="detail-section">
              <h3>About the role</h3>
              <p className="preserve-lines">{job.description}</p>
            </section>
            <section className="detail-section">
              <h3>What the team is looking for</h3>
              <ul className="requirements">
                {job.requirements
                  .split("\n")
                  .filter(Boolean)
                  .map((r, i) => (
                    <li key={i}>
                      <CheckCircle2 size={15} />
                      <span>{r.replace(/^[-•]\s*/, "")}</span>
                    </li>
                  ))}
              </ul>
            </section>
            <section className="detail-section">
              <h3>How to get in touch</h3>
              <p className="preserve-lines">
                {job.instructions ||
                  "Send a brief introduction and let the alum know how they can help."}
              </p>
              {job.applicationInstructions && (
                <p className="preserve-lines">{job.applicationInstructions}</p>
              )}
              {safeUrl(job.applicationUrl) && (
                <External href={safeUrl(job.applicationUrl)!}>
                  Official company application
                </External>
              )}
            </section>
            <p className="fineprint">
              {job.referralDisclaimer ||
                "A referral does not guarantee an interview or offer."}
            </p>
          </div>
          <aside className="alumni-context">
            <span className="eyebrow">YOUR ALUMNI CONNECTION</span>
            <Avatar person={alum} size="lg" />
            <h3>{alum?.name || "Alumni contact"}</h3>
            <p>
              {alum?.title}
              {alum?.company ? ` at ${alum.company}` : ""}
            </p>
            <small>
              {alum?.program} · USC ’{String(alum?.year || "").slice(-2)}
            </small>
            <p className="alumni-context-bio">
              {alum?.bio ||
                "A member of the USC community shared this opportunity."}
            </p>
            {alum && (
              <button
                className="text-link"
                onClick={() => open({ type: "person", person: alum })}
              >
                View profile
                <ArrowRight size={14} />
              </button>
            )}
            <div className="deadline">
              <CalendarDays size={16} />
              <span>
                Apply by <strong>{readableDate(job.deadline)}</strong>
              </span>
            </div>
          </aside>
        </div>
        {error && <ErrorBox message={error} />}
      </div>
      <footer className="dialog-footer">
        {mine ? (
          <>
            <Button
              variant="secondary"
              onClick={() => open({ type: "post", job })}
            >
              <Pencil size={15} />
              Edit post
            </Button>
            {!closed && (
              <Button
                variant="danger"
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await b.closeJob(job);
                    close();
                  } catch (e) {
                    setError(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Close role
              </Button>
            )}
          </>
        ) : b.user?.role === "alumni" ? (
          <span className="muted">
            This opportunity is shared by a fellow alum.
          </span>
        ) : existing ? (
          <Button onClick={() => open({ type: "thread", request: existing })}>
            Open your request
            <ArrowRight size={16} />
          </Button>
        ) : (
          <>
            <span className="footer-hint">
              {closed
                ? "This role is no longer accepting requests."
                : "A short introduction is a great start."}
            </span>
            <Button
              variant="secondary"
              disabled={closed}
              onClick={() => compose("question")}
            >
              Ask a question
            </Button>
            {job.referralAvailable && (
              <Button disabled={closed} onClick={() => compose("referral")}>
                Request referral
                <ArrowRight size={16} />
              </Button>
            )}
          </>
        )}
      </footer>
    </Dialog>
  );
}
function PostForm({ board: b, job, close }: FormProps & { job?: Job }) {
  const [draft, setDraft] = useState<Job>(
    job || {
      id: uid(),
      title: "",
      company: b.user?.company || "",
      team: "",
      industry: "Technology",
      location: b.user?.location || "",
      workMode: "Hybrid",
      type: "Full-time",
      description: "",
      requirements: "",
      instructions: "",
      applicationUrl: "",
      deadline: "",
      referralAvailable: true,
      alumniId: b.user?.id || "",
      status: "open",
      createdAt: new Date().toISOString(),
      color: "blue",
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function field(key: keyof Job, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (b.user?.role !== "alumni")
      return setError("Sign in as an alum to share an opening.");
    setBusy(true);
    try {
      await b.saveJob(draft, !!job);
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={job ? "Edit your opening" : "Open a door for a Trojan"}
      description="Share a role and let students know how you can help."
      onClose={close}
      wide
    >
      <form onSubmit={submit}>
        <div className="dialog-body form-grid">
          <Field label="Role title">
            <input
              required
              value={draft.title}
              onChange={(e) => field("title", e.target.value)}
              placeholder="e.g. Data Analyst Intern"
            />
          </Field>
          <Field label="Company">
            <input
              required
              value={draft.company}
              onChange={(e) => field("company", e.target.value)}
            />
          </Field>
          <Field label="Team">
            <input
              value={draft.team}
              onChange={(e) => field("team", e.target.value)}
              placeholder="e.g. Product Analytics"
            />
          </Field>
          <Field label="Location">
            <input
              required
              value={draft.location}
              onChange={(e) => field("location", e.target.value)}
            />
          </Field>
          <Field label="Opportunity type">
            <select
              value={draft.type}
              onChange={(e) => field("type", e.target.value)}
            >
              <option>Full-time</option>
              <option>Internship</option>
              <option>Part-time</option>
              <option>Contract</option>
            </select>
          </Field>
          <Field label="Work arrangement">
            <select
              value={draft.workMode}
              onChange={(e) => field("workMode", e.target.value)}
            >
              <option>Hybrid</option>
              <option>Remote</option>
              <option>On-site</option>
            </select>
          </Field>
          <Field label="About the role" full>
            <textarea
              required
              rows={4}
              value={draft.description}
              onChange={(e) => field("description", e.target.value)}
              placeholder="What will this person work on?"
            />
          </Field>
          <Field
            label="Requirements"
            hint="One requirement per line makes the role easier to review."
            full
          >
            <textarea
              required
              rows={4}
              value={draft.requirements}
              onChange={(e) => field("requirements", e.target.value)}
            />
          </Field>
          <Field label="Application link (optional)">
            <input
              type="url"
              value={draft.applicationUrl}
              onChange={(e) => field("applicationUrl", e.target.value)}
              placeholder="https://"
            />
          </Field>
          <Field label="Deadline (optional)">
            <input
              type="date"
              value={draft.deadline}
              min={job ? undefined : new Date().toLocaleDateString("en-CA")}
              onChange={(e) => field("deadline", e.target.value)}
            />
          </Field>
          <Field label="How would you like to help?" full>
            <select
              value={String(draft.referralAvailable)}
              onChange={(e) =>
                field("referralAvailable", e.target.value === "true")
              }
            >
              <option value="true">Open to referral requests</option>
              <option value="false">Role questions only</option>
            </select>
          </Field>
          <Field label="Official application instructions (optional)" full>
            <textarea
              rows={2}
              value={draft.applicationInstructions || ""}
              onChange={(e) => field("applicationInstructions", e.target.value)}
            />
          </Field>
          <Field label="A note from you" full>
            <textarea
              rows={3}
              value={draft.instructions}
              onChange={(e) => field("instructions", e.target.value)}
              placeholder="What should students share? Are there separate application steps?"
            />
          </Field>
          {error && (
            <div className="full">
              <ErrorBox message={error} />
            </div>
          )}
        </div>
        <footer className="dialog-footer">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            {job ? "Save changes" : "Publish opening"}
            <ArrowRight size={16} />
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
function PersonFields({
  draft,
  setDraft,
  skills,
  setSkills,
}: {
  draft: Person;
  setDraft: (p: Person) => void;
  skills: string;
  setSkills: (s: string) => void;
}) {
  const field = (key: keyof Person, value: unknown) =>
    setDraft({ ...draft, [key]: value });
  return (
    <>
      <Field label="Full name">
        <input
          required
          value={draft.name}
          onChange={(e) => field("name", e.target.value)}
        />
      </Field>
      <Field label="Contact email">
        <input
          type="email"
          required
          value={draft.email}
          onChange={(e) => field("email", e.target.value)}
        />
      </Field>
      <Field label="USC program">
        <input
          value={draft.program}
          onChange={(e) => field("program", e.target.value)}
          placeholder="e.g. MS Business Analytics"
        />
      </Field>
      <Field label="Graduation year">
        <input
          type="number"
          min="1900"
          max="2100"
          value={draft.year}
          onChange={(e) => field("year", +e.target.value)}
        />
      </Field>
      <Field label="Location">
        <input
          value={draft.location}
          onChange={(e) => field("location", e.target.value)}
        />
      </Field>
      <Field
        label={draft.role === "alumni" ? "Professional title" : "Headline"}
      >
        <input
          value={draft.title}
          onChange={(e) => field("title", e.target.value)}
        />
      </Field>
      {draft.role === "alumni" && (
        <Field label="Company" full>
          <input
            value={draft.company}
            onChange={(e) => field("company", e.target.value)}
          />
        </Field>
      )}
      <Field label="About you" full>
        <textarea
          rows={3}
          value={draft.bio}
          onChange={(e) => field("bio", e.target.value)}
        />
      </Field>
      <Field
        label={
          draft.role === "alumni"
            ? "Expertise (comma separated)"
            : "Skills & interests (comma separated)"
        }
        full
      >
        <input
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="SQL, Python, Product analytics"
        />
      </Field>
    </>
  );
}
function ProfileForm({ board: b, close }: FormProps) {
  const [draft, setDraft] = useState(b.user!),
    [skills, setSkills] = useState(b.user?.skills.join(", ") || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!draft) return null;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await b.saveManualProfile({
        ...draft,
        skills: skills
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      });
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Your story, in your words"
      description="A little context helps fellow Trojans make a meaningful connection."
      onClose={close}
      wide
    >
      <form onSubmit={submit}>
        <div className="dialog-body form-grid">
          <PersonFields
            draft={draft}
            setDraft={setDraft}
            skills={skills}
            setSkills={setSkills}
          />
          {draft.role === "student" ? (
            <>
              <Field label="Education" full>
                <textarea
                  rows={2}
                  value={draft.education}
                  onChange={(e) =>
                    setDraft({ ...draft, education: e.target.value })
                  }
                />
              </Field>
              <Field label="Experience" full>
                <textarea
                  rows={4}
                  value={draft.experience}
                  onChange={(e) =>
                    setDraft({ ...draft, experience: e.target.value })
                  }
                  placeholder="Internships, work, or other relevant experience"
                />
              </Field>
              <Field label="Projects" full>
                <textarea
                  rows={3}
                  value={draft.projects}
                  onChange={(e) =>
                    setDraft({ ...draft, projects: e.target.value })
                  }
                />
              </Field>
            </>
          ) : (
            <div className="full preferences-box">
              <h3>How you’d like to connect</h3>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={draft.openToConnect}
                  onChange={(e) =>
                    setDraft({ ...draft, openToConnect: e.target.checked })
                  }
                />
                Open to career conversations
              </label>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={draft.coffeeChats}
                  onChange={(e) =>
                    setDraft({ ...draft, coffeeChats: e.target.checked })
                  }
                />
                Open to coffee chat invitations
              </label>
              <Field label="Scheduling link (optional)">
                <input
                  type="url"
                  value={draft.schedulingUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, schedulingUrl: e.target.value })
                  }
                  placeholder="https://"
                />
              </Field>
            </div>
          )}
          {error && (
            <div className="full">
              <ErrorBox message={error} />
            </div>
          )}
        </div>
        <footer className="dialog-footer">
          <span className="footer-hint">
            You control the information you share.
          </span>
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            Save profile
            <Check size={16} />
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
function ResumeForm({
  board: b,
  job,
  returnTo,
  purpose = "referral",
  resumeId,
  open,
  close,
}: FormProps & {
  job?: Job;
  returnTo?: "compose";
  purpose?: "referral" | "question";
  resumeId?: string;
}) {
  const resumes = b.state.resumes.filter((r) => r.ownerId === b.user?.id);
  const first =
    resumes.find((r) => r.id === (resumeId || b.requestDraft.resumeId)) ||
    resumes.find((r) => !r.jobId) ||
    resumes[0];
  const [text, setText] = useState(first?.text || ""),
    [selected, setSelected] = useState(first?.id || ""),
    [source, setSource] = useState<ImportResult>(),
    [draft, setDraft] = useState({
      ...b.user!,
      name: first?.content?.contact.name || b.user?.name || "",
      email: first?.content?.contact.email || b.user?.email || "",
      location: first?.content?.contact.location || b.user?.location || "",
    }),
    [skills, setSkills] = useState(
      first?.content?.skills.join(", ") || b.user?.skills.join(", ") || "",
    ),
    [busy, setBusy] = useState(false),
    [reading, setReading] = useState(false),
    [error, setError] = useState("");
  if (!draft) return null;
  const selectedResume = resumes.find((r) => r.id === selected);
  async function downloadSavedFile() {
    if (!selectedResume) return;
    try {
      const url = await b.downloadResumeFile(selectedResume);
      const link = document.createElement("a");
      link.href = url;
      link.download = selectedResume.fileName || "resume";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setReading(true);
    setError("");
    try {
      const result = await b.importResume(file);
      setSource(result);
      setText(result.text);
      setSelected("");
      setDraft((d) => ({
        ...d,
        name: result.name || d.name,
        email: result.email || d.email,
      }));
      if (result.skills?.length) setSkills(result.skills.join(", "));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setReading(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim().length < 30)
      return setError(
        "Add enough resume content for an alum to understand your experience.",
      );
    setBusy(true);
    try {
      const resume = await b.confirmResume(
        {
          ...draft,
          skills: skills
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        },
        text,
        source,
        selectedResume,
      );
      if (job) {
        b.setRequestDraft((d) => ({
          ...d,
          jobId: job.id,
          resumeId: resume.id,
        }));
        open(
          returnTo === "compose"
            ? { type: "compose", job, purpose }
            : { type: "tailor", job, resume },
        );
      } else close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Your resume, ready to share"
      description="Upload a resume or use your saved information. Review everything before saving."
      onClose={close}
      wide
    >
      <form onSubmit={submit}>
        <div className="dialog-body">
          <div className="upload-zone">
            <UploadCloud size={28} />
            <div>
              <strong>
                {reading
                  ? "Reading your resume…"
                  : "Bring your experience with you."}
              </strong>
              <p>
                {source ? source.fileName : "Upload a PDF or DOCX · up to 5 MB"}
              </p>
            </div>
            <label
              className={`button secondary upload-button ${reading ? "disabled" : ""}`}
            >
              {reading ? "Reading…" : "Choose a file"}
              <input
                aria-label="Upload resume file"
                type="file"
                accept=".pdf,.docx"
                disabled={reading}
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {resumes.length > 0 && (
            <Field label="Or choose a saved version">
              <select
                value={selected}
                onChange={(e) => {
                  const r = resumes.find((r) => r.id === e.target.value);
                  if (r) {
                    setText(r.text);
                    setSelected(r.id);
                    setSource(undefined);
                    setSkills(
                      r.content?.skills.join(", ") ||
                        b.user?.skills.join(", ") ||
                        "",
                    );
                    setDraft((d) => ({
                      ...d,
                      name: r.content?.contact.name || b.user?.name || "",
                      email: r.content?.contact.email || b.user?.email || "",
                      location:
                        r.content?.contact.location || b.user?.location || "",
                    }));
                  }
                }}
              >
                <option value="" disabled>
                  Uploaded resume
                </option>
                {resumes.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {source && (
            <Notice>
              {b.settings.mode === "api"
                ? "The file was read in this browser. The backend will save the confirmed content."
                : "The file has been read. Confirm the details below and correct anything you’d like to change."}
            </Notice>
          )}
          <div className="resume-confirm-heading">
            <h3>Review your information</h3>
            {(source?.fileData || selectedResume?.fileData) && (
              <a
                className="text-link"
                href={source?.fileData || selectedResume?.fileData}
                download={source?.fileName || selectedResume?.fileName}
              >
                <Download size={14} />
                Original file
              </a>
            )}
            {!source &&
              selectedResume?.fileName &&
              b.settings.mode === "api" && (
                <button
                  type="button"
                  className="text-link"
                  onClick={downloadSavedFile}
                >
                  <Download size={14} />
                  Original file
                </button>
              )}
          </div>
          <div className="form-grid">
            <Field label="Full name">
              <input
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Contact email">
              <input
                required
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </Field>
            <Field label="USC program">
              <input
                value={draft.program}
                onChange={(e) =>
                  setDraft({ ...draft, program: e.target.value })
                }
              />
            </Field>
            <Field label="Location">
              <input
                value={draft.location}
                onChange={(e) =>
                  setDraft({ ...draft, location: e.target.value })
                }
              />
            </Field>
            <Field label="Skills (comma separated)">
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
              />
            </Field>
            <Field
              label="Confirmed resume content"
              full
              hint="This editable content is used for tailoring, your selected submission, and alumni review."
            >
              <textarea
                required
                rows={15}
                className="resume-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={profileResume(draft)}
              />
            </Field>
          </div>
          {!text && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setText(profileResume(draft))}
            >
              Use my profile information
            </Button>
          )}
          {error && <ErrorBox message={error} />}
        </div>
        <footer className="dialog-footer">
          <span className="footer-hint">
            Existing information changes only when you confirm.
          </span>
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={reading} busy={busy}>
            Confirm and save
            <Check size={16} />
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
function TailorForm({
  board: b,
  job,
  resume,
  returnTo,
  open,
  close,
}: FormProps & { job: Job; resume: Resume; returnTo?: "compose" }) {
  const [text, setText] = useState(resume.text),
    [suggestions, setSuggestions] = useState<Suggestion[]>([]),
    [applied, setApplied] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function generate() {
    setBusy(true);
    setError("");
    try {
      setSuggestions(await b.tailor(resume, job));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setSaving(true);
    try {
      const next = await b.saveTailored(resume, job, text);
      b.setRequestDraft((d) => ({ ...d, jobId: job.id, resumeId: next.id }));
      if (returnTo) open({ type: "compose", job, purpose: "referral" });
      else close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      title="Make your experience relevant"
      description={`${job.title} · ${job.company}`}
      onClose={close}
      wide
    >
      <div className="dialog-body">
        <AiLabel demo={b.settings.mode === "demo"} />
        <p className="muted">
          Review suggestions against the role, edit the wording, and keep only
          changes that accurately describe your experience.
        </p>
        <Button variant="secondary" busy={busy} onClick={generate}>
          <Sparkles size={16} />
          {suggestions.length ? "Review again" : "Suggest targeted edits"}
        </Button>
        {suggestions.map((s, i) => (
          <div className="suggestion-card" key={i}>
            <span className="eyebrow">RELEVANT EXPERIENCE {i + 1}</span>
            <p className="original-passage">{s.original}</p>
            <textarea
              aria-label={`Suggested edit ${i + 1}`}
              rows={3}
              value={s.suggested}
              onChange={(e) =>
                setSuggestions((v) =>
                  v.map((a, n) =>
                    n === i ? { ...a, suggested: e.target.value } : a,
                  ),
                )
              }
            />
            <p>{s.reason}</p>
            <Button
              variant="secondary"
              disabled={applied.includes(i)}
              onClick={() => {
                if (!text.includes(s.original))
                  return setError(
                    "That source passage has changed. Edit the resume below or review again.",
                  );
                setText((t) => t.replace(s.original, s.suggested));
                setApplied((a) => [...a, i]);
              }}
            >
              {applied.includes(i) ? (
                <>
                  <Check size={15} />
                  Applied
                </>
              ) : (
                <>
                  Use this wording
                  <ArrowRight size={15} />
                </>
              )}
            </Button>
          </div>
        ))}
        <Field label="Your job-specific resume" full>
          <textarea
            className="resume-textarea"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        {error && <ErrorBox message={error} />}
      </div>
      <footer className="dialog-footer">
        <span className="footer-hint">
          Your base resume stays saved separately.
        </span>
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button busy={saving} disabled={text.trim().length < 30} onClick={save}>
          Save this version
          <Check size={16} />
        </Button>
      </footer>
    </Dialog>
  );
}
function ComposeForm({
  board: b,
  job,
  purpose,
  open,
  close,
}: FormProps & { job: Job; purpose: "referral" | "question" }) {
  const alumni = b.state.people.find((p) => p.id === job.alumniId),
    resumes = b.state.resumes.filter((r) => r.ownerId === b.user?.id);
  const [note, setNote] = useState(
      b.requestDraft.jobId === job.id ? b.requestDraft.note : "",
    ),
    [resumeId, setResumeId] = useState(
      b.requestDraft.jobId === job.id && b.requestDraft.resumeId
        ? b.requestDraft.resumeId
        : resumes.find((r) => r.jobId === job.id)?.id || resumes[0]?.id || "",
    ),
    [share, setShare] = useState(false),
    [preview, setPreview] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const resume = resumes.find((r) => r.id === resumeId);
  function remember() {
    b.setRequestDraft({ jobId: job.id, note, resumeId });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!note.trim())
      return setError("Write a short introduction or question.");
    if (purpose === "referral" && !resume)
      return setError(
        "Select or add a confirmed resume for your referral request.",
      );
    if (!preview) return setPreview(true);
    setBusy(true);
    try {
      const request = await b.submitRequest(
        job,
        purpose,
        note.trim(),
        purpose === "referral" ? resume : undefined,
        share,
      );
      b.setRequestDraft({ jobId: "", note: "", resumeId: "" });
      open({ type: "thread", request });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        preview
          ? "One last look before you send"
          : purpose === "referral"
            ? "Start with a thoughtful introduction"
            : "Ask the person behind the role"
      }
      description={
        preview
          ? "Confirm the materials you’re sharing."
          : `Your message goes directly to ${alumni?.name || "the responsible alum"}.`
      }
      onClose={close}
      wide
    >
      <form onSubmit={submit}>
        <div className="dialog-body">
          <div className="context-card">
            <Logo company={job.company} color={job.color} />
            <div>
              <strong>{job.title}</strong>
              <span>
                {job.company} · {job.location}
              </span>
            </div>
            <Avatar person={alumni} size="sm" />
          </div>
          {preview ? (
            <>
              <div className="review-block">
                <h3>Your introduction</h3>
                <p className="preserve-lines">{note}</p>
              </div>
              {purpose === "referral" && resume && (
                <div className="review-block">
                  <h3>Selected resume · {resume.label}</h3>
                  <pre className="resume-preview">{resume.text}</pre>
                  <p className="fineprint">
                    {share
                      ? "The original uploaded file will also be shared, labeled separately."
                      : "Your confirmed resume content will be shared."}
                  </p>
                </div>
              )}
              <Notice>
                {purpose === "referral"
                  ? "This is a request to the alum. Follow any separate official application instructions."
                  : "Your question will appear in a conversation with this alum."}
              </Notice>
            </>
          ) : (
            <>
              <Field label="Your introduction" full>
                <textarea
                  required
                  maxLength={2000}
                  rows={5}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={`Hi ${alumni?.name.split(" ")[0] || "there"}, I’m a USC student interested in…`}
                />
              </Field>
              {purpose === "referral" && (
                <>
                  <div className="resume-select-heading">
                    <h3>Your resume</h3>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        remember();
                        open({
                          type: "resume",
                          job,
                          returnTo: "compose",
                          purpose,
                        });
                      }}
                    >
                      <UploadCloud size={15} />
                      Upload or edit
                    </button>
                  </div>
                  {resumes.length ? (
                    <Field label="Choose the version to share">
                      <select
                        value={resumeId}
                        onChange={(e) => setResumeId(e.target.value)}
                      >
                        {resumes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <div className="inline-empty">
                      <FileText size={20} />
                      <span>
                        Add your resume to help the alum understand your
                        experience.
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          remember();
                          open({
                            type: "resume",
                            job,
                            returnTo: "compose",
                            purpose,
                          });
                        }}
                      >
                        Add resume
                      </Button>
                    </div>
                  )}
                  {resume && (
                    <>
                      <div className="tailor-callout">
                        <span className="small-icon">
                          <Sparkles size={19} />
                        </span>
                        <div>
                          <strong>A little preparation goes a long way.</strong>
                          <p>Review your experience against this role.</p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            remember();
                            open({
                              type: "tailor",
                              job,
                              resume,
                              returnTo: "compose",
                            });
                          }}
                        >
                          Tailor for this role
                        </Button>
                      </div>
                      {(resume.fileData ||
                        (b.settings.mode === "api" && resume.fileName)) && (
                        <label className="check-line">
                          <input
                            type="checkbox"
                            checked={share}
                            onChange={(e) => setShare(e.target.checked)}
                          />
                          Also share the original file ({resume.fileName})
                        </label>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
          {error && <ErrorBox message={error} />}
        </div>
        <footer className="dialog-footer">
          {preview ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPreview(false)}
            >
              <ArrowLeft size={15} />
              Back to edit
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
          )}
          <Button type="submit" busy={busy}>
            {preview ? (
              <>
                <Send size={15} />
                Send request
              </>
            ) : (
              <>
                Preview request
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
function PersonDetail({
  board: b,
  person: given,
  open,
  close,
}: FormProps & { person: Person }) {
  const person = b.state.people.find((p) => p.id === given.id) || given;
  const existing = b.state.requests.find(
    (r) =>
      r.kind === "connection" &&
      r.studentId === b.user?.id &&
      r.alumniId === person.id,
  );
  const posts = b.state.jobs.filter(
    (j) => j.alumniId === person.id && j.status === "open",
  );
  const own = b.user?.id === person.id;
  return (
    <Dialog title="A fellow Trojan" onClose={close} wide>
      <div className="dialog-body">
        <div className="person-detail-heading">
          <Avatar person={person} size="xl" />
          <div>
            <h2>{person.name}</h2>
            <p>
              {person.title}
              {person.company ? ` at ${person.company}` : ""}
            </p>
            <span>
              <GraduationCap size={15} />
              {person.program} · USC ’{String(person.year).slice(-2)}
            </span>
            <span>
              <MapPin size={15} />
              {person.location || "Location not listed"}
            </span>
          </div>
        </div>
        <section className="detail-section">
          <h3>About</h3>
          <p className="preserve-lines">
            {person.bio ||
              "This profile has not added a personal introduction yet."}
          </p>
        </section>
        <section className="detail-section">
          <h3>Areas to talk about</h3>
          <div className="tags">
            {person.skills.length ? (
              person.skills.map((s) => (
                <span className="tag" key={s}>
                  {s}
                </span>
              ))
            ) : (
              <span className="muted">Expertise has not been listed yet.</span>
            )}
          </div>
        </section>
        {person.role === "alumni" && (
          <div className="connection-preferences">
            <div>
              <MessageSquare size={19} />
              <span>
                <strong>Career conversations</strong>
                <small>
                  {person.openToConnect
                    ? "Open to connecting"
                    : "Not currently taking requests"}
                </small>
              </span>
            </div>
            <div>
              <Coffee size={19} />
              <span>
                <strong>Coffee chats</strong>
                <small>
                  {person.coffeeChats
                    ? "Invitations welcome"
                    : "Not currently available"}
                </small>
              </span>
            </div>
          </div>
        )}
        {posts.length > 0 && (
          <section className="detail-section">
            <h3>Openings shared by {person.name.split(" ")[0]}</h3>
            {posts.map((j) => (
              <button
                className="mini-job"
                key={j.id}
                onClick={() => open({ type: "job", job: j })}
              >
                <Logo company={j.company} color={j.color} />
                <span>
                  <strong>{j.title}</strong>
                  <small>
                    {j.company} · {j.location}
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </section>
        )}
      </div>
      <footer className="dialog-footer">
        {own ? (
          <Button variant="secondary" onClick={() => open({ type: "profile" })}>
            Edit your profile
          </Button>
        ) : person.role === "alumni" ? (
          existing ? (
            <Button onClick={() => open({ type: "thread", request: existing })}>
              Open invitation
              <ArrowRight size={16} />
            </Button>
          ) : (
            <>
              <span className="footer-hint">
                Start with a purpose and a short introduction.
              </span>
              <Button
                disabled={!person.openToConnect && !person.coffeeChats}
                onClick={() =>
                  open(b.user ? { type: "connect", person } : { type: "login" })
                }
              >
                Connect
                <ArrowRight size={16} />
              </Button>
            </>
          )
        ) : (
          <Button variant="secondary" onClick={close}>
            Close profile
          </Button>
        )}
      </footer>
    </Dialog>
  );
}
function ConnectForm({
  board: b,
  person,
  open,
  close,
}: FormProps & { person: Person }) {
  const [purpose, setPurpose] = useState<"connection" | "coffee">(
      person.openToConnect ? "connection" : "coffee",
    ),
    [note, setNote] = useState(""),
    [topic, setTopic] = useState(""),
    [availability, setAvailability] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const request = await b.connect(
        person,
        purpose,
        note,
        topic,
        availability,
      );
      open({ type: "thread", request });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={`Say hello to ${person.name.split(" ")[0]}`}
      description="Make your request specific and easy to respond to."
      onClose={close}
    >
      <form onSubmit={submit}>
        <div className="dialog-body">
          <div className="person-summary">
            <Avatar person={person} />
            <div>
              <strong>{person.name}</strong>
              <span>
                {person.title} at {person.company}
              </span>
            </div>
          </div>
          <Field label="What would you like to connect about?">
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as typeof purpose)}
            >
              {person.openToConnect && (
                <option value="connection">
                  Career advice / general connection
                </option>
              )}
              {person.coffeeChats && (
                <option value="coffee">A coffee chat</option>
              )}
            </select>
          </Field>
          <Field label="Your introduction">
            <textarea
              required
              minLength={20}
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tell them a little about yourself and what you’d like to learn."
            />
          </Field>
          {purpose === "coffee" && (
            <>
              <Field label="Conversation topic">
                <input
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Moving from analytics into product"
                />
              </Field>
              <Field label="Proposed availability, including timezone">
                <textarea
                  rows={2}
                  required
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder="e.g. Tuesday or Thursday afternoon, Pacific Time"
                />
              </Field>
            </>
          )}
          <p className="fineprint">
            After acceptance, you can exchange replies and share contact details
            to arrange your conversation. Accepting an invitation does not
            confirm a meeting time.
          </p>
          {error && <ErrorBox message={error} />}
        </div>
        <footer className="dialog-footer">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            Send invitation
            <Send size={15} />
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
function ThreadView({
  board: b,
  request: given,
  open,
  close,
}: FormProps & { request: RequestItem }) {
  const request = b.state.requests.find((r) => r.id === given.id) || given,
    user = b.user;
  const [reply, setReply] = useState(""),
    [review, setReview] = useState<Review>(),
    [busy, setBusy] = useState(false),
    [reviewing, setReviewing] = useState(false),
    [error, setError] = useState(""),
    [showResume, setShowResume] = useState(false);
  if (!user || ![request.studentId, request.alumniId].includes(user.id))
    return (
      <Dialog title="Private conversation" onClose={close}>
        <div className="dialog-body">
          <Empty
            title="This conversation is private."
            description="Only its participants can view the materials and replies."
          />
        </div>
      </Dialog>
    );
  const amAlum = user.id === request.alumniId,
    student = b.state.people.find((p) => p.id === request.studentId),
    alum = b.state.people.find((p) => p.id === request.alumniId),
    other = amAlum ? student : alum,
    job = b.state.jobs.find((j) => j.id === request.jobId);
  const messages = b.state.messages.filter((m) => m.requestId === request.id);
  const mayReply =
    !request.readOnly &&
    (request.kind === "job"
      ? ["pending", "interested"].includes(request.status)
      : request.status === "accepted");
  async function decide(status: "interested" | "accepted" | "declined") {
    setBusy(true);
    setError("");
    try {
      await b.decide(
        request,
        status,
        request.kind === "job" && b.settings.mode === "api"
          ? undefined
          : reply.trim() || undefined,
      );
      if (request.kind !== "job" || b.settings.mode !== "api") setReply("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await b.sendMessage(request, reply.trim());
      setReply("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function analyze() {
    if (!job) return;
    setReviewing(true);
    try {
      setReview(await b.review(request, job));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setReviewing(false);
    }
  }
  async function original() {
    try {
      const url = await b.downloadOriginal(request);
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = request.fileName || "resume";
        a.click();
        if (url.startsWith("blob:"))
          setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <Dialog
      title={
        request.kind === "job" ? "Your job conversation" : "A Trojan connection"
      }
      description={`${other?.name || "Community member"} · ${request.kind === "job" ? job?.company || request.jobCompany || "Job request" : request.purpose === "coffee" ? "Coffee chat" : "Career conversation"}`}
      onClose={close}
      wide
    >
      <div className="dialog-body">
        <div className="thread-context">
          <Avatar person={other} />
          <div>
            <strong>{other?.name || "Community member"}</strong>
            <span>
              {job
                ? `${job.title} · ${job.company}`
                : request.jobTitle ||
                  request.topic ||
                  "A conversation with a fellow Trojan"}
            </span>
          </div>
          <Status status={request.status} />
        </div>
        {request.availability && (
          <Notice>
            Proposed availability: {request.availability}. Confirm a time
            together after acceptance.
          </Notice>
        )}
        {request.kind === "job" &&
          (request.resumeSnapshot || request.fileName) && (
            <section className="submitted-materials">
              <div className="panel-heading">
                <div>
                  <h3>Submitted materials</h3>
                  <small>
                    {request.resumeLabel || request.fileName || "Shared resume"}
                  </small>
                </div>
                <div className="inline-actions">
                  {request.fileName && (
                    <button className="text-link" onClick={original}>
                      <Download size={14} />
                      Original file
                    </button>
                  )}
                  {request.resumeSnapshot && (
                    <button
                      className="text-link"
                      onClick={() => setShowResume(!showResume)}
                    >
                      <FileText size={14} />
                      {showResume ? "Hide resume" : "View resume"}
                    </button>
                  )}
                </div>
              </div>
              {showResume && (
                <pre className="resume-preview">{request.resumeSnapshot}</pre>
              )}
              {amAlum && (
                <>
                  <Button
                    variant="secondary"
                    busy={reviewing}
                    disabled={
                      !request.resumeSnapshot && b.settings.mode === "demo"
                    }
                    onClick={analyze}
                  >
                    <Sparkles size={16} />
                    Review with AI
                  </Button>
                  {review && (
                    <div className="review-results">
                      <AiLabel demo={b.settings.mode === "demo"} />
                      <h3>Relevant experience at a glance</h3>
                      <p>{review.summary}</p>
                      <div className="evidence-list">
                        {review.evidence.map((item, i) => (
                          <div className="evidence-row" key={i}>
                            <div>
                              <strong>{item.requirement}</strong>
                              <span
                                className={`evidence-status ${item.status}`}
                              >
                                {item.status === "found"
                                  ? "Evidence found"
                                  : item.status === "partial"
                                    ? "Partial evidence"
                                    : "Information missing"}
                              </span>
                            </div>
                            <p>{item.evidence}</p>
                          </div>
                        ))}
                      </div>
                      {review.questions.length > 0 && (
                        <>
                          <h4>Useful follow-up questions</h4>
                          <ul>
                            {review.questions.map((q) => (
                              <li key={q}>{q}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      <p className="fineprint">
                        Use the supporting passages to make your own assessment.
                        Missing information is not proof of a missing skill.
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        {request.kind === "connection" && request.status === "accepted" && (
          <div className="contact-handoff">
            <CheckCircle2 size={21} />
            <div>
              <strong>You’re connected.</strong>
              <p>
                Agree on a time in this conversation or use your shared contact
                details.
              </p>
              {other?.email && (
                <a className="text-link" href={`mailto:${other.email}`}>
                  <Mail size={14} />
                  {other.email}
                </a>
              )}
              {alum?.schedulingUrl && safeUrl(alum.schedulingUrl) && (
                <External href={safeUrl(alum.schedulingUrl)!}>
                  Scheduling link
                </External>
              )}
            </div>
          </div>
        )}
        <div className="conversation">
          <h3>Conversation</h3>
          <div
            className={`message ${request.studentId === user.id ? "mine" : ""}`}
          >
            <Avatar person={student} size="sm" />
            <div>
              <span>
                {student?.name || "Requester"} ·{" "}
                {readableDate(request.createdAt)}
              </span>
              <p>{request.note}</p>
            </div>
          </div>
          {messages.map((m) => {
            const sender = b.state.people.find((p) => p.id === m.senderId);
            return (
              <div
                className={`message ${m.senderId === user.id ? "mine" : ""}`}
                key={m.id}
              >
                <Avatar person={sender} size="sm" />
                <div>
                  <span>
                    {sender?.name || "Community member"} ·{" "}
                    {readableDate(m.createdAt)}
                  </span>
                  <p>{m.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        {error && <ErrorBox message={error} />}
        <form onSubmit={send} className="reply-form">
          <label className="field">
            <span>
              {mayReply
                ? "Your reply"
                : request.status === "pending"
                  ? "Waiting for the invitation to be accepted"
                  : "This request is closed"}
            </span>
            <textarea
              disabled={!mayReply && !(amAlum && request.status === "pending")}
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={
                mayReply
                  ? "Keep the conversation going…"
                  : amAlum && request.status === "pending"
                    ? "An optional note to send with your response…"
                    : "Replies appear here after acceptance."
              }
            />
          </label>
          <div className="thread-actions">
            {amAlum && request.status === "pending" ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  busy={busy}
                  onClick={() => decide("declined")}
                >
                  Decline
                </Button>
                <Button
                  type="button"
                  busy={busy}
                  onClick={() =>
                    decide(request.kind === "job" ? "interested" : "accepted")
                  }
                >
                  {request.kind === "job"
                    ? "Interested — continue"
                    : "Accept invitation"}
                  <Check size={16} />
                </Button>
              </>
            ) : null}
            {mayReply && (
              <Button
                type="submit"
                variant={
                  amAlum && request.status === "pending"
                    ? "secondary"
                    : "primary"
                }
                busy={busy}
                disabled={!reply.trim()}
              >
                <Send size={15} />
                Send reply
              </Button>
            )}
          </div>
        </form>
      </div>
    </Dialog>
  );
}
function SettingsForm({ board: b, close }: FormProps) {
  const [mode, setMode] = useState(b.settings.mode),
    [url, setUrl] = useState(b.settings.apiUrl),
    [confirmReset, setConfirmReset] = useState(false),
    [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "api" && !safeUrl(url))
      return setError("Enter an http or https backend URL.");
    b.configure({ mode, apiUrl: url });
    close();
  }
  return (
    <Dialog
      title="Preview workspace"
      description="Choose local sample data or connect to your team’s backend."
      onClose={close}
    >
      <form onSubmit={submit}>
        <div className="dialog-body">
          <div className="mode-options">
            <label className={mode === "demo" ? "selected" : ""}>
              <input
                type="radio"
                name="mode"
                checked={mode === "demo"}
                onChange={() => setMode("demo")}
              />
              <div>
                <strong>Local demo</strong>
                <p>
                  Fictional profiles and roles, saved in this browser. Real
                  PDF/DOCX reading; rule-based assistance previews.
                </p>
              </div>
            </label>
            <label className={mode === "api" ? "selected" : ""}>
              <input
                type="radio"
                name="mode"
                checked={mode === "api"}
                onChange={() => setMode("api")}
              />
              <div>
                <strong>Connect a backend</strong>
                <p>
                  Use your team’s running API. Available operations use real
                  server responses.
                </p>
              </div>
            </label>
          </div>
          {mode === "api" && (
            <Field label="API base URL">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:8000"
              />
            </Field>
          )}
          <div className="reset-panel">
            <strong>Start the sample workspace fresh</strong>
            <p>
              Clears locally saved demo profiles, resumes, and conversations.
            </p>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (confirmReset) {
                  b.resetDemo();
                  close();
                } else setConfirmReset(true);
              }}
            >
              {confirmReset
                ? "Confirm reset of local demo data"
                : "Reset sample workspace"}
            </Button>
          </div>
          {error && <ErrorBox message={error} />}
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit">
            Use this workspace
            <ArrowRight size={16} />
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
function LoginForm({ board: b, close }: FormProps) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await b.login(email, password);
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        b.settings.mode === "demo"
          ? "Try a Trojan’s perspective"
          : "Welcome back, Trojan"
      }
      description={
        b.settings.mode === "demo"
          ? "Choose a fictional identity to explore the app."
          : "Sign in to your team’s backend."
      }
      onClose={close}
    >
      {b.settings.mode === "demo" ? (
        <div className="dialog-body demo-identity-options">
          {b.state.people
            .filter((p) => ["alex", "maya", "jordan"].includes(p.id))
            .map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  b.switchIdentity(p.id);
                  close();
                }}
              >
                <Avatar person={p} />
                <div>
                  <strong>{p.name}</strong>
                  <span>
                    {p.role === "student" ? "Student" : `Alum · ${p.company}`}
                  </span>
                </div>
                <ArrowRight size={18} />
              </button>
            ))}
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="dialog-body">
            <Field label="Email">
              <input
                autoComplete="username"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                autoComplete="current-password"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <ErrorBox message={error} />}
          </div>
          <footer className="dialog-footer">
            <Button type="submit" busy={busy}>
              Sign in
              <ArrowRight size={16} />
            </Button>
          </footer>
        </form>
      )}
    </Dialog>
  );
}
