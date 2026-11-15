import { useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Settings2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useBoard } from "./useBoard";
import type { ModalState, Tab } from "./types";
import { Avatar, Button } from "./components/ui";
import { Dialogs, modalKey } from "./components/Dialogs";
import { Auth, type AuthPage } from "./pages/Auth";
import { Jobs } from "./pages/Jobs";
import { Connections } from "./pages/Connections";
import { Profile } from "./pages/Profile";

type Route = Tab | AuthPage;
type Pane = NonNullable<ModalState>;
const forms = new Set<Pane["type"]>([
  "compose",
  "resume",
  "tailor",
  "connect",
  "post",
  "profile",
]);
const authRoutes = ["signin", "signup", "verify"] as const;
function isAuth(route: Route): route is AuthPage {
  return authRoutes.some((value) => value === route);
}
function readRoute(): Route {
  const route = location.hash.slice(1).split("/")[0];
  return ["jobs", "connections", "profile", ...authRoutes].includes(route)
    ? (route as Route)
    : "jobs";
}

export default function App() {
  const board = useBoard();
  const [route, setRoute] = useState<Route>(readRoute);
  const [nav, setNav] = useState<{ modal: ModalState; back: Pane[] }>({
    modal: null,
    back: [],
  });
  const navRef = useRef(nav);
  navRef.current = nav;
  const modal = nav.modal;
  const setModal = (next: ModalState) => {
    navRef.current = { modal: next, back: [] };
    setNav(navRef.current);
  };
  const [afterSignIn, setAfterSignIn] = useState<Tab>("jobs");

  useEffect(() => {
    const change = () => {
      setRoute(readRoute());
      setModal(null);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);

  function navigate(next: Route) {
    setRoute(next);
    if (location.hash !== `#${next}`) location.hash = next;
    setModal(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function startSignIn() {
    setAfterSignIn(isAuth(route) ? "jobs" : route);
    navigate("signin");
  }

  // Pane history: Cancel and close return to the previous view.
  function closeModal() {
    const { back } = navRef.current;
    const next = { modal: back[back.length - 1] || null, back: back.slice(0, -1) };
    navRef.current = next;
    setNav(next);
  }
  function open(next: ModalState, options?: { root?: boolean }) {
    if (next?.type === "login") return startSignIn();
    if (!next) return setModal(null);
    const current = navRef.current;
    let back =
      options?.root || !current.modal ? [] : [...current.back, current.modal];
    // Leaving a form for a view (for example after sending) drops the form.
    if (!forms.has(next.type)) back = back.filter((m) => !forms.has(m.type));
    const key = modalKey(next);
    const seen = back.findIndex((m) => modalKey(m) === key);
    if (seen >= 0) back = back.slice(0, seen);
    navRef.current = { modal: next, back };
    setNav(navRef.current);
  }

  const authPage = isAuth(route);
  const showWorkspaceSettings =
    new URLSearchParams(location.search).get("workspace") === "settings";
  const demo = board.settings.mode === "demo";
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <button
            className="wordmark"
            onClick={() => navigate("jobs")}
            aria-label="Trojan Board home"
          >
            <span className="brand-symbol" aria-hidden="true">
              T
            </span>
            <span>
              Trojan <span className="brand-light">Board</span>
            </span>
          </button>
          {!authPage && (
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
                  className={route === id ? "active" : ""}
                  aria-current={route === id ? "page" : undefined}
                  onClick={() => navigate(id)}
                >
                  <Icon size={17} />
                  {label}
                </button>
              ))}
            </nav>
          )}
          <div className="header-actions">
            {!authPage && board.user && (
              <>
                {!demo && (
                  <button
                    className="icon-button"
                    aria-label="Refresh data"
                    title="Refresh data"
                    disabled={board.loading}
                    onClick={() => void board.refresh()}
                  >
                    <RefreshCw
                      size={17}
                      className={board.loading ? "spin" : ""}
                    />
                  </button>
                )}
                <button
                  className="account-button"
                  onClick={() => navigate("profile")}
                  aria-label={`View profile for ${board.user.name}`}
                >
                  <Avatar person={board.user} size="sm" />
                  <span>{board.user.name.split(" ")[0]}</span>
                </button>
                <button
                  className="icon-button"
                  title="Sign out"
                  aria-label="Sign out"
                  onClick={() => {
                    board.signOut();
                    navigate("jobs");
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            )}
            {showWorkspaceSettings && (
              <button
                className="icon-button settings-button"
                title="Workspace settings"
                aria-label="Workspace settings"
                onClick={() => open({ type: "settings" })}
              >
                <Settings2 size={18} />
              </button>
            )}
            {!authPage && !board.user && (
              <Button variant="secondary" onClick={startSignIn}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={authPage ? "auth-main" : "main-container"}
      >
        {authPage ? (
          <Auth
            board={board}
            page={route}
            navigate={navigate}
            onSuccess={() => navigate(afterSignIn)}
            onBack={() => navigate("jobs")}
          />
        ) : !board.ready ? (
          <div className="app-loading">
            <LoaderCircle className="spin" />
            Loading…
          </div>
        ) : route === "jobs" ? (
          <Jobs board={board} modal={modal} open={open} close={closeModal} />
        ) : route === "connections" ? (
          <Connections
            board={board}
            modal={modal}
            open={open}
            close={closeModal}
          />
        ) : (
          <Profile
            key={board.user?.id || "guest"}
            board={board}
            modal={modal}
            open={open}
            close={closeModal}
          />
        )}
      </main>
      {modal?.type === "settings" && (
        <Dialogs board={board} modal={modal} open={open} close={closeModal} />
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
