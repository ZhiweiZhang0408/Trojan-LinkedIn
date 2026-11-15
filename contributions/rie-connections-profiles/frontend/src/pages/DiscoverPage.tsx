import { useState, type FormEvent } from 'react';
import { AlumniCardView } from '../components/AlumniCardView';
import { CoffeeChatModal } from '../components/CoffeeChatModal';
import { ConnectButton } from '../components/ConnectButton';
import { ScoreBreakdownBars, ScoreRing } from '../components/ScoreRing';
import { CAREER_INTERESTS } from '../components/TagInput';
import { Avatar, Button, EmptyState, ErrorNote, Field, Input, Loading, PageHeader, Tabs, Tag } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { navigate, useRoute } from '../hooks/useRouter';
import { api } from '../services/api';
import type { Recommendation, RecommendResponse } from '../services/types';

type Tab = 'recommended' | 'directory';

export function DiscoverPage() {
  const { user } = useAuth();
  const route = useRoute();
  const isStudent = user?.role === 'student';
  const tab: Tab = isStudent && route.query.get('tab') !== 'directory' ? 'recommended' : 'directory';
  const [chatWith, setChatWith] = useState<{ id: number; name: string } | null>(null);

  return (
    <div>
      <PageHeader
        title="Discover"
        intro={isStudent ? 'Alumni whose work lines up with your goals, plus the full directory to search.' : 'Browse the USC alumni community.'}
      />
      {isStudent && (
        <Tabs<Tab>
          value={tab}
          onChange={(v) => navigate(v === 'directory' ? '/discover?tab=directory' : '/discover')}
          options={[
            { value: 'recommended', label: 'Recommended for you' },
            { value: 'directory', label: 'Alumni directory' },
          ]}
        />
      )}
      {tab === 'recommended' ? <Recommendations onChat={setChatWith} /> : <Directory onChat={setChatWith} />}
      <CoffeeChatModal open={Boolean(chatWith)} recipient={chatWith} onClose={() => setChatWith(null)} />
    </div>
  );
}

function Recommendations({ onChat }: { onChat: (r: { id: number; name: string }) => void }) {
  const profile = useAsync(() => api.myProfile(), []);
  const [focus, setFocus] = useState<string[] | null>(null);
  const recs = useAsync<RecommendResponse>(
    () => api.recommend(focus ? { career_interests: focus, limit: 8 } : { limit: 8 }),
    [JSON.stringify(focus)],
  );

  const saved = profile.data?.student?.career_interests ?? [];
  const active = focus ?? saved;
  const toggle = (interest: string) => {
    const next = active.includes(interest) ? active.filter((i) => i !== interest) : [...active, interest];
    setFocus(next);
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Matching on</h2>
          <a href="#/me" className="text-sm font-semibold text-cardinal-700 hover:underline">
            Edit goals and skills in your profile
          </a>
        </div>
        <p className="mt-1 text-sm text-stone">Pick career interests to explore. Your saved profile stays the same.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CAREER_INTERESTS.map((i) => {
            const on = active.includes(i);
            return (
              <button
                key={i}
                onClick={() => toggle(i)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  on ? 'border-cardinal-600 bg-cardinal-600 text-white' : 'border-line bg-white text-stone hover:border-cardinal-200 hover:text-ink'
                }`}
              >
                {i}
              </button>
            );
          })}
        </div>
        {profile.data?.student?.skills?.length ? (
          <p className="mt-3 text-xs text-stone">Also using your skills: {profile.data.student.skills.join(', ')}</p>
        ) : null}
      </div>

      {recs.loading && <Loading label="Finding alumni for you" />}
      {recs.error && (
        <EmptyState
          title="Add a goal to get recommendations"
          body={recs.error}
          action={<Button onClick={() => navigate('/me')}>Complete your profile</Button>}
        />
      )}
      {recs.data && !recs.loading && (
        <>
          {recs.data.items.length === 0 ? (
            <EmptyState title="No strong matches yet" body="Try another career interest or add more skills to your profile." />
          ) : (
            <div className="grid gap-5">
              {recs.data.items.map((r, idx) => (
                <RecommendationCard key={r.alumni.user_id} rec={r} weights={recs.data!.weights} lead={idx === 0} onChat={onChat} />
              ))}
            </div>
          )}
          <p className="text-xs leading-relaxed text-stone">{recs.data.disclaimer}</p>
        </>
      )}
    </div>
  );
}

function RecommendationCard({ rec, weights, lead, onChat }: {
  rec: Recommendation;
  weights: RecommendResponse['weights'];
  lead: boolean;
  onChat: (r: { id: number; name: string }) => void;
}) {
  const a = rec.alumni;
  return (
    <article className={`grid gap-6 rounded-xl border bg-white p-6 md:grid-cols-[1fr_260px] ${lead ? 'border-gold-300 shadow-lift' : 'border-line'}`}>
      <div className="min-w-0">
        <div className="flex items-start gap-4">
          <Avatar name={a.full_name} />
          <div className="min-w-0">
            <a href={`#/profiles/${a.user_id}`} className="font-display text-xl font-semibold hover:text-cardinal-700">
              {a.full_name}
            </a>
            <p className="text-sm">
              {a.current_title} <span className="text-stone">at {a.current_company}</span>
            </p>
            <p className="text-xs text-stone">
              {a.industry}, USC {a.graduation_year}
            </p>
          </div>
        </div>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed">{rec.explanation}</p>
        {(rec.shared_interests.length > 0 || rec.shared_skills.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[...rec.shared_interests, ...rec.shared_skills].map((s) => (
              <Tag key={s} tone="shared">
                {s}
              </Tag>
            ))}
          </div>
        )}
        {rec.conversation_topics.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">Things you could ask about</h3>
            <ul className="mt-2 grid gap-1 text-sm text-stone">
              {rec.conversation_topics.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cardinal-500" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate(`/profiles/${a.user_id}?compose=1`)}>
            Write an introduction
          </Button>
          {a.coffee_chat_available && (
            <Button size="sm" variant="secondary" onClick={() => onChat({ id: a.user_id, name: a.full_name })}>
              Coffee chat
            </Button>
          )}
          <ConnectButton userId={a.user_id} name={a.full_name} status={a.connection_status} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-4 rounded-lg bg-canvas p-4 md:items-stretch">
        <div className="flex justify-center">
          <ScoreRing score={rec.match_score} size={104} />
        </div>
        <ScoreBreakdownBars breakdown={rec.breakdown} weights={weights} />
      </div>
    </article>
  );
}

function Directory({ onChat }: { onChat: (r: { id: number; name: string }) => void }) {
  const empty = { q: '', company: '', industry: '', title: '', skill: '', interest: '', degree: '', graduation_year: '' };
  const [draft, setDraft] = useState(empty);
  const [filters, setFilters] = useState(empty);
  const [coffeeOnly, setCoffeeOnly] = useState(false);
  const list = useAsync(() => api.alumni({ ...filters, coffee_chat_only: coffeeOnly || undefined }), [JSON.stringify(filters), coffeeOnly]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFilters(draft);
  };
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <div className="grid gap-6">
      <form onSubmit={submit} className="grid gap-4 rounded-xl border border-line bg-white p-5" role="search">
        <div className="flex gap-2">
          <Input aria-label="Search alumni" placeholder="Search by name, company, title or skill" value={draft.q} onChange={set('q')} />
          <Button type="submit">Search</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Company" htmlFor="f-company"><Input id="f-company" value={draft.company} onChange={set('company')} /></Field>
          <Field label="Industry" htmlFor="f-industry"><Input id="f-industry" value={draft.industry} onChange={set('industry')} /></Field>
          <Field label="Job title" htmlFor="f-title"><Input id="f-title" value={draft.title} onChange={set('title')} /></Field>
          <Field label="Skills" htmlFor="f-skill"><Input id="f-skill" placeholder="python, sql" value={draft.skill} onChange={set('skill')} /></Field>
          <Field label="Career interest" htmlFor="f-interest"><Input id="f-interest" value={draft.interest} onChange={set('interest')} /></Field>
          <Field label="USC degree" htmlFor="f-degree"><Input id="f-degree" placeholder="e.g. M.S. or Computer Science" value={draft.degree} onChange={set('degree')} /></Field>
          <Field label="Graduation year" htmlFor="f-year"><Input id="f-year" type="number" min={1950} max={2040} value={draft.graduation_year} onChange={set('graduation_year')} /></Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-cardinal-600" checked={coffeeOnly} onChange={(e) => setCoffeeOnly(e.target.checked)} />
            Only alumni open to coffee chats
          </label>
          <button type="button" className="text-sm font-semibold text-cardinal-700 hover:underline" onClick={() => { setDraft(empty); setFilters(empty); }}>
            Clear filters
          </button>
        </div>
      </form>

      {list.loading && <Loading />}
      {list.error && <ErrorNote message={list.error} />}
      {list.data && !list.loading && (
        <>
          <p className="text-sm text-stone">
            {list.data.total} {list.data.total === 1 ? 'alum' : 'alumni'}
          </p>
          {list.data.items.length === 0 ? (
            <EmptyState title="No alumni match these filters" body="Remove a filter or try a broader search term." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.data.items.map((c) => (
                <AlumniCardView key={c.user_id} card={c} onCoffeeChat={(card) => onChat({ id: card.user_id, name: card.full_name })} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
