import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Coffee,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Plus,
  UploadCloud,
} from "lucide-react";
import type { Board } from "../useBoard";
import type { ModalState, RequestItem } from "../types";
import { Avatar, Button, Empty, Logo, Status } from "../components/ui";
import { readableDate } from "../lib/utils";
export function Profile({
  board: b,
  open,
}: {
  board: Board;
  open: (m: ModalState) => void;
}) {
  const [active, setActive] = useState("overview");
  if (!b.user)
    return (
      <Empty
        title="Your Trojan story starts here."
        description="Sign in to edit your profile, manage your materials, and follow your conversations."
        action={
          <Button onClick={() => open({ type: "login" })}>Sign in</Button>
        }
      />
    );
  const user = b.user,
    alum = user.role === "alumni";
  const requests = b.state.requests.filter(
    (r) => r.studentId === user.id || r.alumniId === user.id,
  );
  const jobs = requests.filter((r) => r.kind === "job"),
    connections = requests.filter((r) => r.kind === "connection");
  const myPosts = b.state.jobs.filter((j) => j.alumniId === user.id),
    resumes = b.state.resumes.filter((r) => r.ownerId === user.id);
  const tabs = [
    { id: "overview", label: "Overview", count: null },
    ...(alum
      ? [{ id: "posts", label: "My posts", count: myPosts.length }]
      : []),
    {
      id: "requests",
      label: alum ? "Job requests" : "My job requests",
      count: jobs.length,
    },
    {
      id: "connections",
      label: alum ? "Connection requests" : "My connections",
      count: connections.length,
    },
  ];
  function RequestList({ items }: { items: RequestItem[] }) {
    return (
      <div className="request-list">
        {items.map((r) => {
          const other = b.state.people.find(
              (p) =>
                p.id === (r.studentId === user.id ? r.alumniId : r.studentId),
            ),
            job = b.state.jobs.find((j) => j.id === r.jobId);
          return (
            <button
              className="request-row"
              key={r.id}
              onClick={() => open({ type: "thread", request: r })}
            >
              <Avatar person={other} />
              <div>
                <strong>{other?.name || "Community member"}</strong>
                <span>
                  {r.kind === "job"
                    ? `${job?.title || r.jobTitle || "Job request"} · ${job?.company || r.jobCompany || ""}`
                    : r.purpose === "coffee"
                      ? "Coffee chat invitation"
                      : "Connection invitation"}
                </span>
                <small>{readableDate(r.createdAt)}</small>
              </div>
              <Status status={r.status} />
              <ArrowRight size={17} />
            </button>
          );
        })}
        {!items.length && (
          <Empty
            title={
              alum
                ? "Your next conversation is on its way."
                : "Your conversations will live here."
            }
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
  return (
    <>
      <section className="profile-header">
        <Avatar person={user} size="xl" />
        <div className="profile-heading">
          <p className="eyebrow">YOUR TROJAN PROFILE</p>
          <h1>{user.name}</h1>
          <p>
            {alum
              ? `${user.title}${user.company ? ` at ${user.company}` : ""}`
              : `${user.program} · USC ${user.year}`}
          </p>
          <span>
            <MapPin size={13} />
            {user.location || "Add your location"}
          </span>
        </div>
        <div className="profile-actions">
          <Button variant="secondary" onClick={() => open({ type: "profile" })}>
            <Pencil size={15} />
            Edit profile
          </Button>
          {!alum && (
            <Button onClick={() => open({ type: "resume" })}>
              <UploadCloud size={16} />
              Upload resume
            </Button>
          )}
        </div>
      </section>
      <div className="profile-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={active === t.id ? "active" : ""}
            onClick={() => setActive(t.id)}
          >
            {t.label}
            {t.count !== null && <span>{t.count}</span>}
          </button>
        ))}
      </div>
      {active === "overview" ? (
        <div className="profile-grid">
          <div className="profile-main">
            <section className="panel">
              <div className="panel-heading">
                <h2>About</h2>
                <button
                  className="icon-button"
                  aria-label="Edit about"
                  onClick={() => open({ type: "profile" })}
                >
                  <Pencil size={16} />
                </button>
              </div>
              <p className="preserve-lines">
                {user.bio ||
                  "Add a short introduction to help the community get to know you."}
              </p>
            </section>
            {!alum && (
              <>
                <section className="panel">
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
                        {user.projects ||
                          "Share a project you enjoyed working on."}
                      </p>
                    </div>
                  </div>
                </section>
                <section className="panel">
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
                          <FileText size={21} />
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
                            open({ type: "resume", resumeId: r.id })
                          }
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
            {alum && (
              <section className="panel">
                <div className="panel-heading">
                  <h2>Ways to connect</h2>
                  <Coffee size={19} />
                </div>
                <div className="preference-row">
                  <div>
                    <strong>Career conversations</strong>
                    <p>Open to new connections</p>
                  </div>
                  <Status status={user.openToConnect ? "open" : "closed"} />
                </div>
                <div className="preference-row">
                  <div>
                    <strong>Coffee chats</strong>
                    <p>Short conversations with fellow Trojans</p>
                  </div>
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
              <div className="panel-heading">
                <h2>Recent conversations</h2>
              </div>
              <RequestList items={requests.slice(0, 3)} />
            </section>
          </div>
          <aside>
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
                  <small>Shared only in relevant requests.</small>
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
                <p className="muted">
                  Add a few areas you know or want to explore.
                </p>
              )}
            </section>
          </aside>
        </div>
      ) : active === "posts" ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>Open doors, managed here.</h2>
            <Button onClick={() => open({ type: "post" })}>
              <Plus size={16} />
              Post a job
            </Button>
          </div>
          {myPosts.map((j) => (
            <div className="post-row" key={j.id}>
              <Logo company={j.company} color={j.color} />
              <div className="post-row-title">
                <strong>{j.title}</strong>
                <span>
                  {j.company} · {j.location}
                </span>
                <button
                  className="text-link"
                  onClick={() => {
                    setActive("requests");
                  }}
                >
                  {jobs.filter((r) => r.jobId === j.id).length} requests
                  <ArrowRight size={14} />
                </button>
              </div>
              <Status status={j.status} />
              <Button
                variant="secondary"
                onClick={() => open({ type: "post", job: j })}
              >
                Edit
              </Button>
              <button
                className="text-link"
                onClick={() => open({ type: "job", job: j })}
              >
                View
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
          {!myPosts.length && (
            <Empty
              title="Your team’s next Trojan could start here."
              description="Share an opening and let students know how you can help."
              action={
                <Button onClick={() => open({ type: "post" })}>
                  Post a job
                </Button>
              }
            />
          )}
        </section>
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <h2>
              {active === "requests"
                ? alum
                  ? "Received job requests"
                  : "My job requests"
                : alum
                  ? "Connection invitations"
                  : "My connections"}
            </h2>
          </div>
          <RequestList items={active === "requests" ? jobs : connections} />
        </section>
      )}
    </>
  );
}
