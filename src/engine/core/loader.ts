import type { AbilityDefinition, CombatantData, CombatConstants } from '../schema';
import type { Combatant } from './types';
import { levelForXp, levelMultiplier } from './leveling';

import constantsJson from '../data/constants.json';
import jurupariAbilities from '../data/abilities/jurupari.json';
import jurupariCharacters from '../data/characters/jurupari.json';
import jurupariEnemies from '../data/enemies/jurupari.json';
import yggdrasilAbilities from '../data/abilities/yggdrasil.json';
import yggdrasilCharacters from '../data/characters/yggdrasil.json';
import olympusAbilities from '../data/abilities/olympus.json';
import olympusCharacters from '../data/characters/olympus.json';

export const CONSTANTS = constantsJson as CombatConstants;

/**
 * Every playable ally character across all implemented mythologies, keyed by
 * id. Only Jurupari.iso is an actual playable *world* (stages/enemies) — the
 * other mythologies are ally character pools only, all fighting in that same
 * world (see docs/personagens.md; only a subset of its 24-character roster
 * has real stats/abilities behind it so far).
 */
const ALL_CHARACTERS = [
  ...(jurupariCharacters as CombatantData[]),
  ...(yggdrasilCharacters as CombatantData[]),
  ...(olympusCharacters as CombatantData[]),
];

const CHARACTER_REGISTRY: Record<string, CombatantData> = Object.fromEntries(ALL_CHARACTERS.map((c) => [c.id, c]));

export const ALL_CHARACTER_IDS: string[] = ALL_CHARACTERS.map((c) => c.id);

/** Character ids grouped by their `mythology` field, in file order — the compendium/onboarding UI's source of truth for "which mythology is this from." */
export function characterIdsByMythology(): { mythology: string; ids: string[] }[] {
  const order: string[] = [];
  const groups = new Map<string, string[]>();
  for (const c of ALL_CHARACTERS) {
    const key = c.mythology ?? 'Desconhecida';
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(c.id);
  }
  return order.map((mythology) => ({ mythology, ids: groups.get(mythology)! }));
}

const ABILITY_REGISTRY: Record<string, AbilityDefinition> = Object.fromEntries(
  [...(jurupariAbilities as AbilityDefinition[]), ...(yggdrasilAbilities as AbilityDefinition[]), ...(olympusAbilities as AbilityDefinition[])].map(
    (a) => [a.id, a],
  ),
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
  const def = Math.round(data.baseStats.def * statMultiplier);
  const ini = Math.round(data.baseStats.ini * statMultiplier);
  const esq = data.baseStats.esq * statMultiplier;

  return {
    id: idSuffix ? `${data.id}#${idSuffix}` : data.id,
    templateId: data.id,
    name: data.name,
    faction: data.faction,
    element: data.element,
    isAlly,
    stars: data.stars ?? 0,
    level,
    base: { hp, atk, def, ini, esq },
    maxHp: hp,
    hp,
    shield: 0,
    statuses: [],
    abilities: resolveAbilities(data.abilities),
    statusDurationBonus: data.statusDurationBonus ?? 0,
    alwaysActsFirst: data.alwaysActsFirst ?? false,
  };
}

export interface OwnedCharacterEntry {
  id: string;
  /** Accumulated XP — level is always derived from this, never passed independently (see engine/core/leveling.ts). */
  xp: number;
}

/**
 * Builds an ally team from whichever characters are passed (a player's owned
 * roster, of any size/mythology mix), with the same-mythology-team synergy
 * bonus applied by count (combate.md section 5) and each character's level
 * (derived from its xp) scaling its stats via levelMultiplier. Order is
 * preserved, and each id may appear at most once (no duplicate/star-up
 * support yet).
 */
export function loadCharactersByIds(entries: OwnedCharacterEntry[]): Combatant[] {
  const synergyBonus = synergyBonusFor(entries.length);
  return entries.map(({ id, xp }) => {
    const data = CHARACTER_REGISTRY[id];
    if (!data) throw new Error(`Unknown character id: ${id}`);
    const level = levelForXp(xp);
    return buildCombatant(data, true, synergyBonus, levelMultiplier(level), undefined, level);
  });
}

/** The original 4-character Jurupari.iso roster at level 0, still used by the CLI demo and existing tests. */
export function loadJurupariAllies(): Combatant[] {
  return loadCharactersByIds((jurupariCharacters as CombatantData[]).map((c) => ({ id: c.id, xp: 0 })));
}

interface JurupariEnemyData {
  comuns: CombatantData[];
  boss: CombatantData;
}

const enemyData = jurupariEnemies as JurupariEnemyData;

/**
 * The 3 common enemy archetypes (1 of each), no synergy bonus. `statMultiplier`
 * applies the docs/mvp.md +15%-per-estágio scaling (see engine/core/progression.ts),
 * and — since a player's owned team can now be smaller than the original
 * 4-character baseline these were calibrated against — progression.ts's
 * teamSizeMultiplier.
 */
export function loadJurupariComuns(statMultiplier: number = 1): Combatant[] {
  return enemyData.comuns.map((e) => buildCombatant(e, false, 0, statMultiplier));
}

/** Anhangá.exe, the world boss. `statMultiplier` — see loadJurupariComuns. */
export function loadJurupariBoss(statMultiplier: number = 1): Combatant[] {
  return [buildCombatant(enemyData.boss, false, 0, statMultiplier)];
}
