import { ALL_CHARACTER_IDS, characterIdsByMythology, loadCharactersByIds } from '../engine/core/loader';
import { xpProgress } from '../engine/core/leveling';
import type { RngLike } from '../engine/core/rng';
import { CHARACTER_INFO, type AbilityInfo, type CharacterInfo } from './characterInfo';
import { DISPLAY_PORTRAIT_BY_TEMPLATE_ID, DISPLAY_RARITY_BY_TEMPLATE_ID, FALLBACK_ELEMENT, FALLBACK_FACTION, FALLBACK_RARITY } from './engineDisplay';
import type { OwnedCharacter } from '../hooks/useOwnedCharacters';
import type { AbilityTrigger, BaseStats } from '../engine/schema';
import type { Element, Faction, Rarity } from '../types';

/** An ability entry with its real engine trigger resolved in — see toRosterCharacter's zip below. */
export interface ResolvedAbilityInfo extends AbilityInfo {
  trigger: AbilityTrigger;
}

export interface RosterCharacter extends Omit<CharacterInfo, 'abilities'> {
  templateId: string;
  name: string;
  faction: Faction;
  element: Element;
  rarity: Rarity;
  level: number;
  /** Accumulated XP and in-level progress — see engine/core/leveling.ts. */
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  mythology: string;
  portraitUrl?: string;
  /** Real combat stats: same-mythology synergy bonus (by team size) and level scaling already folded in. */
  stats: BaseStats;
  abilities: ResolvedAbilityInfo[];
  alwaysActsFirst: boolean;
  statusDurationBonus: number;
  /** Star-up progress — always 0 until a star/rarity-upgrade system exists (docs/gdd.md section 7). */
  stars: number;
}

const UNKNOWN_INFO: CharacterInfo = {
  lore: '',
  abilities: [{ name: null, kind: 'Passiva', description: 'Sem habilidade registrada.' }],
};

/**
 * First-pass, easy-to-retune team-power figure — no existing "poder" stat in
 * the docs to match, so this weights each combat stat to land in a similar
 * order of magnitude across the roster and grows with the same investment
 * (level, mythology synergy) that already matters in battle. DEF is 0 for
 * every character today, but stays in the formula so a future non-zero DEF
 * contributes automatically.
 */
export function characterPower(stats: BaseStats): number {
  return Math.round(stats.hp * 0.1 + stats.atk * 2 + stats.def * 2 + stats.ini * 1 + stats.esq * 1000);
}

function toRosterCharacter(c: ReturnType<typeof loadCharactersByIds>[number], mythology: string, xp: number): RosterCharacter {
  const progress = xpProgress(xp);
  const info = CHARACTER_INFO[c.templateId] ?? UNKNOWN_INFO;
  // CHARACTER_INFO's hand-authored abilities are always written in the same
  // order/length as the character's real engine abilities (c.abilities) —
  // zip in each one's actual trigger so UI (Team page's "Order of Action")
  // can show when it fires without duplicating trigger data by hand.
  const abilities: ResolvedAbilityInfo[] = info.abilities.map((a, i) => ({ ...a, trigger: c.abilities[i]?.trigger ?? 'battleStart' }));
  return {
    templateId: c.templateId,
    name: c.name,
    faction: c.faction ?? FALLBACK_FACTION,
    element: c.element ?? FALLBACK_ELEMENT,
    rarity: DISPLAY_RARITY_BY_TEMPLATE_ID[c.templateId] ?? FALLBACK_RARITY,
    level: progress.level,
    xp,
    xpIntoLevel: progress.intoLevel,
    xpForNextLevel: progress.forNextLevel,
    mythology,
    portraitUrl: DISPLAY_PORTRAIT_BY_TEMPLATE_ID[c.templateId],
    stats: c.base,
    alwaysActsFirst: c.alwaysActsFirst,
    statusDurationBonus: c.statusDurationBonus,
    stars: c.stars,
    lore: info.lore,
    abilities,
  };
}

/** Every playable character across all implemented mythologies, at level 0 (the state any new instance starts at), for browsing. */
export function buildCompendium(): RosterCharacter[] {
  return characterIdsByMythology().flatMap(({ mythology, ids }) =>
    ids.map((id) => toRosterCharacter(loadCharactersByIds([{ id, xp: 0 }])[0], mythology, 0)),
  );
}

/** A player's actual squad — real combat stats, synergy + per-character level scaling included. */
export function buildOwnedRoster(owned: OwnedCharacter[]): RosterCharacter[] {
  if (owned.length === 0) return [];
  const idToMythology = new Map(characterIdsByMythology().flatMap(({ mythology, ids }) => ids.map((id) => [id, mythology])));
  const combatants = loadCharactersByIds(owned.map((o) => ({ id: o.characterId, xp: o.xp })));
  return combatants.map((c, i) => toRosterCharacter(c, idToMythology.get(c.templateId) ?? '', owned[i].xp));
}

/**
 * 3 onboarding starter options — one random character from each mythology,
 * independent of rarity (a new player might land a Quantum flagship or an
 * Alpha just as easily; not gated to any particular tier). Always level 0.
 */
export function pickStarterOptions(rng: RngLike): RosterCharacter[] {
  return characterIdsByMythology().map(({ mythology, ids }) => {
    const id = rng.pick(ids);
    return toRosterCharacter(loadCharactersByIds([{ id, xp: 0 }])[0], mythology, 0);
  });
}

/** All character ids, for anything that needs to enumerate the full pool without hardcoding it. */
export { ALL_CHARACTER_IDS };

/** A duplicate character's tradeable item is a `.dat` (docs/monetizacao-guilda.md), not the owned character's `.exe` — use only for fragment/diagram display, never for the owned character itself. */
export function diagramName(name: string): string {
  return name.replace(/\.exe$/, '.dat');
}

/**
 * Rolls one random character id for a gacha pull — uniform across the full
 * pool, independent of mythology or rarity (no pity/odds system yet, unlike
 * docs/gdd.md section 10's eventual design). The caller decides what a
 * duplicate becomes (see useOwnedCharacters.acquireCharacter).
 */
export function pullGachaCharacter(rng: RngLike): string {
  return rng.pick(ALL_CHARACTER_IDS);
}
