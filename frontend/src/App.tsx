import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  Settings2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useBoard } from "./useBoard";
import type { ModalState, Tab } from "./types";
import { Avatar } from "./components/ui";
import { Dialogs } from "./components/Dialogs";
import { Jobs } from "./pages/Jobs";
import { Connections } from "./pages/Connections";
import { Profile } from "./pages/Profile";
function readTab(): Tab {
  const value = location.hash.slice(1).split("/")[0];
  return ["jobs", "connections", "profile"].includes(value)
    ? (value as Tab)
    : "jobs";
}
export default function App() {
  const board = useBoard(),
    [tab, setTab] = useState<Tab>(readTab),
    [modal, setModal] = useState<ModalState>(null);
  useEffect(() => {
    const change = () => setTab(readTab());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  function navigate(next: Tab) {
    setTab(next);
    location.hash = next;
    setModal(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function identity(id: string) {
    board.switchIdentity(id);
    setModal(null);
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <button
            className="wordmark"
            onClick={() => navigate("jobs")}
            aria-label="Trojan Board home"
          >
            <span className="brand-symbol">T</span>
            <span>
              trojan<span className="brand-light">board</span>
              <small>OPPORTUNITY THROUGH COMMUNITY</small>
            </span>
          </button>
          <nav aria-label="Main navigation">
            {(
              [
                { id: "jobs", label: "Job Posts", Icon: BriefcaseBusiness },
                { id: "connections", label: "Connections", Icon: UsersRound },
                { id: "profile", label: "Profile", Icon: UserRound },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="icon-button settings-button"
              title="Workspace settings"
              aria-label="Workspace settings"
              onClick={() => setModal({ type: "settings" })}
            >
              <Settings2 size={18} />
            </button>
            {board.settings.mode === "demo" ? (
              <label className="identity-selector">
                <Avatar person={board.user} size="sm" />
                <div>
                  <span>{board.user?.name.split(" ")[0] || "Demo"}</span>
                  <small>
                    {board.user?.role === "alumni"
                      ? "Alumni view"
                      : "Student view"}
                  </small>
                </div>
                <ChevronDown size={13} />
                <select
                  aria-label="Demo identity"
                  value={board.activeId}
                  onChange={(e) => identity(e.target.value)}
                >
                  {board.state.people
                    .filter((p) => ["alex", "maya", "jordan"].includes(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.role}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <button
                className="button secondary"
                onClick={() =>
                  setModal(
                    board.user ? { type: "settings" } : { type: "login" },
                  )
                }
              >
                {board.user?.name.split(" ")[0] || "Sign in"}
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="workspace-strip">
        <div>
          <span className="workspace-dot" />
          <span>
            {board.settings.mode === "demo"
              ? "LOCAL DEMO"
              : "CONNECTED WORKSPACE"}
          </span>
          <span className="strip-separator">/</span>
          <span>
            {board.settings.mode === "demo"
              ? "Fictional people. Real interactions. Saved in your browser."
              : "Using your configured backend."}
          </span>
        </div>
        {board.settings.mode === "api" && (
          <button onClick={() => void board.refresh()} disabled={board.loading}>
            <RefreshCw size={12} className={board.loading ? "spin" : ""} />
            Refresh
          </button>
        )}
      </div>
      <main id="main-content" className="main-container">
        {!board.ready ? (
          <div className="app-loading">
            <LoaderCircle className="spin" />
            Opening your workspace…
          </div>
        ) : tab === "jobs" ? (
          <Jobs board={board} open={setModal} />
        ) : tab === "connections" ? (
          <Connections board={board} open={setModal} />
        ) : (
          <Profile
            key={board.user?.id || "guest"}
            board={board}
            open={setModal}
          />
        )}
      </main>
      <footer className="app-footer">
        <span>
          <span className="footer-mark">T</span>Made for the Trojan community.
        </span>
        <span>
          USC hackathon prototype <span>·</span> 2026 <ArrowUpRight size={12} />
        </span>
      </footer>
      {modal && (
        <Dialogs
          key={
            modal.type +
            (modal.type === "thread"
              ? modal.request.id
              : modal.type === "person"
                ? modal.person.id
                : "")
          }
          board={board}
          modal={modal}
          open={setModal}
          close={() => setModal(null)}
        />
      )}
      <div className="toast-region" aria-live="polite">
        {board.toast && (
          <div className={`toast ${board.toast.error ? "error" : ""}`}>
            {board.toast.error ? (
              <CircleAlert size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
            <span>{board.toast.text}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => board.notify("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
