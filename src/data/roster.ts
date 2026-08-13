import { loadJurupariAllies } from '../engine/core/loader';
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
  portraitUrl?: string;
  /** Battle-ready stats: same-mythology synergy bonus already folded in, matching what actually fights. */
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

/** The full current roster (Jurupari.iso's 4 allies), with display + lore data merged in. */
export function buildRoster(): RosterCharacter[] {
  return loadJurupariAllies().map((c) => ({
    templateId: c.templateId,
    name: c.name,
    faction: c.faction ?? FALLBACK_FACTION,
    element: c.element ?? FALLBACK_ELEMENT,
    rarity: DISPLAY_RARITY_BY_TEMPLATE_ID[c.templateId] ?? FALLBACK_RARITY,
    level: DISPLAY_LEVEL_BY_TEMPLATE_ID[c.templateId] ?? 1,
    portraitUrl: DISPLAY_PORTRAIT_BY_TEMPLATE_ID[c.templateId],
    stats: c.base,
    alwaysActsFirst: c.alwaysActsFirst,
    statusDurationBonus: c.statusDurationBonus,
    ...(CHARACTER_INFO[c.templateId] ?? UNKNOWN_INFO),
  }));
}
