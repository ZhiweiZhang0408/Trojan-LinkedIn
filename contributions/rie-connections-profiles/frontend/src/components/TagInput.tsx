import { useState, type KeyboardEvent } from 'react';

export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  suggestions = [],
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, '');
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const open = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1.5 focus-within:border-cardinal-500 focus-within:ring-2 focus-within:ring-cardinal-100">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-cardinal-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-cardinal-800">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full px-1 hover:bg-cardinal-100" aria-label={`Remove ${v}`}>
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 text-sm focus:outline-none"
        />
      </div>
      {open.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {open.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-stone hover:border-cardinal-200 hover:text-cardinal-700"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const CAREER_INTERESTS = [
  'Software Engineering',
  'Machine Learning & AI',
  'Data Science & Analytics',
  'Product Management',
  'UX & Product Design',
  'Finance & Investment',
  'Consulting & Strategy',
  'Marketing & Growth',
  'Media & Entertainment',
  'Game Development',
  'Healthcare & Biotech',
  'Cybersecurity',
  'Entrepreneurship',
  'Sustainability & Energy',
];
