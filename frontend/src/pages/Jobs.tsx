import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  MapPin,
  MousePointerClick,
  Plus,
  Search,
} from "lucide-react";
import type { Board } from "../useBoard";
import type { ModalState } from "../types";
import {
  Avatar,
  Button,
  Empty,
  Logo,
  PaneEmpty,
  Split,
} from "../components/ui";
import { PaneView, inPane, modalKey } from "../components/Dialogs";
import { isExpired, timeAgo } from "../lib/utils";

export function Jobs({
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
  const [query, setQuery] = useState(""),
    [location, setLocation] = useState(""),
    [type, setType] = useState(""),
    [referrals, setReferrals] = useState(false);
  const isAlum = b.user?.role === "alumni";
  const jobs = useMemo(
    () =>
      b.state.jobs
        .filter(
          (j) =>
            j.status === "open" &&
            j.acceptsNewRequests !== false &&
            !isExpired(j.deadline),
        )
        .filter(
          (j) =>
            (!query ||
              `${j.title} ${j.company} ${j.team} ${j.requirements} ${j.description}`
                .toLowerCase()
                .includes(query.toLowerCase())) &&
            (!location || j.location === location || j.workMode === location) &&
            (!type || j.type === type) &&
            (!referrals || j.referralAvailable),
        ),
    [b.state.jobs, query, location, type, referrals],
  );
  useEffect(() => {
    if (!modal && jobs[0] && window.matchMedia("(min-width: 901px)").matches)
      open({ type: "job", job: jobs[0] }, { root: true });
    // Select the first role once when the page opens on a wide screen.
  }, []);
  const locations = [
    ...new Set(b.state.jobs.map((job) => job.location).filter(Boolean)),
  ].sort();
  if (
    b.state.jobs.some((job) => job.workMode === "Remote") &&
    !locations.includes("Remote")
  )
    locations.push("Remote");
  const selectedId =
    modal &&
    (modal.type === "job" || modal.type === "compose" || modal.type === "tailor")
      ? modal.job.id
      : modal?.type === "resume"
        ? modal.job?.id
        : undefined;
  const reset = () => {
    setQuery("");
    setLocation("");
    setType("");
    setReferrals(false);
  };
  return (
    <>
      <section className="workspace-header">
        <div>
          <h1>Job Posts</h1>
          <span className="count-pill">{jobs.length}</span>
        </div>
        {isAlum && (
          <Button onClick={() => open({ type: "post" })}>
            <Plus size={17} /> Post a job
          </Button>
        )}
      </section>
      <div className="job-toolbar">
        <div className="search-bar">
          <Search size={18} />
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
              {locations.map((value) => (
                <option key={value}>{value}</option>
              ))}
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
            Referrals
          </label>
        </div>
      </div>
      <Split
        paneKey={modal ? modalKey(modal) : undefined}
        pane={
          inPane(modal) ? (
            <PaneView board={b} modal={modal} open={open} close={close} />
          ) : null
        }
        empty={
          <PaneEmpty
            icon={<MousePointerClick size={22} />}
            title="Select a role"
          />
        }
        list={
          <div className="row-list" aria-live="polite">
            {jobs.map((job) => {
              const alum = b.state.people.find((p) => p.id === job.alumniId);
              const active = job.id === selectedId;
              return (
                <button
                  key={job.id}
                  className={`list-row job-row ${active ? "active" : ""}`}
                  aria-current={active || undefined}
                  onClick={() => open({ type: "job", job }, { root: true })}
                >
                  <Logo company={job.company} color={job.color} />
                  <span className="list-row-main">
                    <span className="list-row-top">
                      <strong>{job.title}</strong>
                      <small>{timeAgo(job.createdAt)}</small>
                    </span>
                    <span className="list-row-sub">
                      {job.company} · {job.location}
                    </span>
                    <span className="list-row-meta">
                      <span className="mini-tag">{job.type}</span>
                      {job.referralAvailable && (
                        <span className="mini-tag referral">
                          <span className="tiny-dot" />
                          Referral
                        </span>
                      )}
                      <span className="list-row-person">
                        <Avatar person={alum} size="xs" />
                        {alum?.name.split(" ")[0]}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
            {!b.loading && !jobs.length && (
              <Empty
                title="No matching jobs"
                description="Try another keyword or clear your filters."
                action={
                  <Button variant="secondary" onClick={reset}>
                    Clear filters
                  </Button>
                }
              />
            )}
          </div>
        }
      />
    </>
  );
}
