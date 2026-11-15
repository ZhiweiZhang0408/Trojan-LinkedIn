import type { ScoreBreakdown } from '../services/types';

/** The signature element: a gold arc that fills to the heuristic match score. */
export function ScoreRing({ score, size = 72, label = true }: { score: number; size?: number; label?: boolean }) {
  const stroke = size > 60 ? 7 : 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75; // 270° gauge
  const filled = arc * Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative inline-flex shrink-0 flex-col items-center" title="Match score: a weighted heuristic, not a probability">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[225deg]" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-gold-100)" strokeWidth={stroke}
          strokeDasharray={`${arc} ${circumference}`} strokeLinecap="round" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-gold-400)" strokeWidth={stroke}
          strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" className="arc-draw"
          style={{ ['--arc-len' as string]: `${filled}` }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className={`font-display font-bold text-ink ${size > 60 ? 'text-2xl' : 'text-base'}`}>{score}</span>
      </span>
      {label && <span className="-mt-2 text-[11px] font-medium text-stone">match</span>}
      <span className="sr-only">Match score {score} out of 100</span>
    </div>
  );
}

const labels: Record<keyof ScoreBreakdown, string> = {
  career_goal: 'Career goals',
  skills: 'Skills',
  industry: 'Industry',
  job_title: 'Job title',
  background: 'Background',
};

export function ScoreBreakdownBars({ breakdown, weights }: { breakdown: ScoreBreakdown; weights: Record<keyof ScoreBreakdown, number> }) {
  return (
    <dl className="grid gap-1.5">
      {(Object.keys(labels) as (keyof ScoreBreakdown)[]).map((k) => (
        <div key={k} className="grid grid-cols-[88px_1fr_44px] items-center gap-2 text-xs">
          <dt className="text-stone">{labels[k]}</dt>
          <dd className="h-1.5 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full bg-cardinal-600" style={{ width: `${(breakdown[k] / (weights[k] || 1)) * 100}%` }} />
          </dd>
          <dd className="text-right tabular-nums text-stone">
            {Math.round(breakdown[k])}/{weights[k]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
