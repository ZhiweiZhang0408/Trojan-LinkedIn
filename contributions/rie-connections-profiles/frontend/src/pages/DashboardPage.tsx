import { ScoreRing } from '../components/ScoreRing';
import { Avatar, Panel } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { formatWhen } from './CoffeeChatsPage';

export function DashboardPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const chats = useAsync(() => api.coffeeChats(), []);
  const inbox = useAsync(() => api.inbox(), []);
  const conns = useAsync(() => api.connections('pending'), []);
  const recs = useAsync(() => (isStudent ? api.recommend({ limit: 3 }) : Promise.resolve(null)), [isStudent]);

  const items = chats.data?.items ?? [];
  const needsReply = items.filter((c) => c.status === 'pending' && c.direction === 'incoming');
  const confirmed = items.filter((c) => c.status === 'accepted' && new Date(c.proposed_time) > new Date(Date.now() - 36e5));
  const first = user?.full_name.split(' ')[0];

  return (
    <div className="grid gap-8 [&>*]:min-w-0">
      <header>
        <h1 className="text-4xl font-bold md:text-5xl">Hi {first}.</h1>
        <p className="mt-2 text-[15px] text-stone">
          {needsReply.length
            ? `${needsReply.length} coffee chat ${needsReply.length === 1 ? 'request needs' : 'requests need'} your reply.`
            : confirmed.length
              ? `You have ${confirmed.length} confirmed coffee ${confirmed.length === 1 ? 'chat' : 'chats'} coming up.`
              : isStudent
                ? 'Here are alumni worth meeting this week.'
                : 'Students can find you in the alumni directory and send you requests.'}
        </p>
      </header>

      {needsReply.length > 0 && (
        <a href="#/coffee-chats" className="flex items-center justify-between rounded-xl bg-gold-400 px-5 py-4 font-semibold text-ink hover:bg-gold-300">
          <span>Reply to {needsReply.length} coffee chat {needsReply.length === 1 ? 'request' : 'requests'}</span>
          <span aria-hidden>{needsReply.slice(0, 3).map((c) => c.requester.full_name.split(' ')[0]).join(', ')}</span>
        </a>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        {isStudent ? (
          <Panel className="p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold">Recommended alumni</h2>
              <a href="#/discover" className="text-sm font-semibold text-cardinal-700 hover:underline">See all</a>
            </div>
            {recs.error && <p className="mt-3 text-sm text-stone">Add career interests on <a href="#/me" className="font-semibold text-cardinal-700 underline">your profile</a> to get recommendations.</p>}
            <ul className="mt-4 grid gap-2">
              {recs.data?.items.map((r) => (
                <li key={r.alumni.user_id} className="min-w-0">
                  <a href={`#/profiles/${r.alumni.user_id}`} className="flex items-center gap-4 rounded-lg p-2 hover:bg-canvas">
                    <ScoreRing score={r.match_score} size={52} label={false} />
                    <div className="min-w-0">
                      <p className="font-semibold">{r.alumni.full_name}</p>
                      <p className="truncate text-sm text-stone">{r.alumni.current_title} at {r.alumni.current_company}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Panel className="p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold">Connection requests</h2>
              <a href="#/connections" className="text-sm font-semibold text-cardinal-700 hover:underline">Connections</a>
            </div>
            <ul className="mt-4 grid gap-3">
              {(conns.data?.items ?? []).filter((c) => c.direction === 'incoming').slice(0, 4).map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <Avatar name={c.requester.full_name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{c.requester.full_name}</p>
                    <p className="truncate text-xs text-stone">{c.requester.headline}</p>
                  </div>
                </li>
              ))}
              {!(conns.data?.items ?? []).some((c) => c.direction === 'incoming') && (
                <li className="text-sm text-stone">No new requests. Students can find you in the alumni directory.</li>
              )}
            </ul>
          </Panel>
        )}

        <Panel className="p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-bold">Confirmed coffee chats</h2>
            <a href="#/coffee-chats" className="text-sm font-semibold text-cardinal-700 hover:underline">All chats</a>
          </div>
          <ul className="mt-4 grid gap-3">
            {confirmed.length ? confirmed.slice(0, 4).map((c) => {
              const o = c.direction === 'incoming' ? c.requester : c.recipient;
              const w = formatWhen(c.proposed_time);
              return (
                <li key={c.id} className="flex items-center gap-3">
                  <Avatar name={o.full_name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{o.full_name}</p>
                    <p className="text-xs text-stone">{w.day} at {w.time}</p>
                  </div>
                </li>
              );
            }) : <li className="text-sm text-stone">None yet. Accepted requests show up here.</li>}
          </ul>
        </Panel>
      </div>

      <Panel className="p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Recent messages</h2>
          <a href="#/messages" className="text-sm font-semibold text-cardinal-700 hover:underline">All messages</a>
        </div>
        <ul className="mt-4 grid gap-1 [&>*]:min-w-0">
          {(inbox.data?.items ?? []).slice(0, 4).map((t) => (
            <li key={t.other.id}>
              <a href={`#/messages/${t.other.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-canvas">
                <Avatar name={t.other.full_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${t.unread_count ? 'font-bold' : 'font-semibold'}`}>{t.other.full_name}</p>
                  <p className="truncate text-sm text-stone">{t.last_message?.is_mine ? 'You: ' : ''}{t.last_message?.body}</p>
                </div>
                {t.unread_count > 0 && <span className="rounded-full bg-cardinal-600 px-2 text-xs font-bold leading-5 text-white">{t.unread_count} new</span>}
              </a>
            </li>
          ))}
          {inbox.data && inbox.data.items.length === 0 && (
            <li className="text-sm text-stone">No messages yet. Messaging opens once you're connected or have a confirmed coffee chat.</li>
          )}
        </ul>
      </Panel>
    </div>
  );
}
