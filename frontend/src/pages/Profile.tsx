import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Coffee,
  Download,
  FileText,
  GraduationCap,
  Inbox,
  LayoutGrid,
  Mail,
  MapPin,
  MessagesSquare,
  Pencil,
  Plus,
  UploadCloud,
  UsersRound,
  X,
} from "lucide-react";
import type { Board } from "../useBoard";
import type { ModalState, RequestItem } from "../types";
import {
  Avatar,
  Button,
  Empty,
  Logo,
  PaneEmpty,
  Split,
  Status,
} from "../components/ui";
import { PaneView, inPane, modalKey } from "../components/Dialogs";
import { readableDate } from "../lib/utils";
import { downloadResumePdf, pdfName } from "../lib/resumePdf";

type TabId = "overview" | "posts" | "requests" | "connections";

export function Profile({
  board: b,
  modal,
  open,
  close,
}: {
  board: Board;
  modal: ModalState;
  open: (m: ModalState, options?: { root?: boolean }) => void;
  close: () => void;
}) {
  const [active, setActive] = useState<TabId>("overview"),
    [statusFilter, setStatusFilter] = useState(""),
    [jobFilter, setJobFilter] = useState("");
  if (!b.user)
    return (
      <Empty
        title="Sign in to view your profile"
        description="Sign in to edit your profile, manage your materials, and follow your conversations."
        action={
          <Button onClick={() => open({ type: "login" })}>Sign in</Button>
        }
      />
    );
  const user = b.user,
    alum = user.role === "alumni";
  const canEditProfile = true;
  const requests = b.state.requests.filter(
    (r) => r.studentId === user.id || r.alumniId === user.id,
  );
  const jobs = requests.filter((r) => r.kind === "job"),
    connections = requests.filter((r) => r.kind === "connection");
  const myPosts = b.state.jobs.filter((j) => j.alumniId === user.id),
    resumes = b.state.resumes.filter((r) => r.ownerId === user.id);
  const tabs: { id: TabId; label: string; count: number | null; Icon: typeof Inbox }[] = [
    { id: "overview", label: "Overview", count: null, Icon: LayoutGrid },
    ...(alum
      ? [
          {
            id: "posts" as const,
            label: "My posts",
            count: myPosts.length,
            Icon: BriefcaseBusiness,
          },
        ]
      : []),
    {
      id: "requests",
      label: alum ? "Job requests" : "My job requests",
      count: jobs.length,
      Icon: Inbox,
    },
    {
      id: "connections",
      label: alum ? "Connection requests" : "My connections",
      count: connections.length,
      Icon: UsersRound,
    },
  ];
  function switchTab(id: TabId, job = "") {
    setActive(id);
    setStatusFilter("");
    setJobFilter(job);
    open(null);
  }
  const pane = inPane(modal) ? (
    <PaneView board={b} modal={modal} open={open} close={close} />
  ) : null;
  const paneKey = modal ? modalKey(modal) : undefined;

  function requestRows(
    items: RequestItem[],
    onOpen: (r: RequestItem) => void,
  ) {
    return (
      <div className="row-list">
        {items.map((r) => {
          const other = b.state.people.find(
              (p) =>
                p.id === (r.studentId === user.id ? r.alumniId : r.studentId),
            ),
            job = b.state.jobs.find((j) => j.id === r.jobId);
          const selected =
            modal?.type === "thread" && modal.request.id === r.id;
          return (
            <button
              className={`list-row ${selected ? "active" : ""}`}
              aria-current={selected || undefined}
              key={r.id}
              onClick={() => onOpen(r)}
            >
              <Avatar person={other} />
              <span className="list-row-main">
                <span className="list-row-top">
                  <strong>{other?.name || "Community member"}</strong>
                  <small>{readableDate(r.createdAt)}</small>
                </span>
                <span className="list-row-sub">
                  {r.kind === "job"
                    ? `${job?.title || r.jobTitle || "Job request"} · ${job?.company || r.jobCompany || ""}`
                    : r.purpose === "coffee"
                      ? "Coffee chat"
                      : "Career conversation"}
                </span>
                <span className="list-row-meta">
                  <Status status={r.status} />
                </span>
              </span>
            </button>
          );
        })}
        {!items.length && (
          <Empty
            title={alum ? "No requests yet" : "No conversations yet"}
            description={
              alum
                ? "Requests will appear here when someone contacts you."
                : "Find a role or alum and send a thoughtful introduction."
            }
          />
        )}
      </div>
    );
  }

  function inbox(kind: "job" | "connection") {
    const source = (kind === "job" ? jobs : connections).filter(
      (r) => !jobFilter || r.jobId === jobFilter,
    );
    const statuses =
      kind === "job"
        ? ["pending", "interested", "declined"]
        : ["pending", "accepted", "declined"];
    const items = source
      .filter((r) => !statusFilter || r.status === statusFilter)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    const filterJob = myPosts.find((j) => j.id === jobFilter);
    return (
      <Split
        className="inbox-split"
        paneKey={paneKey}
        pane={pane}
        empty={
          <PaneEmpty
            icon={<MessagesSquare size={22} />}
            title="Select a conversation"
          />
        }
        list={
          <>
            <div className="chip-row">
              {["", ...statuses].map((s) => (
                <button
                  key={s || "all"}
                  className={`chip ${statusFilter === s ? "active" : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s ? s[0].toUpperCase() + s.slice(1) : "All"}
                  <span>
                    {s ? source.filter((r) => r.status === s).length : source.length}
                  </span>
                </button>
              ))}
            </div>
            {filterJob && (
              <div className="chip-row">
                <button
                  className="chip active"
                  onClick={() => setJobFilter("")}
                  aria-label={`Show requests for all roles, not only ${filterJob.title}`}
                >
                  {filterJob.title}
                  <X size={13} />
                </button>
              </div>
            )}
            {requestRows(items, (r) =>
              open({ type: "thread", request: r }, { root: true }),
            )}
          </>
        }
      />
    );
  }

  function overview() {
    if (pane) return <div className="pane-solo">{pane}</div>;
    return (
      <div className="overview-grid">
        <section className="panel span-2">
          <div className="panel-heading">
            <h2>About</h2>
            {canEditProfile && (
              <button
                className="icon-button"
                aria-label="Edit about"
                onClick={() => open({ type: "profile" })}
              >
                <Pencil size={16} />
              </button>
            )}
          </div>
          <p className="preserve-lines">
            {user.bio ||
              "Add a short introduction to help the community get to know you."}
          </p>
        </section>
        {!alum && (
          <>
            <section className="panel span-2">
              <div className="panel-heading">
                <h2>Experience & projects</h2>
              </div>
              <div className="experience-item">
                <span className="small-icon">
                  <BriefcaseBusiness size={18} />
                </span>
                <div>
                  <h3>Experience</h3>
                  <p className="preserve-lines">
                    {user.experience ||
                      "Add your experience, including internships and class projects."}
                  </p>
                </div>
              </div>
              <div className="experience-item">
                <span className="small-icon">
                  <FileText size={18} />
                </span>
                <div>
                  <h3>Projects</h3>
                  <p className="preserve-lines">
                    {user.projects || "Share a project you enjoyed working on."}
                  </p>
                </div>
              </div>
            </section>
            <section className="panel span-2">
              <div className="panel-heading">
                <h2>My resumes</h2>
                <button
                  className="text-link"
                  onClick={() => open({ type: "resume" })}
                >
                  <Plus size={15} />
                  Add resume
                </button>
              </div>
              {resumes.length ? (
                resumes.map((r) => (
                  <div className="resume-row" key={r.id}>
                    <span className="file-icon">
                      <FileText size={20} />
                    </span>
                    <div>
                      <strong>{r.label}</strong>
                      <small>
                        {r.jobId ? "Job-specific version" : "Base resume"} ·{" "}
                        {readableDate(r.createdAt)}
                      </small>
                    </div>
                    <button
                      className="text-link"
                      onClick={() =>
                        void downloadResumePdf(
                          r.text,
                          pdfName(user.name, r.label),
                        )
                      }
                    >
                      <Download size={14} />
                      PDF
                    </button>
                    <button
                      className="text-link"
                      onClick={() => open({ type: "resume", resumeId: r.id })}
                    >
                      Review
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Upload a resume or complete your profile to prepare your
                  materials.
                </p>
              )}
            </section>
          </>
        )}
        {alum && canEditProfile && (
          <section className="panel span-2">
            <div className="panel-heading">
              <h2>Ways to connect</h2>
              <Coffee size={19} />
            </div>
            <div className="preference-row">
              <strong>Career conversations</strong>
              <Status status={user.openToConnect ? "open" : "closed"} />
            </div>
            <div className="preference-row">
              <strong>Coffee chats</strong>
              <Status status={user.coffeeChats ? "open" : "closed"} />
            </div>
            <Button
              variant="secondary"
              onClick={() => open({ type: "profile" })}
            >
              Update preferences
            </Button>
          </section>
        )}
        <section className="panel">
          <h3 className="sidebar-heading">Trojan background</h3>
          <div className="info-line">
            <GraduationCap size={20} />
            <div>
              <strong>{user.school || "USC"}</strong>
              <p>{user.program}</p>
              <small>Class of {user.year}</small>
            </div>
          </div>
          <div className="info-line">
            <Mail size={18} />
            <div>
              <strong>Contact email</strong>
              <p>{user.email}</p>
            </div>
          </div>
        </section>
        <section className="panel">
          <h3 className="sidebar-heading">
            {alum ? "Expertise" : "Skills & interests"}
          </h3>
          <div className="tags">
            {user.skills.map((s) => (
              <span className="tag" key={s}>
                {s}
              </span>
            ))}
          </div>
          {!user.skills.length && (
            <p className="muted">Add a few areas you know or want to explore.</p>
          )}
        </section>
        <section className="panel span-2">
          <div className="panel-heading">
            <h2>Recent conversations</h2>
          </div>
          {requestRows(
            [...requests]
              .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
              .slice(0, 3),
            (r) => {
              switchTab(r.kind === "job" ? "requests" : "connections");
              open({ type: "thread", request: r }, { root: true });
            },
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="profile-layout">
      <aside className="profile-side">
        <section className="side-card">
          <Avatar person={user} size="xl" />
          <h1>{user.name}</h1>
          <p>
            {alum
              ? `${user.title}${user.company ? ` at ${user.company}` : ""}`
              : [user.program, "USC"].filter(Boolean).join(" · ")}
          </p>
          <span className="side-location">
            <MapPin size={13} />
            {user.location || "Add your location"}
          </span>
          <div className="side-actions">
            {(canEditProfile || !alum) && (
              <Button
                variant="secondary"
                onClick={() => {
                  setActive("overview");
                  open({ type: "profile" });
                }}
              >
                <Pencil size={15} />
                {canEditProfile ? "Edit" : "Resume"}
              </Button>
            )}
            {!alum && (
              <Button
                onClick={() => {
                  setActive("overview");
                  open({ type: "resume" });
                }}
              >
                <UploadCloud size={16} />
                Upload
              </Button>
            )}
          </div>
        </section>
        <nav className="side-nav" aria-label="Profile sections">
          {tabs.map(({ id, label, count, Icon }) => (
            <button
              key={id}
              className={active === id ? "active" : ""}
              aria-current={active === id ? "page" : undefined}
              onClick={() => switchTab(id)}
            >
              <Icon size={17} />
              {label}
              {count !== null && <span>{count}</span>}
            </button>
          ))}
        </nav>
      </aside>
      <div className="profile-content">
        {active === "overview" ? (
          overview()
        ) : active === "posts" ? (
          <Split
            className="inbox-split"
            paneKey={paneKey}
            pane={pane}
            empty={
              <PaneEmpty
                icon={<BriefcaseBusiness size={22} />}
                title="Select a post"
              />
            }
            list={
              <>
                <div className="chip-row">
                  <Button onClick={() => open({ type: "post" })}>
                    <Plus size={16} />
                    Post a job
                  </Button>
                </div>
                <div className="row-list">
                  {myPosts.map((j) => {
                    const count = jobs.filter((r) => r.jobId === j.id).length;
                    const selected =
                      (modal?.type === "job" || modal?.type === "post") &&
                      modal.job?.id === j.id;
                    return (
                      <div
                        className={`list-row post-list-row ${selected ? "active" : ""}`}
                        key={j.id}
                      >
                        <button
                          className="list-row-hit"
                          aria-current={selected || undefined}
                          onClick={() => open({ type: "job", job: j }, { root: true })}
                        >
                          <Logo company={j.company} color={j.color} />
                          <span className="list-row-main">
                            <span className="list-row-top">
                              <strong>{j.title}</strong>
                            </span>
                            <span className="list-row-sub">
                              {j.company} · {j.location}
                            </span>
                            <span className="list-row-meta">
                              <Status status={j.status} />
                            </span>
                          </span>
                        </button>
                        <button
                          className="count-link"
                          onClick={() => switchTab("requests", j.id)}
                          aria-label={`${count} requests for ${j.title}`}
                        >
                          {count}
                          <Inbox size={14} />
                        </button>
                      </div>
                    );
                  })}
                  {!myPosts.length && (
                    <Empty
                      title="No job posts yet"
                      description="Share an opening and let students know how you can help."
                    />
                  )}
                </div>
              </>
            }
          />
        ) : (
          inbox(active === "requests" ? "job" : "connection")
        )}
      </div>
    </div>
  );
}
