import type { ChatStatus } from '../services/types';

const styles: Record<ChatStatus, { label: string; cls: string; dot: string }> = {
  pending: { label: 'Waiting for reply', cls: 'bg-gold-100 text-gold-600', dot: 'bg-gold-400' },
  accepted: { label: 'Confirmed', cls: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600' },
  declined: { label: 'Declined', cls: 'bg-canvas text-stone', dot: 'bg-stone' },
  cancelled: { label: 'Cancelled', cls: 'bg-canvas text-stone line-through decoration-stone/40', dot: 'bg-stone/60' },
};

export function StatusBadge({ status, incoming }: { status: ChatStatus; incoming?: boolean }) {
  const s = styles[status];
  const label = status === 'pending' && incoming ? 'Needs your reply' : s.label;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {label}
    </span>
  );
}
