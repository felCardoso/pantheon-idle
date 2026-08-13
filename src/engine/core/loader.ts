import type { AbilityDefinition, CombatantData, CombatConstants } from '../schema';
import type { Combatant } from './types';

import constantsJson from '../data/constants.json';
import jurupariAbilities from '../data/abilities/jurupari.json';
import jurupariCharacters from '../data/characters/jurupari.json';
import jurupariEnemies from '../data/enemies/jurupari.json';

export const CONSTANTS = constantsJson as CombatConstants;

const ABILITY_REGISTRY: Record<string, AbilityDefinition> = Object.fromEntries(
  (jurupariAbilities as AbilityDefinition[]).map((a) => [a.id, a]),
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

function buildCombatant(data: CombatantData, isAlly: boolean, synergyBonus: number, idSuffix?: string): Combatant {
  const hp = Math.round(data.baseStats.hp * (1 + synergyBonus));
  const atk = Math.round(data.baseStats.atk * (1 + synergyBonus));

  return {
    id: idSuffix ? `${data.id}#${idSuffix}` : data.id,
    templateId: data.id,
    name: data.name,
    faction: data.faction,
    element: data.element,
    isAlly,
    stars: data.stars ?? 0,
    base: { hp, atk, def: data.baseStats.def, ini: data.baseStats.ini, esq: data.baseStats.esq },
    maxHp: hp,
    hp,
    shield: 0,
    statuses: [],
    abilities: resolveAbilities(data.abilities),
    statusDurationBonus: data.statusDurationBonus ?? 0,
    alwaysActsFirst: data.alwaysActsFirst ?? false,
  };
}

/** Builds the 4-character Jurupari.iso ally team, with same-mythology synergy applied. */
export function loadJurupariAllies(): Combatant[] {
  const characters = jurupariCharacters as CombatantData[];
  const synergyBonus = synergyBonusFor(characters.length);
  return characters.map((c) => buildCombatant(c, true, synergyBonus));
}

interface JurupariEnemyData {
  comuns: CombatantData[];
  boss: CombatantData;
}

const enemyData = jurupariEnemies as JurupariEnemyData;

/** The 3 common enemy archetypes (Estágio 4 composition: 1 of each), no synergy bonus. */
export function loadJurupariComuns(): Combatant[] {
  return enemyData.comuns.map((e) => buildCombatant(e, false, 0));
}

/** Anhangá.exe, the world boss. */
export function loadJurupariBoss(): Combatant[] {
  return [buildCombatant(enemyData.boss, false, 0)];
}
