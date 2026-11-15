import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export const PaneContext = createContext(false);
import {
  ArrowUpRight,
  X,
  LoaderCircle,
  CheckCircle2,
  CircleAlert,
  FileText,
} from "lucide-react";
import type { Person, RequestStatus } from "../types";
import { initials } from "../lib/utils";
export function Button({
  children,
  variant = "primary",
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant} ${props.className || ""}`}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Avatar({
  person,
  size = "md",
}: {
  person?: Pick<Person, "name" | "color">;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  return (
    <span
      aria-hidden="true"
      className={`avatar ${size} ${person?.color || "sand"}`}
    >
      {initials(person?.name || "?")}
    </span>
  );
}
export function Logo({
  company,
  color = "blue",
  large = false,
}: {
  company: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`company-logo ${color} ${large ? "large" : ""}`}
    >
      {company.slice(0, 1)}
    </span>
  );
}
export function Status({ status }: { status: RequestStatus | string }) {
  const label: Record<string, string> = {
    pending: "Pending",
    interested: "Interested",
    accepted: "Connected",
    declined: "Declined",
    closed: "Closed",
    withdrawn: "Withdrawn",
    open: "Open",
    filled: "Filled",
  };
  return (
    <span className={`status ${status}`}>
      <span />
      {label[status] || status}
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <FileText size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Dialog({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const inline = useContext(PaneContext);
  if (inline)
    return (
      <section className="pane" aria-labelledby="pane-title">
        <header className="pane-header">
          <div>
            <h2 id="pane-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close panel"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    );
  return (
    <ModalDialog
      title={title}
      description={description}
      onClose={onClose}
      wide={wide}
    >
      {children}
    </ModalDialog>
  );
}
function ModalDialog({
  title,
  description,
  children,
  onClose,
  wide,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d.close();
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-inner">
        <header className="dialog-header">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function ErrorBox({
  message,
  children,
}: {
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="error-box" role="alert">
      <CircleAlert size={17} />
      <span>{message}</span>
      {children}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <CheckCircle2 size={17} />
      <span>{children}</span>
    </div>
  );
}
export function External({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a className="text-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={15} />
    </a>
  );
}
export function Field({
  label,
  children,
  hint,
  full = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  full?: boolean;
}) {
  return (
    <label className={`field ${full ? "full" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Split({
  list,
  pane,
  paneKey,
  empty,
  className = "",
}: {
  list: ReactNode;
  pane: ReactNode;
  paneKey?: string;
  empty?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    if (pane && window.matchMedia("(max-width: 900px)").matches)
      window.scrollTo({ top: 0 });
  }, [paneKey, pane]);
  return (
    <div className={`split ${pane ? "has-pane" : ""} ${className}`}>
      <div className="split-list">{list}</div>
      <div className="split-pane" ref={ref}>
        {pane || empty}
      </div>
    </div>
  );
}
export function PaneEmpty({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="pane-empty">
      <span className="empty-icon">{icon}</span>
      <p>{title}</p>
    </div>
  );
}
