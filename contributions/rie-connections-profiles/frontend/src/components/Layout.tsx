import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { navigate } from '../hooks/useRouter';
import { Avatar } from './ui';

const NAV = [
  { href: '/discover', label: 'Discover', icon: 'M9 3a6 6 0 1 0 3.9 10.6l3.8 3.7 1.4-1.4-3.7-3.8A6 6 0 0 0 9 3zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z' },
  { href: '/connections', label: 'Connections', icon: 'M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM1 17c0-3 2.7-5 6-5s6 2 6 5H1zm12.5 0c0-1.9-.7-3.5-1.9-4.6.4-.1.9-.4 1.4-.4 3.3 0 6 2 6 5h-5.5z' },
  { href: '/coffee-chats', label: 'Coffee Chats', icon: 'M3 6h11v5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V6zm11 1h1.5a2.5 2.5 0 0 1 0 5H14v-1.6h1.5a.9.9 0 0 0 0-1.8H14V7zM2 17.5h14V19H2z' },
  { href: '/messages', label: 'Messages', icon: 'M3 4h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H8l-4 3v-3H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm2 4v1.5h10V8zm0 3v1.5h7V11z' },
  { href: '/me', label: 'My Profile', icon: 'M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8c0-3.3 3.1-6 7-6s7 2.7 7 6H3z' },
];

function Mark() {
  return (
    <a href="#/dashboard" className="flex items-center gap-2.5" aria-label="TrojanLink AI home">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--color-gold-400)" />
        <path d="M9 10h14M16 10v13" stroke="var(--color-cardinal-800)" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="23" cy="22" r="3" fill="var(--color-cardinal-800)" />
      </svg>
      <span className="font-display text-lg font-bold leading-none text-white">
        TrojanLink <span className="font-semibold text-gold-300">AI</span>
      </span>
    </a>
  );
}

export function Layout({ current, children }: { current: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // On navigation: update the tab title and move focus to the new page (screen readers announce it).
  useEffect(() => {
    const label = NAV.find((n) => n.href === current)?.label ?? (current === '/profiles' ? 'Profile' : 'Dashboard');
    document.title = `${label} | TrojanLink AI`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setMenuOpen(false);
    mainRef.current?.focus({ preventScroll: true });
  }, [current]);

  // Light polling for the Messages badge; refreshes on navigation too.
  useEffect(() => {
    if (!user) return;
    const load = () => api.unreadCount().then((r) => setUnread(r.unread)).catch(() => undefined);
    load();
    const id = window.setInterval(() => document.visibilityState === 'visible' && load(), 20000);
    window.addEventListener('trojanlink:messages', load);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('trojanlink:messages', load);
    };
  }, [user, current]);

  if (!user) return <>{children}</>;

  const links = (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map((n) => {
        const active = current === n.href;
        return (
          <a
            key={n.href}
            href={`#${n.href}`}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${
              active ? 'bg-white text-cardinal-800' : 'text-cardinal-100 hover:bg-cardinal-700 hover:text-white'
            }`}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d={n.icon} />
            </svg>
            <span className="flex-1">{n.label}</span>
            {n.href === '/messages' && unread > 0 && (
              <span className="rounded-full bg-gold-400 px-2 text-xs font-bold leading-5 text-ink" aria-label={`${unread} unread`}>
                {unread}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );

  const account = (
    <div className="flex items-center gap-3 rounded-lg bg-cardinal-900/40 p-3">
      <Avatar name={user.full_name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{user.full_name}</p>
        <p className="text-xs text-cardinal-200">
          {user.role === 'student' ? 'Student' : 'Alumni'}
          {user.is_demo && <span className="ml-1.5 rounded bg-cardinal-700 px-1 py-px text-[10px] text-gold-300">demo</span>}
        </p>
      </div>
      <button
        onClick={() => {
          logout();
          navigate('/login');
        }}
        className="rounded-md px-2 py-1 text-xs font-semibold text-gold-300 hover:bg-cardinal-700"
      >
        Log out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}
        className="sr-only z-50 rounded-md bg-gold-400 px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen flex-col gap-8 bg-cardinal-800 px-4 py-6 lg:flex">
        <div className="px-2">
          <Mark />
        </div>
        {links}
        <div className="mt-auto">{account}</div>
      </aside>

      <header className="sticky top-0 z-30 bg-cardinal-800 px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between">
          <Mark />
          <button onClick={() => setMenuOpen((o) => !o)} className="rounded-md p-2 text-white hover:bg-cardinal-700" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
            <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div id="mobile-menu" className="mt-3 flex flex-col gap-4 pb-2">
            {links}
            {account}
          </div>
        )}
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl focus:outline-none px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
