import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-cardinal-600 text-white hover:bg-cardinal-700 disabled:bg-cardinal-100 disabled:text-cardinal-700',
  gold: 'bg-gold-400 text-ink hover:bg-gold-300 disabled:opacity-50',
  secondary: 'border border-line bg-white text-ink hover:border-cardinal-200 hover:bg-cardinal-50 disabled:opacity-50',
  ghost: 'text-cardinal-700 hover:bg-cardinal-50 disabled:opacity-50',
  danger: 'border border-cardinal-200 bg-white text-cardinal-700 hover:bg-cardinal-50 disabled:opacity-50',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  busy,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; busy?: boolean }) {
  const sz = size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm';
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed ${sz} ${variants[variant]} ${className}`}
      disabled={busy || rest.disabled}
      {...rest}
    >
      {busy && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-stone">{hint}</p>}
      {error && <p className="text-xs font-medium text-cardinal-700">{error}</p>}
    </div>
  );
}

const control =
  'w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-stone/70 focus:border-cardinal-500 focus:outline-none focus:ring-2 focus:ring-cardinal-100';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-10 ${control} ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`py-2 leading-relaxed ${control} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-10 ${control} ${props.className ?? ''}`} />;
}

export function Tag({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'shared' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        tone === 'shared' ? 'bg-gold-100 text-gold-600 ring-1 ring-gold-200' : 'bg-canvas text-stone'
      }`}
    >
      {children}
    </span>
  );
}

const avatarTones = ['bg-cardinal-600 text-white', 'bg-gold-400 text-ink', 'bg-cardinal-800 text-gold-300', 'bg-ink text-gold-300'];

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const tone = avatarTones[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarTones.length];
  const sz = size === 'lg' ? 'h-20 w-20 text-2xl' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-12 w-12 text-base';
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${sz} ${tone}`}>
      {initials}
    </span>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-white ${className}`}>{children}</section>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-stone">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-md border border-cardinal-200 bg-cardinal-50 px-3 py-2 text-sm text-cardinal-800">
      {message}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-stone" role="status">
      <Spinner /> {label}
    </div>
  );
}

export function PageHeader({ title, intro, actions }: { title: string; intro?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{title}</h1>
        {intro && <p className="mt-2 text-[15px] leading-relaxed text-stone">{intro}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div
      role="tablist"
      className="mb-5 flex flex-wrap gap-1 border-b border-line"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
        e.preventDefault();
        const i = options.findIndex((o) => o.value === value);
        const n = options.length;
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
        const list = e.currentTarget; // capture now: React clears currentTarget after the handler
        onChange(options[next].value);
        requestAnimationFrame(() => list.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus());
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
            value === o.value ? 'border-cardinal-600 text-cardinal-700' : 'border-transparent text-stone hover:text-ink'
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 rounded-full bg-canvas px-1.5 text-xs text-stone">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
