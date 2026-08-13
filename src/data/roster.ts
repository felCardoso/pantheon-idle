import { ALL_CHARACTER_IDS, characterIdsByMythology, loadCharactersByIds } from '../engine/core/loader';
import type { RngLike } from '../engine/core/rng';
import { CHARACTER_INFO, type CharacterInfo } from './characterInfo';
import {
  DISPLAY_LEVEL_BY_TEMPLATE_ID,
  DISPLAY_PORTRAIT_BY_TEMPLATE_ID,
  DISPLAY_RARITY_BY_TEMPLATE_ID,
  FALLBACK_ELEMENT,
  FALLBACK_FACTION,
  FALLBACK_RARITY,
} from './engineDisplay';
import type { BaseStats } from '../engine/schema';
import type { Element, Faction, Rarity } from '../types';

export interface RosterCharacter extends CharacterInfo {
  templateId: string;
  name: string;
  faction: Faction;
  element: Element;
  rarity: Rarity;
  level: number;
  mythology: string;
  portraitUrl?: string;
  /** Real combat stats: same-mythology synergy bonus (by team size) already folded in. */
  stats: BaseStats;
  alwaysActsFirst: boolean;
  statusDurationBonus: number;
}

const UNKNOWN_INFO: CharacterInfo = {
  lore: '',
  abilityName: null,
  abilityKind: 'Passiva',
  abilityDescription: 'Sem habilidade registrada.',
};

function toRosterCharacter(c: ReturnType<typeof loadCharactersByIds>[number], mythology: string): RosterCharacter {
  return {
    templateId: c.templateId,
    name: c.name,
    faction: c.faction ?? FALLBACK_FACTION,
    element: c.element ?? FALLBACK_ELEMENT,
    rarity: DISPLAY_RARITY_BY_TEMPLATE_ID[c.templateId] ?? FALLBACK_RARITY,
    level: DISPLAY_LEVEL_BY_TEMPLATE_ID[c.templateId] ?? 1,
    mythology,
    portraitUrl: DISPLAY_PORTRAIT_BY_TEMPLATE_ID[c.templateId],
    stats: c.base,
    alwaysActsFirst: c.alwaysActsFirst,
    statusDurationBonus: c.statusDurationBonus,
    ...(CHARACTER_INFO[c.templateId] ?? UNKNOWN_INFO),
  };
}

/** Every playable character across all implemented mythologies, with raw (no-synergy) stats, for browsing. */
export function buildCompendium(): RosterCharacter[] {
  return characterIdsByMythology().flatMap(({ mythology, ids }) =>
    ids.map((id) => toRosterCharacter(loadCharactersByIds([id])[0], mythology)),
  );
}

/** A player's actual squad — real combat stats, synergy bonus included by however many they own. */
export function buildOwnedRoster(ownedIds: string[]): RosterCharacter[] {
  if (ownedIds.length === 0) return [];
  const idToMythology = new Map(characterIdsByMythology().flatMap(({ mythology, ids }) => ids.map((id) => [id, mythology])));
  return loadCharactersByIds(ownedIds).map((c) => toRosterCharacter(c, idToMythology.get(c.templateId) ?? ''));
}

/**
 * 3 onboarding starter options — one random character from each mythology,
 * independent of rarity (a new player might land a Quantum flagship or an
 * Alpha just as easily; not gated to any particular tier).
 */
export function pickStarterOptions(rng: RngLike): RosterCharacter[] {
  return characterIdsByMythology().map(({ mythology, ids }) => {
    const id = rng.pick(ids);
    return toRosterCharacter(loadCharactersByIds([id])[0], mythology);
  });
}

/** All character ids, for anything that needs to enumerate the full pool without hardcoding it. */
export { ALL_CHARACTER_IDS };
