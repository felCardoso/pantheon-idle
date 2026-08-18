import {
  ALL_CHARACTER_IDS,
  activeOptionsFor,
  characterIdsByMythology,
  loadCharactersByIds,
  passiveAbilityFor,
  RARITY_RANK,
  Rng,
  xpProgress,
  type AbilityDefinition,
  type AbilityTrigger,
  type BaseStats,
  type RngLike,
} from '../engine';
import { CHARACTER_INFO, type AbilityFlavor, type CharacterInfo } from './characterInfo';
import { DISPLAY_PORTRAIT_BY_TEMPLATE_ID, DISPLAY_RARITY_BY_TEMPLATE_ID, FALLBACK_FACTION, FALLBACK_RARITY } from './engineDisplay';
import type { OwnedCharacter } from '../hooks/useOwnedCharacters';
import type { Faction, Rarity } from '../types';

/** One equippable/display ability entry — the id is what `onSelectAbility` calls back with. */
export interface ResolvedAbilityInfo {
  id: string;
  name: string | null;
  kind: 'Passiva' | 'Ativa';
  description: string;
  trigger: AbilityTrigger;
}

export interface RosterCharacter extends Omit<CharacterInfo, 'abilityFlavor' | 'innateTrait'> {
  templateId: string;
  name: string;
  faction: Faction;
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
  /** Every candidate active ability the player can equip (docs/combate.md §5) — today always 0 or 1 per character until more are hand-authored (see docs/TUTORIAL_STATUS_HABILIDADES.md). */
  activeOptions: ResolvedAbilityInfo[];
  /** The character's LTS+ passive, or null if not authored yet (no character has one today). */
  passive: ResolvedAbilityInfo | null;
  /** Jurupari.exe's/Saci.exe's hardcoded engine trait — a read-only passive-styled card, not part of activeOptions/passive since it has no backing AbilityDefinition. Null for everyone else. */
  innateTrait: AbilityFlavor | null;
  /** The single ability shown in compact contexts (onboarding cards) — activeOptions[0], falling back to the innate trait. Null only if a character somehow has neither. */
  headlineAbility: ResolvedAbilityInfo | null;
  statusDurationBonus: number;
  /** Star-up progress — always 0 until a star/rarity-upgrade system exists (docs/gdd.md section 7). */
  stars: number;
}

const UNKNOWN_INFO: CharacterInfo = { lore: '', abilityFlavor: {} };

function toResolvedAbility(def: AbilityDefinition, flavor?: AbilityFlavor): ResolvedAbilityInfo {
  return {
    id: def.id,
    name: flavor?.name ?? def.name,
    kind: def.scope === 'passive' ? 'Passiva' : 'Ativa',
    description: flavor?.description ?? 'Sem descrição — ver docs/TUTORIAL_STATUS_HABILIDADES.md.',
    trigger: def.trigger,
  };
}

/**
 * Team-power figure. Only HP/ATK count — DEF/INI/ESQ/ICE are ability-granted
 * build choices (schema.ts), not generic power, so they don't factor in here.
 */
export function characterPower(stats: BaseStats): number {
  return Math.round(stats.hp * 0.1 + stats.atk * 2);
}

function toRosterCharacter(
  c: ReturnType<typeof loadCharactersByIds>[number],
  mythology: string,
  xp: number,
  rarity?: Rarity,
): RosterCharacter {
  const progress = xpProgress(xp);
  const info = CHARACTER_INFO[c.templateId] ?? UNKNOWN_INFO;
  const activeOptions = activeOptionsFor(c.templateId).map((def) => toResolvedAbility(def, info.abilityFlavor[def.id]));
  const passiveDef = passiveAbilityFor(c.templateId);
  const passive = passiveDef ? toResolvedAbility(passiveDef, info.abilityFlavor[passiveDef.id]) : null;
  const innateTrait = info.innateTrait ?? null;
  const headlineAbility: ResolvedAbilityInfo | null =
    activeOptions[0] ??
    (innateTrait ? { id: `${c.templateId}-innate`, name: innateTrait.name, kind: 'Passiva', description: innateTrait.description, trigger: 'battleStart' } : null);
  return {
    templateId: c.templateId,
    name: c.name,
    faction: c.faction ?? FALLBACK_FACTION,
    // Owned characters pass their real pulled rarity; unowned/browsing views
    // fall back to the static per-template baseline (every character can be
    // found at Alpha — see DISPLAY_RARITY_BY_TEMPLATE_ID's own comment).
    rarity: rarity ?? DISPLAY_RARITY_BY_TEMPLATE_ID[c.templateId] ?? FALLBACK_RARITY,
    level: progress.level,
    xp,
    xpIntoLevel: progress.intoLevel,
    xpForNextLevel: progress.forNextLevel,
    mythology,
    portraitUrl: DISPLAY_PORTRAIT_BY_TEMPLATE_ID[c.templateId],
    stats: c.base,
    statusDurationBonus: c.statusDurationBonus,
    stars: c.stars,
    lore: info.lore,
    activeOptions,
    passive,
    innateTrait,
    headlineAbility,
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
  return combatants.map((c, i) => toRosterCharacter(c, idToMythology.get(c.templateId) ?? '', owned[i].xp, owned[i].rarity));
}

/**
 * The full compendium, but owned characters show their real accumulated-XP
 * level instead of always 0 — unlike buildOwnedRoster, each character is
 * still loaded alone (no synergy folded in), matching buildCompendium's
 * "raw browsing stats" so Personagens isn't showing a hypothetical
 * all-owned-characters-as-one-team number.
 */
export function buildFullRosterView(owned: OwnedCharacter[]): RosterCharacter[] {
  const xpByCharacterId = new Map(owned.map((o) => [o.characterId, o.xp]));
  const rarityByCharacterId = new Map(owned.map((o) => [o.characterId, o.rarity]));
  return characterIdsByMythology().flatMap(({ mythology, ids }) =>
    ids.map((id) => {
      const xp = xpByCharacterId.get(id) ?? 0;
      return toRosterCharacter(loadCharactersByIds([{ id, xp }])[0], mythology, xp, rarityByCharacterId.get(id));
    }),
  );
}

/**
 * 3 onboarding starter options — one random character from each mythology,
 * independent of rarity (a new player might land an LTS flagship or an
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

/** Ascending rank — higher number is rarer. Shared by every rarity comparison (upgrades, pity, sort). Defined in engine/schema.ts (loader.ts needs it too); re-exported here for existing UI call sites. */
export { RARITY_RANK };

export type GachaTier = 'normal' | 'hard' | 'banner';

/**
 * Base drop-rate tables from docs/gdd.md section 10. The banner shares the
 * Gacha Hard table (same odds, "custando 25% a mais" per the doc — the price
 * premium lives in GachaPage's constants, not here). No soft-pity ramp yet
 * (the doc's pull-55/45 escalation) — only the banner's hard pity (X/150,
 * see GachaPage) is implemented; a future pass can layer soft pity in.
 */
const GACHA_RARITY_ODDS: Record<GachaTier, Record<Rarity, number>> = {
  normal: { Alpha: 0.5, Beta: 0.43, Stable: 0.05, LTS: 0.015, 'Zero-Day': 0.005 },
  hard: { Alpha: 0.4, Beta: 0.48, Stable: 0.08, LTS: 0.03, 'Zero-Day': 0.01 },
  banner: { Alpha: 0.4, Beta: 0.48, Stable: 0.08, LTS: 0.03, 'Zero-Day': 0.01 },
};

/** Rolls a rarity for one gacha pull, weighted by the given tier's odds table. */
export function rollGachaRarity(rng: RngLike, tier: GachaTier): Rarity {
  const odds = GACHA_RARITY_ODDS[tier];
  const roll = rng.next();
  let cumulative = 0;
  for (const rarity of ['Alpha', 'Beta', 'Stable', 'LTS', 'Zero-Day'] as Rarity[]) {
    cumulative += odds[rarity];
    if (roll < cumulative) return rarity;
  }
  return 'Alpha';
}

/**
 * Rolls one gacha pull: a uniformly-random character id (independent of
 * rarity — no per-rarity pools) plus a separately-rolled rarity from the
 * tier's odds table. The caller decides what happens with the result (see
 * useOwnedCharacters.acquireCharacter's new/upgraded/duplicate outcomes).
 */
export function pullGachaCharacterWithRarity(rng: RngLike, tier: GachaTier): { characterId: string; rarity: Rarity } {
  return { characterId: rng.pick(ALL_CHARACTER_IDS), rarity: rollGachaRarity(rng, tier) };
}

/** Chance a Zero-Day rolled on the banner is the spotlighted character rather than a random Zero-Day from the general pool ("Sistema 50/50", docs/gdd.md §10). */
export const BANNER_RATE_UP_CHANCE = 0.5;

export interface BannerPullResult {
  characterId: string;
  rarity: Rarity;
  /** Whether the *next* Zero-Day pulled on the banner is guaranteed to be the spotlighted character — pass this back in as `guaranteed` on the next call. */
  guaranteedNext: boolean;
}

/**
 * Rolls one Banner Semanal pull. Rarity uses the same odds as Gacha Hard
 * (docs/gdd.md §10); the character id is uniform across the pool UNLESS the
 * roll lands on Zero-Day, in which case the spotlighted banner character gets
 * a rate-up: `BANNER_RATE_UP_CHANCE` to be the one that comes out, otherwise a
 * random Zero-Day from the general pool — but losing that roll guarantees the
 * *next* Zero-Day pulled is the spotlighted character (the classic "50/50").
 * This is independent of and stacks with the banner's separate X/150 hard
 * pity (see GachaPage/usePlayerProgress's bannerPity).
 */
export function pullBannerCharacter(rng: RngLike, bannerCharacterId: string, guaranteed: boolean): BannerPullResult {
  const rarity = rollGachaRarity(rng, 'banner');
  if (rarity !== 'Zero-Day') {
    return { characterId: rng.pick(ALL_CHARACTER_IDS), rarity, guaranteedNext: guaranteed };
  }
  if (guaranteed || rng.next() < BANNER_RATE_UP_CHANCE) {
    return { characterId: bannerCharacterId, rarity, guaranteedNext: false };
  }
  return { characterId: rng.pick(ALL_CHARACTER_IDS), rarity, guaranteedNext: true };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A UTC-epoch week index — not a calendar-locale ISO week, just
 * `time / WEEK_MS` floored. Same value for every player at any given moment,
 * and ticks over exactly once every 7 days; used to seed the Loja's weekly
 * character showcase (see pickWeeklyShowcase below).
 */
export function currentShowcaseWeek(now: Date = new Date()): number {
  return Math.floor(now.getTime() / WEEK_MS);
}

/**
 * Picks 3 distinct character ids for the Loja's weekly showcase, seeded by
 * currentShowcaseWeek() so every player sees the same 3 characters until the
 * week rolls over. Slot 0 is always purchasable; slots 1-2 are Root
 * Access-only (see ShopPage) — that's an access rule the caller applies, not
 * something encoded here.
 */
export function pickWeeklyShowcase(weekSeed: number): string[] {
  const rng = new Rng(weekSeed >>> 0);
  const pool = [...ALL_CHARACTER_IDS];
  const picks: string[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const index = Math.floor(rng.next() * pool.length);
    picks.push(pool.splice(index, 1)[0]);
  }
  return picks;
}

/**
 * Picks the single character spotlighted on the Invocações banner, seeded by
 * currentShowcaseWeek() but offset from pickWeeklyShowcase's own seed so the
 * two rotations don't draw from the same first RNG value. Purely a spotlight
 * — which character id a banner pull actually lands on is still uniform
 * across the full pool (pullGachaCharacterWithRarity), same as every other
 * summon tier; only the rolled rarity uses the banner's odds table. The
 * banner's own display always shows this spotlighted character at a forced
 * "Zero-Day" badge (see GachaPage), independent of what a pull rolls.
 */
export function pickWeeklyBannerCharacter(weekSeed: number): string {
  const rng = new Rng((weekSeed * 2654435761 + 1) >>> 0);
  return rng.pick(ALL_CHARACTER_IDS);
}
