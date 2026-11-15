import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Avatar, Button, EmptyState, ErrorNote, Loading, PageHeader } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { navigate } from '../hooks/useRouter';
import { useToast } from '../hooks/useToast';
import { api } from '../services/api';
import type { Conversation, Inbox, UserBrief } from '../services/types';

function shortTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Re-runs `fn` every `ms` while the tab is visible. */
function usePoll(fn: () => void, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const id = window.setInterval(() => document.visibilityState === 'visible' && ref.current(), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

export function MessagesPage({ otherId }: { otherId: number | null }) {
  const inbox = useAsync<Inbox>(() => api.inbox(), []);
  useEffect(() => {
    // Let the nav badge know read state may have changed.
    if (inbox.data) window.dispatchEvent(new Event('trojanlink:messages'));
  }, [inbox.data]);
  usePoll(inbox.reload, 15000);

  // People you can message but haven't yet: accepted connections + confirmed coffee chats.
  const contacts = useAsync(async () => {
    const [conns, chats] = await Promise.all([api.connections('accepted'), api.coffeeChats({ status: 'accepted' })]);
    const people = new Map<number, UserBrief>();
    conns.items.forEach((c) => {
      const o = c.direction === 'incoming' ? c.requester : c.addressee;
      people.set(o.id, o);
    });
    chats.items.forEach((c) => {
      const o = c.direction === 'incoming' ? c.requester : c.recipient;
      people.set(o.id, o);
    });
    return [...people.values()];
  }, []);

  const threads = inbox.data?.items ?? [];
  const threadIds = useMemo(() => new Set(threads.map((t) => t.other.id)), [threads]);
  const newContacts = (contacts.data ?? []).filter((p) => !threadIds.has(p.id));

  return (
    <div>
      <PageHeader title="Messages" intro="Messaging opens once you're connected or have a confirmed coffee chat. Messages stay inside TrojanLink." />
      <div className="grid min-h-[60vh] grid-cols-1 overflow-hidden rounded-xl border border-line bg-white md:grid-cols-[300px_1fr] [&>*]:min-w-0">
        <aside className={`border-line md:border-r ${otherId ? 'hidden md:block' : ''}`} aria-label="Conversations">
          {inbox.loading && !inbox.data && <div className="px-4"><Loading /></div>}
          {inbox.error && <div className="p-4"><ErrorNote message={inbox.error} /></div>}
          <ul>
            {threads.map((t) => (
              <li key={t.other.id}>
                <a
                  href={`#/messages/${t.other.id}`}
                  aria-current={otherId === t.other.id ? 'true' : undefined}
                  className={`flex gap-3 border-b border-line px-4 py-3 hover:bg-canvas ${otherId === t.other.id ? 'bg-cardinal-50' : ''}`}
                >
                  <Avatar name={t.other.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${t.unread_count ? 'font-bold' : 'font-semibold'}`}>{t.other.full_name}</span>
                      {t.last_message && <span className="shrink-0 text-xs text-stone">{shortTime(t.last_message.created_at)}</span>}
                    </div>
                    <p className={`truncate text-sm ${t.unread_count ? 'text-ink' : 'text-stone'}`}>
                      {t.last_message?.is_mine ? 'You: ' : ''}
                      {t.last_message?.body}
                    </p>
                  </div>
                  {t.unread_count > 0 && (
                    <span className="mt-1 h-5 min-w-5 rounded-full bg-cardinal-600 px-1.5 text-center text-xs font-bold leading-5 text-white">
                      {t.unread_count}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
          {newContacts.length > 0 && (
            <div className="p-4">
              <h2 className="text-sm font-semibold text-stone">Start a conversation</h2>
              <ul className="mt-2 grid gap-1">
                {newContacts.map((p) => (
                  <li key={p.id}>
                    <a href={`#/messages/${p.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-canvas">
                      <Avatar name={p.full_name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.full_name}</span>
                        <span className="block truncate text-xs text-stone">{p.headline}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!inbox.loading && threads.length === 0 && newContacts.length === 0 && (
            <div className="p-4">
              <EmptyState title="No conversations yet" body="Connect with someone or get a coffee chat confirmed to start messaging." />
            </div>
          )}
        </aside>

        <section className={otherId ? 'flex min-h-[60vh] flex-col' : 'hidden items-center justify-center p-8 text-center text-sm text-stone md:flex'}>
          {otherId ? (
            <ConversationPane key={otherId} otherId={otherId} onSent={inbox.reload} />
          ) : (
            <p>Pick a conversation to read it.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function ConversationPane({ otherId, onSent }: { otherId: number; onSent: () => void }) {
  const toast = useToast();
  const convo = useAsync<Conversation>(() => api.conversation(otherId), [otherId]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  usePoll(convo.reload, 8000);

  const count = convo.data?.items.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [count]);
  // Opening a thread marks it read, so refresh the inbox badges once loaded.
  useEffect(() => {
    if (convo.data) onSent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo.data?.total]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const m = await api.sendMessage(otherId, body);
      convo.setData((prev) => prev && { ...prev, items: [...prev.items, m], total: prev.total + 1 });
      setDraft('');
      onSent();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (convo.loading && !convo.data) return <div className="p-6"><Loading /></div>;
  if (convo.error || !convo.data) return <div className="p-6"><ErrorNote message={convo.error ?? 'Could not load messages'} /></div>;
  const c = convo.data;

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-5 py-3">
        <button onClick={() => navigate('/messages')} className="rounded-md px-1 text-sm font-semibold text-cardinal-700 md:hidden" aria-label="Back to conversations">
          Back
        </button>
        <Avatar name={c.other.full_name} size="sm" />
        <div className="min-w-0">
          <a href={`#/profiles/${c.other.id}`} className="block truncate font-semibold hover:text-cardinal-700">{c.other.full_name}</a>
          <p className="truncate text-xs text-stone">{c.other.headline}</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-canvas/60 px-5 py-4" aria-live="polite">
        {c.items.length === 0 && (
          <p className="py-10 text-center text-sm text-stone">
            {c.can_message ? `Say hello to ${c.other.full_name.split(' ')[0]}.` : 'No messages yet.'}
          </p>
        )}
        {c.items.map((m) => (
          <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.is_mine ? 'rounded-br-md bg-cardinal-600 text-white' : 'rounded-bl-md border border-line bg-white'}`}>
              <p className="whitespace-pre-line break-words">{m.body}</p>
              <p className={`mt-1 text-right text-[11px] ${m.is_mine ? 'text-cardinal-100' : 'text-stone'}`}>
                {shortTime(m.created_at)}
                {m.is_mine && m.read_at ? ', seen' : ''}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {c.can_message ? (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
          <label htmlFor="msg-input" className="sr-only">Message</label>
          <textarea
            id="msg-input"
            rows={2}
            maxLength={4000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Write a message. Enter sends, Shift+Enter adds a line."
            className="flex-1 resize-none rounded-md border border-line px-3 py-2 text-sm focus:border-cardinal-500 focus:outline-none focus:ring-2 focus:ring-cardinal-100"
          />
          <Button type="submit" busy={sending} disabled={!draft.trim()}>Send</Button>
        </form>
      ) : (
        <p className="border-t border-line px-5 py-4 text-sm text-stone">{c.reason}</p>
      )}
    </>
  );
}
