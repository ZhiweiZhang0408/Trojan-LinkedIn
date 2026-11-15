import { useState, type FormEvent } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { Modal } from './Modal';
import { Button, ErrorNote, Field, Input, Select, Textarea } from './ui';

function dateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function CoffeeChatModal({
  open,
  onClose,
  recipient,
  initialMessage = '',
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  recipient: { id: number; name: string } | null;
  initialMessage?: string;
  onSent?: () => void;
}) {
  if (!open || !recipient) return null;
  // Mounted fresh on each open so the form starts from `initialMessage` on the first render.
  return <CoffeeChatForm onClose={onClose} recipient={recipient} initialMessage={initialMessage} onSent={onSent} />;
}

function CoffeeChatForm({
  onClose,
  recipient,
  initialMessage,
  onSent,
}: {
  onClose: () => void;
  recipient: { id: number; name: string };
  initialMessage: string;
  onSent?: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(() => dateString(3));
  const [time, setTime] = useState('15:00');
  const [duration, setDuration] = useState(30);
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.requestCoffeeChat({
        recipient_id: recipient.id,
        proposed_time: `${date}T${time}:00`,
        duration_minutes: duration,
        message,
      });
      toast(`Coffee chat request sent to ${recipient.name}`);
      onSent?.();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Request a coffee chat with ${recipient.name}`} wide>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" htmlFor="cc-date">
            <Input id="cc-date" type="date" required value={date} min={dateString(0)} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Start time" htmlFor="cc-time">
            <Input id="cc-time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Length" htmlFor="cc-dur">
            <Select id="cc-dur" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </Select>
          </Field>
        </div>
        <Field label="Introduction" htmlFor="cc-msg" hint="They'll see this message with your request.">
          <Textarea id="cc-msg" rows={9} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Say who you are and what you'd like to learn." />
        </Field>
        {error && <ErrorNote message={error} />}
        <p className="text-xs text-stone">
          The request only appears inside TrojanLink. We don't send emails or calendar invites. Once it's confirmed, you two arrange the meeting details yourselves.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            Send request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
