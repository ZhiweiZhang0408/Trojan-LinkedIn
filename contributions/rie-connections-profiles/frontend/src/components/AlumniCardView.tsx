import type { AlumniCard } from '../services/types';
import { ConnectButton } from './ConnectButton';
import { ScoreRing } from './ScoreRing';
import { Avatar, Button, Tag } from './ui';

export function AlumniCardView({
  card,
  sharedSkills = [],
  onCoffeeChat,
  showConnect = true,
}: {
  card: AlumniCard;
  sharedSkills?: string[];
  onCoffeeChat?: (card: AlumniCard) => void;
  showConnect?: boolean;
}) {
  const shared = new Set(sharedSkills.map((s) => s.toLowerCase()));
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-line bg-white p-5 transition-shadow hover:shadow-lift">
      <div className="flex items-start gap-3">
        <Avatar name={card.full_name} />
        <div className="min-w-0 flex-1">
          <a href={`#/profiles/${card.user_id}`} className="font-display text-lg font-semibold leading-tight hover:text-cardinal-700">
            {card.full_name}
          </a>
          <p className="text-sm text-ink">
            {card.current_title}
            {card.current_company && <span className="text-stone"> at {card.current_company}</span>}
          </p>
          <p className="mt-0.5 text-xs text-stone">
            USC {card.graduation_year ?? ''}{card.usc_degree ? `, ${card.usc_degree}` : ''}
          </p>
        </div>
        {card.match_score !== null && <ScoreRing score={card.match_score} size={56} />}
      </div>
      {card.bio && <p className="line-clamp-2 text-sm leading-relaxed text-stone">{card.bio}</p>}
      <div className="flex flex-wrap gap-1.5">
        {card.skills.slice(0, 5).map((s) => (
          <Tag key={s} tone={shared.has(s.toLowerCase()) ? 'shared' : 'plain'}>
            {s}
          </Tag>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {showConnect && <ConnectButton userId={card.user_id} name={card.full_name} status={card.connection_status} />}
        {onCoffeeChat &&
          (card.coffee_chat_available ? (
            <Button size="sm" onClick={() => onCoffeeChat(card)}>
              Coffee chat
            </Button>
          ) : (
            <span className="text-xs text-stone">Not taking coffee chats</span>
          ))}
        <a href={`#/profiles/${card.user_id}`} className="ml-auto text-sm font-semibold text-cardinal-700 hover:underline">
          View profile
        </a>
      </div>
    </article>
  );
}
