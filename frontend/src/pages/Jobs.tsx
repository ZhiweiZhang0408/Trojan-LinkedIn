import { useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Clock3,
  GraduationCap,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import type { Board } from "../useBoard";
import type { ModalState } from "../types";
import { Avatar, Button, Empty, Logo } from "../components/ui";
import { isExpired, timeAgo } from "../lib/utils";
export function Jobs({
  board: b,
  open,
}: {
  board: Board;
  open: (m: ModalState) => void;
}) {
  const [query, setQuery] = useState(""),
    [location, setLocation] = useState(""),
    [type, setType] = useState(""),
    [referrals, setReferrals] = useState(false);
  const isAlum = b.user?.role === "alumni";
  const jobs = useMemo(
    () =>
      b.state.jobs
        .filter((j) => j.status === "open" && !isExpired(j.deadline))
        .filter(
          (j) =>
            (!query ||
              `${j.title} ${j.company} ${j.team} ${j.requirements} ${j.description}`
                .toLowerCase()
                .includes(query.toLowerCase())) &&
            (!location ||
              j.location.includes(location) ||
              j.workMode === location) &&
            (!type || j.type === type) &&
            (!referrals || j.referralAvailable),
        ),
    [b.state.jobs, query, location, type, referrals],
  );
  const activeCount = b.state.jobs.filter(
    (j) => j.status === "open" && !isExpired(j.deadline),
  ).length;
  const alumni = b.state.people.filter((p) => p.role === "alumni");
  const progress = [
    !!b.user?.program,
    !!b.user?.skills.length,
    !!b.user?.experience,
    b.state.resumes.some((r) => r.ownerId === b.user?.id),
  ].filter(Boolean).length;
  return (
    <>
      <section className="page-hero">
        <div>
          <p className="eyebrow">
            <span /> TROJANS HELPING TROJANS
          </p>
          <h1>
            Find your next opportunity.
            <br />
            <span>Meet the Trojan behind it.</span>
          </h1>
          <p className="hero-description">
            Alumni-shared roles. Real conversations. A familiar connection.
          </p>
        </div>
        <div className="hero-note">
          <div className="avatar-stack">
            {alumni.slice(0, 3).map((p) => (
              <Avatar key={p.id} person={p} />
            ))}
          </div>
          <strong>
            A shared beginning.
            <br />
            An open door.
          </strong>
          <span>Connect with the Trojan community.</span>
        </div>
      </section>
      <div className="workspace-grid">
        <section className="results-panel">
          <div className="section-heading">
            <div className="section-tabs">
              <span className="section-tab active">
                All opportunities <b>{activeCount}</b>
              </span>
            </div>
            {isAlum && (
              <Button onClick={() => open({ type: "post" })}>
                <Plus size={16} />
                Post a job
              </Button>
            )}
          </div>
          <div className="search-bar">
            <Search size={19} />
            <input
              aria-label="Search jobs"
              placeholder="Role, company, or skill"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="clear-search"
                aria-label="Clear job search"
              >
                ×
              </button>
            )}
            <span className="search-key">Search</span>
          </div>
          <div className="filters">
            <div className="select-wrap">
              <MapPin size={15} />
              <select
                aria-label="Job location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">All locations</option>
                <option>Los Angeles</option>
                <option>San Francisco</option>
                <option>Remote</option>
              </select>
            </div>
            <div className="select-wrap">
              <BriefcaseBusiness size={15} />
              <select
                aria-label="Opportunity type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">All job types</option>
                <option>Internship</option>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
              </select>
            </div>
            <label className={`filter-toggle ${referrals ? "selected" : ""}`}>
              <input
                type="checkbox"
                checked={referrals}
                onChange={(e) => setReferrals(e.target.checked)}
              />
              <span className="checkbox-box">
                {referrals && <Check size={11} />}
              </span>
              Open to referrals
            </label>
          </div>
          <div className="results-heading">
            <span>
              {b.loading
                ? "Loading opportunities…"
                : `${jobs.length} ${jobs.length === 1 ? "opportunity" : "opportunities"}`}
            </span>
            <span>
              <SlidersHorizontal size={13} />
              Newest first
            </span>
          </div>
          <div className="job-grid">
            {jobs.map((job) => {
              const alum = b.state.people.find((p) => p.id === job.alumniId);
              return (
                <article className="job-card" key={job.id}>
                  <div className="job-card-top">
                    <Logo company={job.company} color={job.color} />
                    <div>
                      <span className="company-name">{job.company}</span>
                      <span className="team-name">
                        {job.team || job.industry}
                      </span>
                    </div>
                    <span className="posted-time">
                      {timeAgo(job.createdAt)}
                    </span>
                  </div>
                  <h2>
                    <button onClick={() => open({ type: "job", job })}>
                      {job.title}
                    </button>
                  </h2>
                  <div className="job-meta">
                    <span>
                      <MapPin size={13} />
                      {job.location}
                    </span>
                    <span>{job.workMode}</span>
                  </div>
                  <div className="tags">
                    <span className="tag">{job.type}</span>
                    {job.referralAvailable ? (
                      <span className="tag referral">
                        <span className="tiny-dot" />
                        Referral available
                      </span>
                    ) : (
                      <span className="tag">Ask the alum</span>
                    )}
                  </div>
                  <p className="job-description">{job.description}</p>
                  <div className="job-card-bottom">
                    <button
                      className="person-mini"
                      onClick={() =>
                        alum && open({ type: "person", person: alum })
                      }
                    >
                      <Avatar person={alum} size="sm" />
                      <span>
                        <strong>{alum?.name || "Alumni contact"}</strong>
                        <small>
                          {alum?.program
                            ? `USC ’${String(alum.year).slice(-2)}`
                            : "USC community"}
                        </small>
                      </span>
                    </button>
                    <button
                      className="card-arrow"
                      aria-label={`View ${job.title} at ${job.company}`}
                      onClick={() => open({ type: "job", job })}
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {!b.loading && !jobs.length && (
            <Empty
              title="A fresh search might open a door."
              description="Try another role, company, or location, or clear your filters."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setLocation("");
                    setType("");
                    setReferrals(false);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )}
        </section>
        <aside className="right-rail">
          <div className="rail-card profile-nudge">
            <div className="rail-eyebrow">
              <GraduationCap size={18} />
              {isAlum ? "YOUR TROJAN IMPACT" : "YOUR NEXT CHAPTER"}
            </div>
            <h2>
              {isAlum
                ? "Open a door for a Trojan."
                : "Put your best foot forward."}
            </h2>
            <p>
              {isAlum
                ? "A little context and a shared opening can make a meaningful connection."
                : "A thoughtful profile helps alumni understand your story."}
            </p>
            {!isAlum && (
              <>
                <div className="progress-track">
                  <span style={{ width: `${progress * 25}%` }} />
                </div>
                <div className="progress-caption">
                  {b.user
                    ? `${progress} of 4 essentials ready`
                    : "Start with your background"}
                </div>
              </>
            )}
            <Button
              variant="secondary"
              onClick={() =>
                b.user
                  ? open(isAlum ? { type: "post" } : { type: "profile" })
                  : open({ type: "login" })
              }
            >
              {isAlum ? "Share an opportunity" : "Edit your profile"}
              <ArrowRight size={15} />
            </Button>
          </div>
          <div className="rail-card steps-card">
            <h3>A connection makes a difference.</h3>
            <div className="step">
              <span>01</span>
              <div>
                <strong>Find your fit</strong>
                <p>Explore roles shared by alumni.</p>
              </div>
            </div>
            <div className="step">
              <span>02</span>
              <div>
                <strong>Make it personal</strong>
                <p>Share your experience and a short note.</p>
              </div>
            </div>
            <div className="step">
              <span>03</span>
              <div>
                <strong>Start a conversation</strong>
                <p>Connect with the person behind the role.</p>
              </div>
            </div>
          </div>
          <div className="community-note">
            <UsersRound size={20} />
            <p>
              One community.
              <br />
              <strong>Plenty of possibilities.</strong>
            </p>
            <ChevronRight size={16} />
          </div>
          <p className="rail-fineprint">
            A student-built hackathon prototype.
            <br />
            {b.settings.mode === "demo"
              ? "Profiles and opportunities are fictional."
              : "Connected to your configured backend."}
          </p>
        </aside>
      </div>
      <div className="bottom-note">
        <Clock3 size={14} />A referral starts a conversation. Hiring decisions
        belong to each company.
      </div>
    </>
  );
}
