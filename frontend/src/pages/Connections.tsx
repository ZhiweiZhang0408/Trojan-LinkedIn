import { useEffect, useState } from "react";
import { ArrowRight, Coffee, MapPin, Search, UsersRound } from "lucide-react";
import type { Board } from "../useBoard";
import type { ModalState } from "../types";
import { Avatar, Button, Empty } from "../components/ui";
import { errorText } from "../lib/utils";
export function Connections({
  board: b,
  open,
}: {
  board: Board;
  open: (m: ModalState) => void;
}) {
  const [q, setQ] = useState(""),
    [coffee, setCoffee] = useState(false),
    [company, setCompany] = useState("");
  useEffect(() => {
    b.loadAlumni().catch((e) => b.notify(errorText(e), true));
  }, [b.settings.mode]);
  const people = b.state.people.filter(
    (p) => p.role === "alumni" && p.id !== b.user?.id,
  );
  const filtered = people.filter(
    (p) =>
      (!q ||
        `${p.name} ${p.title} ${p.company} ${p.skills.join(" ")}`
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (!coffee || p.coffeeChats) &&
      (!company || p.company === company),
  );
  return (
    <>
      <section className="page-hero compact">
        <div>
          <p className="eyebrow">
            <span /> A SHARED CONNECTION
          </p>
          <h1>
            Good conversations.
            <br />
            <span>Great places to start.</span>
          </h1>
          <p className="hero-description">
            Meet alumni who are open to sharing what they’ve learned.
          </p>
        </div>
        <div className="hero-symbol">
          <UsersRound size={40} strokeWidth={1.2} />
        </div>
      </section>
      <div className="directory-toolbar">
        <div className="search-bar">
          <Search size={18} />
          <input
            aria-label="Search alumni"
            placeholder="Name, company, role, or expertise"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          aria-label="Alumni company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        >
          <option value="">All companies</option>
          {[...new Set(people.map((p) => p.company).filter(Boolean))].map(
            (c) => (
              <option key={c}>{c}</option>
            ),
          )}
        </select>
        <label className="coffee-filter">
          <input
            type="checkbox"
            checked={coffee}
            onChange={(e) => setCoffee(e.target.checked)}
          />
          <Coffee size={17} />
          Open to coffee chats
        </label>
      </div>
      {b.user?.role === "alumni" && (
        <div className="availability-banner">
          <div>
            <strong>Your time, your terms.</strong>
            <span>Let students know how you’d like to connect.</span>
          </div>
          <Button variant="secondary" onClick={() => open({ type: "profile" })}>
            Edit availability
            <ArrowRight size={15} />
          </Button>
        </div>
      )}
      <div className="results-heading">
        <span>{filtered.length} alumni to get to know</span>
        <span>USC community</span>
      </div>
      <div className="people-grid">
        {filtered.map((p) => {
          const request = b.state.requests.find(
            (r) =>
              r.kind === "connection" &&
              r.studentId === b.user?.id &&
              r.alumniId === p.id,
          );
          return (
            <article className="person-card" key={p.id}>
              <div className="person-card-top">
                <Avatar person={p} size="lg" />
                {p.coffeeChats && (
                  <span className="coffee-tag">
                    <Coffee size={13} />
                    Coffee chats
                  </span>
                )}
              </div>
              <h2>{p.name}</h2>
              <p className="person-position">
                {p.title} <span>at</span> {p.company}
              </p>
              <p className="person-school">
                {p.program} · USC ’{String(p.year).slice(-2)}
              </p>
              <p className="person-location">
                <MapPin size={13} />
                {p.location || "Location not listed"}
              </p>
              <p className="person-bio">
                {p.bio ||
                  "Open their profile to learn more about their background."}
              </p>
              <div className="tags">
                {p.skills.slice(0, 3).map((s) => (
                  <span className="tag" key={s}>
                    {s}
                  </span>
                ))}
              </div>
              <div className="person-card-bottom">
                <span
                  className={`availability ${p.openToConnect ? "available" : ""}`}
                >
                  <span />
                  {p.openToConnect
                    ? "Open to connecting"
                    : "Not taking requests"}
                </span>
                <button
                  className="text-link"
                  onClick={() => open({ type: "person", person: p })}
                >
                  {request ? "View connection" : "View profile"}
                  <ArrowRight size={15} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <Empty
          title="Let’s try a different connection."
          description="Search another company or expertise, or reset your filters."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQ("");
                setCoffee(false);
                setCompany("");
              }}
            >
              Reset filters
            </Button>
          }
        />
      )}
    </>
  );
}
