import { useState } from 'react';
import { CoffeeChatModal } from '../components/CoffeeChatModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ConnectButton } from '../components/ConnectButton';
import { Avatar, Button, EmptyState, ErrorNote, Input, Loading, PageHeader, Tabs, Tag } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { navigate, useRoute } from '../hooks/useRouter';
import { useToast } from '../hooks/useToast';
import { api } from '../services/api';
import type { ConnectionRequest } from '../services/types';

type Tab = 'network' | 'requests' | 'students';

export function ConnectionsPage() {
  const toast = useToast();
  const route = useRoute();
  const conns = useAsync(() => api.connections(), []);
  const tabParam = route.query.get('tab');
  const tab: Tab = tabParam === 'requests' || tabParam === 'students' ? tabParam : 'network';
  const setTab = (t: Tab) => navigate(t === 'network' ? '/connections' : `/connections?tab=${t}`);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<ConnectionRequest | null>(null);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const students = useAsync(() => api.students({ q: query }), [query]);
  const [chatWith, setChatWith] = useState<{ id: number; name: string } | null>(null);

  const items = conns.data?.items ?? [];
  const network = items.filter((c) => c.status === 'accepted');
  const incoming = items.filter((c) => c.status === 'pending' && c.direction === 'incoming');
  const outgoing = items.filter((c) => c.status === 'pending' && c.direction === 'outgoing');

  const respond = async (c: ConnectionRequest, action: 'accept' | 'decline' | 'withdraw' | 'remove') => {
    setBusyId(c.id);
    try {
      const updated = await api.respondConnection(c.id, action);
      conns.setData((prev) => prev && { ...prev, items: prev.items.map((x) => (x.id === c.id ? updated : x)) });
      const name = other(c).full_name;
      const messages = {
        accept: `You're now connected with ${name}`,
        decline: 'Request declined',
        withdraw: `Request to ${name} withdrawn`,
        remove: `Removed ${name} from your connections`,
      };
      toast(messages[action], action === 'accept' ? 'success' : 'info');
      setRemoving(null);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const other = (c: ConnectionRequest) => (c.direction === 'incoming' ? c.requester : c.addressee);

  return (
    <div>
      <PageHeader title="Connections" intro="Your network of Trojans, plus students who share your interests." />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'network', label: 'My network', count: network.length },
          { value: 'requests', label: 'Requests', count: incoming.length },
          { value: 'students', label: 'Find students' },
        ]}
      />
      {conns.error && <ErrorNote message={conns.error} />}
      {tab !== 'students' && conns.loading && <Loading />}

      {tab === 'network' && !conns.loading && (
        network.length === 0 ? (
          <EmptyState title="Your network is empty" body="Connect with alumni on Discover or students under Find students." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {network.map((c) => {
              const o = other(c);
              return (
                <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={o.full_name} />
                    <div className="min-w-0">
                      <a href={`#/profiles/${o.id}`} className="font-semibold hover:text-cardinal-700">{o.full_name}</a>
                      <p className="truncate text-sm text-stone">{o.headline}</p>
                      <p className="text-xs text-stone">{o.role === 'alumni' ? 'Alum' : 'Student'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 border-t border-line pt-3">
                    <a href={`#/messages/${o.id}`} className="inline-flex h-8 items-center rounded-md bg-cardinal-600 px-3 text-sm font-semibold text-white hover:bg-cardinal-700">
                      Message
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(c)} aria-label={`Remove ${o.full_name} from connections`}>
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === 'requests' && !conns.loading && (
        <div className="grid gap-6">
          {incoming.length === 0 && outgoing.length === 0 && <EmptyState title="No pending requests" />}
          {incoming.length > 0 && (
            <ul className="grid gap-3">
              {incoming.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start gap-4 rounded-xl border border-line bg-white p-4">
                  <Avatar name={c.requester.full_name} />
                  <div className="min-w-0 flex-1">
                    <a href={`#/profiles/${c.requester.id}`} className="font-semibold hover:text-cardinal-700">{c.requester.full_name}</a>
                    <p className="text-sm text-stone">{c.requester.headline}</p>
                    {c.message && <p className="mt-2 max-w-prose text-sm">{c.message}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" busy={busyId === c.id} onClick={() => respond(c, 'accept')} aria-label={`Accept request from ${c.requester.full_name}`}>Accept</Button>
                    <Button size="sm" variant="secondary" disabled={busyId === c.id} onClick={() => respond(c, 'decline')} aria-label={`Decline request from ${c.requester.full_name}`}>Decline</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {outgoing.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-bold">Sent, waiting for a reply</h2>
              <ul className="grid gap-2">
                {outgoing.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm">
                    <Avatar name={c.addressee.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <a href={`#/profiles/${c.addressee.id}`} className="font-semibold hover:text-cardinal-700">{c.addressee.full_name}</a>
                      <p className="truncate text-stone">{c.addressee.headline}</p>
                    </div>
                    <Button size="sm" variant="secondary" busy={busyId === c.id} onClick={() => respond(c, 'withdraw')} aria-label={`Withdraw request to ${c.addressee.full_name}`}>
                      Withdraw
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'students' && (
        <div className="grid gap-4">
          <form className="flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
            <Input aria-label="Search students" placeholder="Search by name, major, interest or skill" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit">Search</Button>
          </form>
          {students.loading && <Loading />}
          {students.error && <ErrorNote message={students.error} />}
          {students.data && !students.loading && (
            students.data.items.length === 0 ? <EmptyState title="No students match that search" /> : (
              <ul className="grid gap-4 md:grid-cols-2">
                {students.data.items.map((s) => (
                  <li key={s.user_id} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-5">
                    <div className="flex items-start gap-3">
                      <Avatar name={s.full_name} />
                      <div>
                        <a href={`#/profiles/${s.user_id}`} className="font-display text-lg font-semibold hover:text-cardinal-700">{s.full_name}</a>
                        <p className="text-sm text-stone">{s.degree_program} {s.major}{s.graduation_year ? `, ${s.graduation_year}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.career_interests.map((i) => <Tag key={i} tone={s.shared_interests.includes(i) ? 'shared' : 'plain'}>{i}</Tag>)}
                    </div>
                    {(s.shared_interests.length > 0 || s.shared_skills.length > 0) && (
                      <p className="text-xs text-stone">
                        In common: {[...s.shared_interests, ...s.shared_skills].join(', ')}
                      </p>
                    )}
                    <div className="mt-auto flex gap-2 border-t border-line pt-3">
                      <ConnectButton userId={s.user_id} name={s.full_name} status={s.connection_status} onChange={() => conns.reload()} />
                      <Button size="sm" variant="ghost" onClick={() => setChatWith({ id: s.user_id, name: s.full_name })}>Coffee chat</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
      <CoffeeChatModal open={Boolean(chatWith)} recipient={chatWith} onClose={() => setChatWith(null)} />
      <ConfirmDialog
        open={Boolean(removing)}
        title={removing ? `Remove ${other(removing).full_name}?` : ''}
        body="You'll stop sharing email and messaging unless you have a confirmed coffee chat. Past messages stay readable, and you can connect again later."
        confirmLabel="Remove connection"
        cancelLabel="Keep connection"
        busy={Boolean(removing && busyId === removing.id)}
        onConfirm={() => removing && respond(removing, 'remove')}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
