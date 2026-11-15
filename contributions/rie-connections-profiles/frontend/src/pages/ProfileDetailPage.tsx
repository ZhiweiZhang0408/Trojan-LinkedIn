import { useState } from 'react';
import { CoffeeChatModal } from '../components/CoffeeChatModal';
import { ConnectButton } from '../components/ConnectButton';
import { MessageGenerator } from '../components/MessageGenerator';
import { Avatar, Button, ErrorNote, Loading, Panel, Tag } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { navigate, useRoute } from '../hooks/useRouter';
import { useToast } from '../hooks/useToast';
import { openBlob } from './MyProfilePage';
import { api } from '../services/api';

function LinkRow({ label, href }: { label: string; href: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-canvas">
      <span className="font-medium">{label}</span>
      <span className="truncate pl-3 text-xs text-stone">{href.replace(/^https?:\/\//, '')}</span>
    </a>
  );
}

export function ProfileDetailPage({ id }: { id: number }) {
  const { user } = useAuth();
  const route = useRoute();
  const toast = useToast();
  const profile = useAsync(() => api.profile(id), [id]);
  const ai = useAsync(() => api.aiStatus(), []);
  const [composeOpen, setComposeOpen] = useState(route.query.get('compose') === '1');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');

  if (profile.loading) return <Loading label="Loading profile" />;
  if (profile.error || !profile.data) return <ErrorNote message={profile.error ?? 'Profile not found'} />;
  const p = profile.data;
  const a = p.alumni;
  const s = p.student;
  const skills = (a?.skills ?? s?.skills) || [];
  const interests = (a?.career_interests ?? s?.career_interests) || [];
  const canCompose = user?.role === 'student' && p.role === 'alumni' && !p.is_me;
  const canChat = !p.is_me && !(user?.role === 'alumni' && p.role === 'alumni') && (p.role !== 'alumni' || a?.coffee_chat_available);

  return (
    <div className="grid gap-6">
      <a href="#/discover?tab=directory" className="text-sm font-semibold text-cardinal-700 hover:underline">
        Back to the directory
      </a>
      <Panel className="overflow-hidden">
        <div className="h-24 bg-cardinal-800 sm:h-28">
          <div className="h-full w-full bg-[radial-gradient(circle_at_85%_120%,var(--color-gold-400)_0,transparent_45%)] opacity-60" />
        </div>
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <div className="rounded-full ring-4 ring-white">
              <Avatar name={p.full_name} size="lg" />
            </div>
            {!p.is_me && (
              <div className="flex flex-wrap gap-2">
                {(user?.role === 'student' || p.role === 'student') && (
                  <ConnectButton userId={p.user_id} name={p.full_name} status={p.connection_status} connectionId={p.connection_id} size="md" onChange={() => profile.reload()} />
                )}
                {p.can_message && (
                  <Button variant="secondary" onClick={() => navigate(`/messages/${p.user_id}`)}>
                    Message
                  </Button>
                )}
                {canChat && (
                  <Button variant={canCompose ? 'secondary' : 'primary'} onClick={() => { setChatMessage(''); setChatOpen(true); }}>
                    Request coffee chat
                  </Button>
                )}
                {canCompose && (
                  <Button variant="gold" onClick={() => setComposeOpen(true)}>
                    Generate Introduction with AI
                  </Button>
                )}
              </div>
            )}
            {p.is_me && <a href="#/me" className="text-sm font-semibold text-cardinal-700 hover:underline">Edit profile</a>}
          </div>
          <h1 className="mt-4 text-3xl font-bold">{p.full_name}</h1>
          <p className="text-[15px]">{p.headline}</p>
          <p className="mt-1 text-sm text-stone">
            {a ? `${a.usc_degree}${a.graduation_year ? `, ${a.graduation_year}` : ''}` : `${s?.degree_program ?? ''} ${s?.major ?? ''}`}
            {a?.industry ? `. ${a.industry}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {a?.coffee_chat_available && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Open to coffee chats</span>}
            {p.connection_status === 'connected' && <span className="rounded-full bg-cardinal-50 px-2.5 py-1 text-xs font-semibold text-cardinal-800">Connected</span>}
          </div>
        </div>
      </Panel>

      {canCompose && composeOpen && (
        <Panel className="border-gold-300 p-6 shadow-lift">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Introduce yourself to {p.full_name.split(' ')[0]}</h2>
              <p className="mt-1 text-sm text-stone">Get a draft built from your profile and theirs, then make it your own.</p>
            </div>
            <button onClick={() => setComposeOpen(false)} className="text-sm font-semibold text-stone hover:text-ink">
              Close
            </button>
          </div>
          <MessageGenerator
            alumniId={p.user_id}
            alumniName={p.full_name}
            llmConfigured={Boolean(ai.data?.llm_configured)}
            onUse={(m) => {
              setChatMessage(m);
              setChatOpen(true);
            }}
          />
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-6">
          {(a?.bio || s?.bio) && (
            <Panel className="p-6">
              <h2 className="text-lg font-bold">About</h2>
              <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed">{a?.bio || s?.bio}</p>
            </Panel>
          )}
          {s?.experience && (
            <Panel className="p-6">
              <h2 className="text-lg font-bold">Experience</h2>
              <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed">{s.experience}</p>
            </Panel>
          )}
          {a?.experience && (
            <Panel className="p-6">
              <h2 className="text-lg font-bold">Experience</h2>
              <div className="mt-3 border-l-2 border-gold-400 pl-4">
                <p className="font-semibold">{a.current_title}</p>
                <p className="text-sm text-stone">{a.current_company}</p>
                <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed">{a.experience}</p>
              </div>
            </Panel>
          )}
          {s && s.target_roles.length > 0 && (
            <Panel className="p-6">
              <h2 className="text-lg font-bold">Looking for</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">{s.target_roles.map((r) => <Tag key={r}>{r}</Tag>)}</div>
            </Panel>
          )}
        </div>
        <div className="grid content-start gap-6">
          <Panel className="p-5">
            <h2 className="text-base font-bold">Skills</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">{skills.length ? skills.map((x) => <Tag key={x}>{x}</Tag>) : <span className="text-sm text-stone">None listed</span>}</div>
            <h2 className="mt-5 text-base font-bold">Career interests</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">{interests.length ? interests.map((x) => <Tag key={x}>{x}</Tag>) : <span className="text-sm text-stone">None listed</span>}</div>
          </Panel>
          <Panel className="p-5">
            <h2 className="mb-2 text-base font-bold">Contact and links</h2>
            {p.email ? (
              <a href={`mailto:${p.email}`} className="block px-2 py-1.5 text-sm font-medium text-cardinal-700 hover:underline">{p.email}</a>
            ) : (
              <p className="px-2 py-1.5 text-xs text-stone">Email is shared once you're connected or have a confirmed coffee chat.</p>
            )}
            <LinkRow label="LinkedIn" href={(a?.linkedin_url ?? s?.linkedin_url) || ''} />
            {p.resume && (
              <button
                onClick={async () => {
                  try {
                    openBlob(await api.downloadResume(p.user_id), p.resume!.filename);
                  } catch (e) {
                    toast((e as Error).message, 'error');
                  }
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas"
              >
                <span className="font-medium">Resume (PDF)</span>
                <span className="truncate pl-3 text-xs text-stone">{p.resume.filename}</span>
              </button>
            )}
            {s && <LinkRow label="Resume link" href={s.resume_url} />}
            {s && !p.resume && !p.is_me && !s.resume_url && (
              <p className="px-2 py-1.5 text-xs text-stone">No resume shared with you.</p>
            )}
            {s && <LinkRow label="Portfolio" href={s.portfolio_url} />}
          </Panel>
        </div>
      </div>

      <CoffeeChatModal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        recipient={{ id: p.user_id, name: p.full_name }}
        initialMessage={chatMessage}
      />
    </div>
  );
}
