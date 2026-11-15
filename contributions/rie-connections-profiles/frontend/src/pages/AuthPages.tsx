import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button, ErrorNote, Field, Input } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { navigate } from '../hooks/useRouter';
import type { Role } from '../services/types';

const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || '';
const DEMO_ACCOUNTS = [
  { label: 'Student', name: 'Alex Chen', detail: 'Computer Science, Class of 2027', email: 'alex.chen@student.example.com' },
  { label: 'Alumni', name: 'Sarah Kim', detail: 'Senior Software Engineer, Brightline Cloud', email: 'sarah.kim@alumni.example.com' },
];

function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} | TrojanLink AI`;
  }, [title]);
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-cardinal-800 p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden>
            <rect width="32" height="32" rx="8" fill="var(--color-gold-400)" />
            <path d="M9 10h14M16 10v13" stroke="var(--color-cardinal-800)" strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="23" cy="22" r="3" fill="var(--color-cardinal-800)" />
          </svg>
          <span className="font-display text-xl font-bold">TrojanLink AI</span>
        </div>
        <div className="my-auto max-w-xl">
          <p className="font-display text-6xl font-extrabold leading-[0.95] tracking-tight text-white xl:text-7xl">
            Your USC Network.
            <span className="block text-gold-400">Your Next Opportunity.</span>
          </p>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-cardinal-100">
            Find alumni who already do the work you want to do. See why they're a good fit, draft a thoughtful first message, and set up a coffee chat.
          </p>
        </div>
        <svg className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] opacity-25" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-gold-400)" strokeWidth="5" strokeDasharray="207 277" strokeLinecap="round" transform="rotate(135 50 50)" />
        </svg>
        <p className="text-sm text-cardinal-200">A hackathon prototype for the USC community. Not an official USC service.</p>
      </div>
      <div className="flex flex-col items-center justify-center bg-white px-6 py-10">
        <div className="mb-8 w-full max-w-sm rounded-xl bg-cardinal-800 px-5 py-4 text-white lg:hidden">
          <p className="font-display text-lg font-bold">TrojanLink AI</p>
          <p className="text-sm text-cardinal-100">Your USC Network. Your Next Opportunity.</p>
        </div>
        <main className="w-full max-w-sm">{children}</main>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Log in">
      <h1 className="text-3xl font-bold">Log in</h1>
      <p className="mt-1 text-sm text-stone">
        New here?{' '}
        <a href="#/register" className="font-semibold text-cardinal-700 hover:underline">
          Create an account
        </a>
      </p>
      <form onSubmit={submit} className="mt-8 grid gap-4">
        <Field label="Email" htmlFor="login-email">
          <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <Button type="submit" busy={busy} className="mt-2 w-full">
          Log in
        </Button>
      </form>

      <section className="mt-10 rounded-xl border border-line bg-canvas p-4" aria-labelledby="demo-heading">
        <h2 id="demo-heading" className="font-display text-base font-semibold">
          Try a demo account
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-stone">
          These are fictional people for local development only. No real student or alumni data is used.
          {!DEMO_PASSWORD && ' Use the DEMO_USER_PASSWORD from backend/.env.'}
        </p>
        <div className="mt-3 grid gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => {
                setEmail(a.email);
                if (DEMO_PASSWORD) setPassword(DEMO_PASSWORD);
              }}
              className="rounded-lg border border-line bg-white px-3 py-2.5 text-left hover:border-cardinal-200"
            >
              <span className="block text-sm font-semibold">
                {a.name} <span className="font-normal text-stone">({a.label})</span>
              </span>
              <span className="block text-xs text-stone">{a.detail}</span>
            </button>
          ))}
        </div>
      </section>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'student' as Role });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/me?welcome=1');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create account">
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-stone">
        Already have one?{' '}
        <a href="#/login" className="font-semibold text-cardinal-700 hover:underline">
          Log in
        </a>
      </p>
      <form onSubmit={submit} className="mt-8 grid gap-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">I am a</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['student', 'alumni'] as Role[]).map((r) => (
              <label
                key={r}
                className={`cursor-pointer rounded-lg border px-3 py-3 text-sm font-semibold ${
                  form.role === r ? 'border-cardinal-600 bg-cardinal-50 text-cardinal-800' : 'border-line hover:border-cardinal-200'
                }`}
              >
                <input type="radio" name="role" value={r} checked={form.role === r} onChange={set('role')} className="sr-only" />
                {r === 'student' ? 'Current student' : 'USC alum'}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Full name" htmlFor="reg-name">
          <Input id="reg-name" required minLength={2} value={form.full_name} onChange={set('full_name')} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="reg-email">
          <Input id="reg-email" type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
        </Field>
        <Field label="Password" htmlFor="reg-password" hint="At least 8 characters.">
          <Input id="reg-password" type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        {error && <ErrorNote message={error} />}
        <Button type="submit" busy={busy} className="mt-2 w-full">
          Create account
        </Button>
        <p className="text-xs leading-relaxed text-stone">
          Accounts are self-reported. TrojanLink does not verify USC enrollment or alumni status in this prototype.
        </p>
      </form>
    </AuthShell>
  );
}
