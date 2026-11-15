import { useEffect, useState } from "react";
import { Coffee, MousePointerClick, Search } from "lucide-react";
import type { Board } from "../useBoard";
import type { ModalState } from "../types";
import { Avatar, Button, Empty, PaneEmpty, Split } from "../components/ui";
import { PaneView, inPane, modalKey } from "../components/Dialogs";

export function Connections({
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
  const [q, setQ] = useState(""),
    [coffee, setCoffee] = useState(false),
    [company, setCompany] = useState("");
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
  useEffect(() => {
    if (
      !modal &&
      filtered[0] &&
      window.matchMedia("(min-width: 901px)").matches
    )
      open({ type: "person", person: filtered[0] }, { root: true });
  }, []);
  const selectedId =
    modal?.type === "person" || modal?.type === "connect"
      ? modal.person.id
      : modal?.type === "thread"
        ? modal.request.alumniId
        : undefined;
  return (
    <>
      <section className="workspace-header">
        <div>
          <h1>Connections</h1>
          <span className="count-pill">{filtered.length}</span>
        </div>
        {b.user?.role === "alumni" && (
          <Button variant="secondary" onClick={() => open({ type: "profile" })}>
            Edit availability
          </Button>
        )}
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
          <Coffee size={16} />
          Coffee chats
        </label>
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
            title="Select an alum"
          />
        }
        list={
          <div className="row-list">
            {filtered.map((p) => {
              const active = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  className={`list-row ${active ? "active" : ""}`}
                  aria-current={active || undefined}
                  onClick={() => open({ type: "person", person: p }, { root: true })}
                >
                  <Avatar person={p} />
                  <span className="list-row-main">
                    <span className="list-row-top">
                      <strong>{p.name}</strong>
                      {p.coffeeChats && (
                        <Coffee
                          size={14}
                          className="row-icon"
                          aria-label="Open to coffee chats"
                        />
                      )}
                    </span>
                    <span className="list-row-sub">
                      {p.title} · {p.company}
                    </span>
                    <span className="list-row-meta">
                      <span
                        className={`availability ${p.openToConnect ? "available" : ""}`}
                      >
                        <span />
                        {p.openToConnect ? "Open" : "Unavailable"}
                      </span>
                      {p.skills.slice(0, 2).map((s) => (
                        <span className="mini-tag" key={s}>
                          {s}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
            {!filtered.length && (
              <Empty
                title="No matching alumni"
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
          </div>
        }
      />
    </>
  );
}
