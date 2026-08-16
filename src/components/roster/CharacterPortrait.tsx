import { PixelFigure } from '../battle/PixelFigure';
import { FACTION_COLOR, RARITY_COLOR } from '../../data/theme';
import type { Faction, Rarity } from '../../types';

interface CharacterPortraitProps {
  name: string;
  faction: Faction;
  rarity: Rarity;
  portraitUrl?: string;
  size?: number;
  className?: string;
}

/** Bigger sibling of UnitCard's inline portrait box, for roster screens outside battle. */
export function CharacterPortrait({ name, faction, rarity, portraitUrl, size = 72, className = '' }: CharacterPortraitProps) {
  const factionColor = FACTION_COLOR[faction];
  const rarityColor = RARITY_COLOR[rarity];

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(150deg, ${rarityColor}22, #0a0a12)`,
        border: `1.5px solid ${factionColor}aa`,
        boxShadow: `0 0 18px -4px ${factionColor}88`,
      }}
    >
      {portraitUrl ? (
        <img src={portraitUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <PixelFigure className="h-[80%] w-[80%]" style={{ color: factionColor }} />
      )}
    </div>
  );
}
