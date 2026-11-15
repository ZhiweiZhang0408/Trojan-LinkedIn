import { useState } from 'react';
import { StatusBadge } from '../components/StatusBadge';
import { Avatar, Button, EmptyState, ErrorNote, Loading, PageHeader, Tabs } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../hooks/useToast';
import { api } from '../services/api';
import type { CoffeeChat } from '../services/types';

type Tab = 'incoming' | 'confirmed' | 'sent' | 'past';

export function formatWhen(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    month: d.toLocaleDateString(undefined, { month: 'short' }),
    date: d.getDate(),
  };
}

export function CoffeeChatsPage() {
  const toast = useToast();
  const chats = useAsync(() => api.coffeeChats(), []);
  const [busyId, setBusyId] = useState<number | null>(null);
  const all = chats.data?.items ?? [];
  const groups: Record<Tab, CoffeeChat[]> = {
    incoming: all.filter((c) => c.status === 'pending' && c.direction === 'incoming'),
    confirmed: all.filter((c) => c.status === 'accepted'),
    sent: all.filter((c) => c.status === 'pending' && c.direction === 'outgoing'),
    past: all.filter((c) => c.status === 'declined' || c.status === 'cancelled'),
  };
  const [tab, setTab] = useState<Tab | null>(null);
  const current: Tab = tab ?? (groups.incoming.length ? 'incoming' : 'confirmed');

  const act = async (chat: CoffeeChat, action: 'accept' | 'decline' | 'cancel') => {
    setBusyId(chat.id);
    try {
      const updated = await api.updateCoffeeChat(chat.id, action);
      chats.setData((prev) => prev && { ...prev, items: prev.items.map((c) => (c.id === chat.id ? updated : c)) });
      toast(action === 'accept' ? 'Coffee chat confirmed' : action === 'decline' ? 'Request declined' : 'Coffee chat cancelled', action === 'accept' ? 'success' : 'info');
      if (action === 'accept') setTab('confirmed');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader title="Coffee chats" intro="Requests you've sent and received. Once a chat is confirmed, use Messages to agree on where to meet." />
      <Tabs<Tab>
        value={current}
        onChange={setTab}
        options={[
          { value: 'incoming', label: 'Needs your reply', count: groups.incoming.length },
          { value: 'confirmed', label: 'Confirmed', count: groups.confirmed.length },
          { value: 'sent', label: 'Sent', count: groups.sent.length },
          { value: 'past', label: 'Declined and cancelled', count: groups.past.length },
        ]}
      />
      {chats.loading && <Loading />}
      {chats.error && <ErrorNote message={chats.error} />}
      {!chats.loading && !chats.error && (
        groups[current].length === 0 ? (
          <EmptyState
            title={current === 'incoming' ? 'No requests waiting for you' : current === 'confirmed' ? 'No confirmed chats yet' : current === 'sent' ? 'No pending requests' : 'Nothing here'}
            body={current === 'confirmed' || current === 'sent' ? 'Find an alum on Discover and request a coffee chat.' : undefined}
            action={current === 'confirmed' || current === 'sent' ? <a href="#/discover" className="text-sm font-semibold text-cardinal-700 hover:underline">Go to Discover</a> : undefined}
          />
        ) : (
          <ul className="grid gap-4">
            {groups[current].map((c) => {
              const other = c.direction === 'incoming' ? c.requester : c.recipient;
              const when = formatWhen(c.proposed_time);
              return (
                <li key={c.id} className="grid gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-[72px_1fr_auto]">
                  <div className={`flex h-[72px] w-[72px] flex-col items-center justify-center rounded-lg ${c.status === 'accepted' ? 'bg-cardinal-600 text-white' : 'bg-canvas text-ink'}`}>
                    <span className="text-xs font-semibold">{when.month}</span>
                    <span className="font-display text-2xl font-bold leading-none">{when.date}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Avatar name={other.full_name} size="sm" />
                      <a href={`#/profiles/${other.id}`} className="font-semibold hover:text-cardinal-700">{other.full_name}</a>
                      <StatusBadge status={c.status} incoming={c.direction === 'incoming'} />
                    </div>
                    <p className="mt-1 text-sm text-stone">{other.headline}</p>
                    <p className="mt-1 text-sm font-medium">
                      {when.day} at {when.time}, {c.duration_minutes} min
                    </p>
                    {c.message && (
                      <details className="mt-3 group">
                        <summary className="cursor-pointer text-sm font-semibold text-cardinal-700">
                          {c.direction === 'incoming' ? 'Read their message' : 'Your message'}
                        </summary>
                        <p className="mt-2 max-w-prose whitespace-pre-line rounded-lg bg-canvas p-3 text-sm leading-relaxed">{c.message}</p>
                      </details>
                    )}
                    {c.response_note && <p className="mt-2 text-sm italic text-stone">Note: {c.response_note}</p>}
                  </div>
                  <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-stretch">
                    {c.status === 'pending' && c.direction === 'incoming' && (
                      <>
                        <Button size="sm" busy={busyId === c.id} onClick={() => act(c, 'accept')}>Accept</Button>
                        <Button size="sm" variant="secondary" disabled={busyId === c.id} onClick={() => act(c, 'decline')}>Decline</Button>
                      </>
                    )}
                    {c.status === 'pending' && c.direction === 'outgoing' && (
                      <Button size="sm" variant="danger" busy={busyId === c.id} onClick={() => act(c, 'cancel')}>Cancel request</Button>
                    )}
                    {c.status === 'accepted' && (
                      <>
                        <a href={`#/messages/${other.id}`} className="inline-flex h-8 items-center justify-center rounded-md bg-cardinal-600 px-3 text-sm font-semibold text-white hover:bg-cardinal-700">
                          Message
                        </a>
                        <Button size="sm" variant="danger" busy={busyId === c.id} onClick={() => act(c, 'cancel')}>Cancel chat</Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}
