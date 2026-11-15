import { useState } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import type { MessagePurpose } from '../services/types';
import { Button, ErrorNote, Field, Select, Textarea } from './ui';

const PURPOSES: { value: MessagePurpose; label: string }[] = [
  { value: 'coffee_chat', label: 'Ask for a coffee chat' },
  { value: 'career_advice', label: 'Ask for career advice' },
  { value: 'industry_insight', label: 'Learn about their industry' },
  { value: 'application_advice', label: 'Get application advice' },
  { value: 'mentorship', label: 'Ask about mentorship' },
];

export function MessageGenerator({
  alumniId,
  alumniName,
  llmConfigured,
  onUse,
}: {
  alumniId: number;
  alumniName: string;
  llmConfigured: boolean;
  onUse: (message: string) => void;
}) {
  const toast = useToast();
  const [purpose, setPurpose] = useState<MessagePurpose>('coffee_chat');
  const [tone, setTone] = useState<'friendly' | 'formal'>('friendly');
  const [note, setNote] = useState('');
  const [useLlm, setUseLlm] = useState(false);
  const [message, setMessage] = useState('');
  const [source, setSource] = useState<'template' | 'llm' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.generateMessage({ alumni_id: alumniId, purpose, tone, personal_note: note, use_llm: useLlm });
      setMessage(res.message);
      setSource(res.source);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast('Message copied');
    } catch {
      toast('Copy failed. Select the text and copy it manually.', 'error');
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What do you want to ask?" htmlFor="mg-purpose">
          <Select id="mg-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as MessagePurpose)}>
            {PURPOSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tone" htmlFor="mg-tone">
          <Select id="mg-tone" value={tone} onChange={(e) => setTone(e.target.value as 'friendly' | 'formal')}>
            <option value="friendly">Friendly</option>
            <option value="formal">Formal</option>
          </Select>
        </Field>
      </div>
      <Field label="Something you'd like to add (optional)" htmlFor="mg-note" hint="Only facts about you. The draft never makes up shared experiences.">
        <Textarea id="mg-note" rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. I'm building a recommendation system for my capstone project." />
      </Field>
      {llmConfigured && (
        <label className="flex items-start gap-2 text-sm text-stone">
          <input type="checkbox" className="mt-0.5 accent-cardinal-600" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} />
          Polish the draft with the external AI model. This sends your name, major, interests and {alumniName}'s public role to the provider.
        </label>
      )}
      <div>
        <Button variant="gold" onClick={generate} busy={busy}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M10 1.5l1.9 5.1 5.1 1.9-5.1 1.9L10 15.5l-1.9-5.1L3 8.5l5.1-1.9z" />
          </svg>
          {message ? 'Generate again' : 'Generate Introduction with AI'}
        </Button>
      </div>
      {error && <ErrorNote message={error} />}
      {message && (
        <div className="grid gap-2">
          <Field label="Your draft" htmlFor="mg-draft" hint={`${source === 'llm' ? 'Polished by the AI model' : 'Built from both profiles'}. Edit it however you like. Nothing is sent until you send it.`}>
            <Textarea id="mg-draft" rows={12} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onUse(message)}>Use in coffee chat request</Button>
            <Button variant="secondary" onClick={copy}>
              Copy message
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
