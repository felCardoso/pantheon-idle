import type { AbilityDefinition, CombatantData, CombatConstants } from './schema.ts';
import type { Combatant } from './types.ts';
import { levelForXp, levelMultiplier } from './leveling.ts';

import constantsJson from './data/constants.json' with { type: 'json' };
import jurupariAbilities from './data/abilities/jurupari.json' with { type: 'json' };
import jurupariCharacters from './data/characters/jurupari.json' with { type: 'json' };
import yggdrasilAbilities from './data/abilities/yggdrasil.json' with { type: 'json' };
import yggdrasilCharacters from './data/characters/yggdrasil.json' with { type: 'json' };
import olympusAbilities from './data/abilities/olympus.json' with { type: 'json' };
import olympusCharacters from './data/characters/olympus.json' with { type: 'json' };
import takamagaharaAbilities from './data/abilities/takamagahara.json' with { type: 'json' };
import takamagaharaCharacters from './data/characters/takamagahara.json' with { type: 'json' };

export const CONSTANTS = constantsJson as CombatConstants;

/**
 * PvP battles are always ally-vs-ally (attacker's roster vs. the defender's
 * saved snapshot), so unlike src/engine/core/loader.ts this trimmed copy
 * never needs enemy/world data — only every playable ally character across
 * all implemented mythologies, keyed by id.
 */
const ALL_CHARACTERS = [
  ...(jurupariCharacters as CombatantData[]),
  ...(yggdrasilCharacters as CombatantData[]),
  ...(olympusCharacters as CombatantData[]),
  ...(takamagaharaCharacters as CombatantData[]),
];

const CHARACTER_REGISTRY: Record<string, CombatantData> = Object.fromEntries(ALL_CHARACTERS.map((c) => [c.id, c]));

const ABILITY_REGISTRY: Record<string, AbilityDefinition> = Object.fromEntries(
  [
    ...(jurupariAbilities as AbilityDefinition[]),
    ...(yggdrasilAbilities as AbilityDefinition[]),
    ...(olympusAbilities as AbilityDefinition[]),
    ...(takamagaharaAbilities as AbilityDefinition[]),
  ].map((a) => [a.id, a]),
);

function resolveAbilities(ids: string[]): AbilityDefinition[] {
  return ids.map((id) => {
    const def = ABILITY_REGISTRY[id];
    if (!def) throw new Error(`Unknown ability id: ${id}`);
    return def;
  });
}

/** Mythological synergy bonus for a same-mythology team, per combate.md section 5. */
function synergyBonusFor(teamSize: number): number {
  return CONSTANTS.synergyByCount[String(teamSize)] ?? 0;
}

function buildCombatant(
  data: CombatantData,
  isAlly: boolean,
  synergyBonus: number,
  statMultiplier: number = 1,
  idSuffix?: string,
  level: number = 0,
): Combatant {
  const scale = (1 + synergyBonus) * statMultiplier;
  const hp = Math.round(data.baseStats.hp * scale);
  const atk = Math.round(data.baseStats.atk * scale);
  // DEF/INI/ESQ/ICE are ability-granted build choices, not generic growing stats (schema.ts) —
  // never scaled by level or synergy, always exactly whatever the character's kit grants.
  const { def, ini, esq, ice } = data.baseStats;

  return {
    id: idSuffix ? `${data.id}#${idSuffix}` : data.id,
    templateId: data.id,
    name: data.name,
    faction: data.faction,
    element: data.element,
    isAlly,
    stars: data.stars ?? 0,
    level,
    base: { hp, atk, def, ini, esq, ice },
    maxHp: hp,
    hp,
    shield: 0,
    statuses: [],
    abilities: resolveAbilities(data.abilities),
    statusDurationBonus: data.statusDurationBonus ?? 0,
    alwaysActsFirst: data.alwaysActsFirst ?? false,
    halfHpTriggered: false,
  };
}

export interface OwnedCharacterEntry {
  id: string;
  /** Accumulated XP — level is always derived from this, never passed independently (see engine/core/leveling.ts). */
  xp: number;
}

/**
 * Builds a team from whichever characters are passed (an attacker's owned
 * roster or a defender's saved snapshot, of any size/mythology mix), with
 * each character's level (derived from its xp) scaling its stats via
 * levelMultiplier, and the mythology synergy bonus (combate.md section 5)
 * applied per same-mythology subgroup — a mixed-mythology team only gets the
 * bonus for however many characters it has *of each given mythology*, never
 * a flat bonus for the whole team's size regardless of mix.
 */
export function loadCharactersByIds(entries: OwnedCharacterEntry[]): Combatant[] {
  const dataByEntry = entries.map(({ id, xp }) => {
    const data = CHARACTER_REGISTRY[id];
    if (!data) throw new Error(`Unknown character id: ${id}`);
    return { data, xp };
  });

  const countByMythology = new Map<string, number>();
  for (const { data } of dataByEntry) {
    const key = data.mythology ?? 'Desconhecida';
    countByMythology.set(key, (countByMythology.get(key) ?? 0) + 1);
  }

  return dataByEntry.map(({ data, xp }) => {
    const key = data.mythology ?? 'Desconhecida';
    const synergyBonus = synergyBonusFor(countByMythology.get(key)!);
    const level = levelForXp(xp);
    return buildCombatant(data, true, synergyBonus, levelMultiplier(level), undefined, level);
  });
}
