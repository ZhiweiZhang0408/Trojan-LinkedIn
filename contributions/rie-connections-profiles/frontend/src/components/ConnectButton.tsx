import { useState } from 'react';
import { useToast } from '../hooks/useToast';
import { api } from '../services/api';
import type { ConnectionState } from '../services/types';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from './ui';

/**
 * Connect / withdraw / remove control.
 * `connectionId` (from the profile API) enables withdraw and remove. Directory cards
 * don't have it, so they show the state only and link to Connections for changes.
 */
export function ConnectButton({ userId, name, status, connectionId = null, size = 'sm', onChange }: {
  userId: number;
  name: string;
  status: ConnectionState;
  connectionId?: number | null;
  size?: 'sm' | 'md';
  onChange?: (s: ConnectionState) => void;
}) {
  const toast = useToast();
  const [state, setState] = useState<ConnectionState>(status);
  const [connId, setConnId] = useState<number | null>(connectionId);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const update = (s: ConnectionState, id: number | null) => {
    setState(s);
    setConnId(id);
    onChange?.(s);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const connect = () =>
    run(async () => {
      const c = await api.connect(userId);
      update('pending_outgoing', c.id);
      toast(`Connection request sent to ${name}`);
    });
  const withdraw = () =>
    run(async () => {
      await api.respondConnection(connId!, 'withdraw');
      update(null, null);
      toast('Request withdrawn', 'info');
    });
  const remove = () =>
    run(async () => {
      await api.respondConnection(connId!, 'remove');
      update(null, null);
      setConfirmRemove(false);
      toast(`Removed ${name} from your connections`, 'info');
    });

  if (state === 'pending_incoming')
    return (
      <a href="#/connections?tab=requests" className="inline-flex h-8 items-center rounded-md px-3 text-sm font-semibold text-cardinal-700 hover:bg-cardinal-50">
        Respond to request
      </a>
    );

  if (state === 'pending_outgoing')
    return connId ? (
      <Button size={size} variant="secondary" busy={busy} onClick={withdraw} aria-label={`Withdraw connection request to ${name}`}>
        Withdraw request
      </Button>
    ) : (
      <Button size={size} variant="secondary" disabled>Request sent</Button>
    );

  if (state === 'connected')
    return connId ? (
      <>
        <Button size={size} variant="secondary" onClick={() => setConfirmRemove(true)} aria-label={`Connected with ${name}. Remove connection`}>
          Connected
          <span className="text-xs font-normal text-stone">Remove</span>
        </Button>
        <ConfirmDialog
          open={confirmRemove}
          title={`Remove ${name}?`}
          body={`You'll stop sharing email and messaging unless you have a confirmed coffee chat. Past messages stay readable, and you can connect again later.`}
          confirmLabel="Remove connection"
          cancelLabel="Keep connection"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirmRemove(false)}
        />
      </>
    ) : (
      <Button size={size} variant="secondary" disabled>Connected</Button>
    );

  return (
    <Button size={size} variant="secondary" busy={busy} onClick={connect} aria-label={`Connect with ${name}`}>
      Connect
    </Button>
  );
}
