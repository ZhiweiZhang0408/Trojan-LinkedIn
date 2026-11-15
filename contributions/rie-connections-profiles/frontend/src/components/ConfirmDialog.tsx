import { Modal } from './Modal';
import { Button } from './ui';

/** In-app confirmation (never a browser confirm()), used for destructive actions. */
export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel = 'Cancel', busy, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-[15px] leading-relaxed text-stone">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant="danger" busy={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
