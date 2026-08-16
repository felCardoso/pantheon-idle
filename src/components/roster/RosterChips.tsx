import { FACTION_COLOR, RARITY_COLOR } from '../../data/theme';
import type { Faction, Rarity } from '../../types';

interface RosterChipsProps {
  faction: Faction;
  rarity: Rarity;
}

function Chip({ label, color, glyph }: { label: string; color: string; glyph?: string }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold"
      style={{ borderColor: `${color}55`, color, background: `${color}14` }}
    >
      {glyph && <span className="opacity-80">{glyph}</span>}
      {label}
    </span>
  );
}

export function RosterChips({ faction, rarity }: RosterChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip label={rarity} color={RARITY_COLOR[rarity]} />
      <Chip label={faction} color={FACTION_COLOR[faction]} />
    </div>
  );
}
