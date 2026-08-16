import { PASSIVE_UNLOCK_RARITY, RARITY_RANK } from '../schema';
import type { AbilityDefinition, CombatantData, CombatConstants, Rarity } from '../schema';
import type { Combatant } from './types';
import { levelForXp, levelMultiplier } from './leveling';
import type { WorldId } from './progression';

import constantsJson from '../data/constants.json';
import jurupariAbilities from '../data/abilities/jurupari.json';
import jurupariCharacters from '../data/characters/jurupari.json';
import jurupariEnemies from '../data/enemies/jurupari.json';
import yggdrasilAbilities from '../data/abilities/yggdrasil.json';
import yggdrasilCharacters from '../data/characters/yggdrasil.json';
import yggdrasilEnemyAbilities from '../data/abilities/yggdrasil-enemies.json';
import yggdrasilEnemies from '../data/enemies/yggdrasil.json';
import olympusAbilities from '../data/abilities/olympus.json';
import olympusCharacters from '../data/characters/olympus.json';
import olympusEnemyAbilities from '../data/abilities/olympus-enemies.json';
import olympusEnemies from '../data/enemies/olympus.json';
import takamagaharaAbilities from '../data/abilities/takamagahara.json';
import takamagaharaCharacters from '../data/characters/takamagahara.json';
import takamagaharaEnemies from '../data/enemies/takamagahara.json';
import duatAbilities from '../data/abilities/duat.json';
import duatEnemies from '../data/enemies/duat.json';
import orunAbilities from '../data/abilities/orun.json';
import orunEnemies from '../data/enemies/orun.json';

export const CONSTANTS = constantsJson as CombatConstants;

/**
 * Every playable ally character across all implemented mythologies, keyed by
 * id. Every world in WORLD_IDS (progression.ts) is now a real playable
 * enemy campaign (see ENEMY_REGISTRY below), but the ally roster is still
 * its own separate pool that fights across all of them — not every world's
 * mythology has ally characters yet (Duat/Orun have none so far; see
 * docs/personagens.md for the planned full 24-character roster).
 */
const ALL_CHARACTERS = [
  ...(jurupariCharacters as CombatantData[]),
  ...(yggdrasilCharacters as CombatantData[]),
  ...(olympusCharacters as CombatantData[]),
  ...(takamagaharaCharacters as CombatantData[]),
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
  [
    ...(jurupariAbilities as AbilityDefinition[]),
    ...(yggdrasilAbilities as AbilityDefinition[]),
    ...(yggdrasilEnemyAbilities as AbilityDefinition[]),
    ...(olympusAbilities as AbilityDefinition[]),
    ...(olympusEnemyAbilities as AbilityDefinition[]),
    ...(takamagaharaAbilities as AbilityDefinition[]),
    ...(duatAbilities as AbilityDefinition[]),
    ...(orunAbilities as AbilityDefinition[]),
  ].map((a) => [a.id, a]),
);

function resolveAbilities(ids: string[]): AbilityDefinition[] {
  return ids.map((id) => {
    const def = ABILITY_REGISTRY[id];
    if (!def) throw new Error(`Unknown ability id: ${id}`);
    return def;
  });
}

/**
 * Every candidate active-ability definition for a character template, in
 * data-file order — the ability-picker UI's source of truth for "what can
 * this character equip" (docs/roster.ts's toRosterCharacter). Distinct from
 * a resolved Combatant's `.abilities`, which only ever carries whichever one
 * is actually equipped for a given battle.
 */
export function activeOptionsFor(templateId: string): AbilityDefinition[] {
  const data = CHARACTER_REGISTRY[templateId];
  return data ? resolveAbilities(data.activeOptions) : [];
}

/** The character's passive ability definition, if authored — independent of whether it's currently rarity-unlocked for any given owner. */
export function passiveAbilityFor(templateId: string): AbilityDefinition | undefined {
  const id = CHARACTER_REGISTRY[templateId]?.passiveAbilityId;
  return id ? ABILITY_REGISTRY[id] : undefined;
}

/**
 * Enemies never choose (docs/combate.md §8: "Ações Hardcoded" — a boss can
 * run several abilities at once in fixed sequence) so every one of their
 * activeOptions fires, plus their passive unconditionally (enemies bypass
 * the rarity gate). Allies get exactly one active — `selectedAbilityId` if
 * it's actually one of the character's activeOptions, else activeOptions[0]
 * (docs/combate.md §5: "o jogador equipa uma por vez") — plus their passive
 * only once `rarity` clears PASSIVE_UNLOCK_RARITY.
 */
function resolveCombatantAbilities(
  data: CombatantData,
  isAlly: boolean,
  rarity?: Rarity,
  selectedAbilityId?: string,
): AbilityDefinition[] {
  if (!isAlly) {
    const ids = data.passiveAbilityId ? [...data.activeOptions, data.passiveAbilityId] : data.activeOptions;
    return resolveAbilities(ids);
  }

  const selected = selectedAbilityId && data.activeOptions.includes(selectedAbilityId) ? selectedAbilityId : data.activeOptions[0];
  const activeIds = selected ? [selected] : [];
  const passiveUnlocked = !!rarity && !!data.passiveAbilityId && RARITY_RANK[rarity] >= RARITY_RANK[PASSIVE_UNLOCK_RARITY];
  const ids = passiveUnlocked ? [...activeIds, data.passiveAbilityId!] : activeIds;
  return resolveAbilities(ids);
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
  rarity?: Rarity,
  selectedAbilityId?: string,
): Combatant {
  const scale = (1 + synergyBonus) * statMultiplier;
  const hp = Math.round(data.baseStats.hp * scale);
  const atk = Math.round(data.baseStats.atk * scale);
  // Allies: DEF/INI/ESQ/ICE are ability-granted build choices, not generic growing stats
  // (schema.ts) — never scaled by level/synergy, always exactly whatever the character's kit
  // grants (today always 0, until kits that grant them exist). Enemies are untouched by that
  // rule — their DEF/INI/ESQ scaling by statMultiplier is world/estágio difficulty tuning, a
  // separate, pre-existing mechanic (progression.ts's difficultyMultiplier).
  const def = isAlly ? data.baseStats.def : data.baseStats.def * statMultiplier;
  const ini = isAlly ? data.baseStats.ini : Math.round(data.baseStats.ini * statMultiplier);
  const esq = isAlly ? data.baseStats.esq : data.baseStats.esq * statMultiplier;
  const ice = isAlly ? data.baseStats.ice : (data.baseStats.ice ?? 0) * statMultiplier;

  return {
    id: idSuffix ? `${data.id}#${idSuffix}` : data.id,
    templateId: data.id,
    name: data.name,
    faction: data.faction,
    isAlly,
    stars: data.stars ?? 0,
    level,
    base: { hp, atk, def, ini, esq, ice },
    maxHp: hp,
    hp,
    shield: 0,
    statuses: [],
    abilities: resolveCombatantAbilities(data, isAlly, rarity, selectedAbilityId),
    statusDurationBonus: data.statusDurationBonus ?? 0,
    alwaysActsFirst: data.alwaysActsFirst ?? false,
    halfHpTriggered: false,
  };
}

export interface OwnedCharacterEntry {
  id: string;
  /** Accumulated XP — level is always derived from this, never passed independently (see engine/core/leveling.ts). */
  xp: number;
  /** The card's current best owned rarity — gates whether its passive is active (see resolveCombatantAbilities). Omitted = passive locked, same as browsing an unowned character. */
  rarity?: Rarity;
  /** The player's equipped active ability id — falls back to the character's first activeOptions entry if omitted or not actually one of its options. */
  selectedAbilityId?: string;
}

/**
 * Builds an ally team from whichever characters are passed (a player's owned
 * roster, of any size/mythology mix), with each character's level (derived
 * from its xp) scaling its stats via levelMultiplier, and the mythology
 * synergy bonus (combate.md section 5) applied per same-mythology subgroup —
 * a mixed-mythology team only gets the bonus for however many characters it
 * has *of each given mythology*, never a flat bonus for the whole team's
 * size regardless of mix. Order is preserved, and each id may appear at most
 * once (no duplicate/star-up support yet).
 */
export function loadCharactersByIds(entries: OwnedCharacterEntry[]): Combatant[] {
  const dataByEntry = entries.map(({ id, xp, rarity, selectedAbilityId }) => {
    const data = CHARACTER_REGISTRY[id];
    if (!data) throw new Error(`Unknown character id: ${id}`);
    return { data, xp, rarity, selectedAbilityId };
  });

  const countByMythology = new Map<string, number>();
  for (const { data } of dataByEntry) {
    const key = data.mythology ?? 'Desconhecida';
    countByMythology.set(key, (countByMythology.get(key) ?? 0) + 1);
  }

  return dataByEntry.map(({ data, xp, rarity, selectedAbilityId }) => {
    const key = data.mythology ?? 'Desconhecida';
    const synergyBonus = synergyBonusFor(countByMythology.get(key)!);
    const level = levelForXp(xp);
    return buildCombatant(data, true, synergyBonus, levelMultiplier(level), undefined, level, rarity, selectedAbilityId);
  });
}

/** The original 4-character Jurupari.iso roster at level 0, still used by the CLI demo and existing tests. */
export function loadJurupariAllies(): Combatant[] {
  return loadCharactersByIds((jurupariCharacters as CombatantData[]).map((c) => ({ id: c.id, xp: 0 })));
}

interface WorldEnemyData {
  comuns: CombatantData[];
  boss: CombatantData;
}

/**
 * Enemy data for every world in progression.ts's WORLD_IDS. All 6 are
 * calibrated at the exact same baseline numbers (reskinned per world's
 * lore) — the actual difficulty ramp between worlds comes entirely from
 * progression.ts's difficultyMultiplier (+30% base per world) applied at
 * load time via `statMultiplier` below, not from hand-tuned stats here.
 *
 * Note: docs/mundos.md names Olympus.iso's boss "Medusa.exe", but Medusa is
 * already a playable ally character in this build (see olympus.json under
 * characters/) — renamed to Typhon.exe here to avoid a same-name ally/enemy
 * collision in one battle, the same reasoning that renamed Jurupari.iso's
 * "Caipora.sh"/"Curupira.sh" trash mobs once those became real allies.
 */
const ENEMY_REGISTRY: Record<WorldId, WorldEnemyData> = {
  jurupari: jurupariEnemies as WorldEnemyData,
  duat: duatEnemies as WorldEnemyData,
  orun: orunEnemies as WorldEnemyData,
  takamagahara: takamagaharaEnemies as WorldEnemyData,
  olympus: olympusEnemies as WorldEnemyData,
  yggdrasil: yggdrasilEnemies as WorldEnemyData,
};

/**
 * Builds a wave of `count` comuns enemies for the given world, cycling
 * through its 3 archetypes and repeating (with unique ids, e.g.
 * `script-kiddie#2`) once `count` exceeds 3 — see progression.ts's
 * enemyCountRange for how many a given estágio should roll. `statMultiplier`
 * applies the per-estágio + per-world scaling (progression.ts's
 * difficultyMultiplier) and — since a player's owned team can be smaller
 * than the original 4-character baseline these were calibrated against —
 * teamSizeMultiplier.
 */
export function loadWorldComuns(worldId: WorldId, count: number, statMultiplier: number = 1): Combatant[] {
  const archetypes = ENEMY_REGISTRY[worldId].comuns;
  const seenCount = new Array<number>(archetypes.length).fill(0);
  const wave: Combatant[] = [];
  for (let i = 0; i < count; i++) {
    const archetypeIndex = i % archetypes.length;
    const occurrence = seenCount[archetypeIndex]++;
    const idSuffix = occurrence > 0 ? String(occurrence + 1) : undefined;
    wave.push(buildCombatant(archetypes[archetypeIndex], false, 0, statMultiplier, idSuffix));
  }
  return wave;
}

/** The given world's boss. `statMultiplier` — see loadWorldComuns. */
export function loadWorldBoss(worldId: WorldId, statMultiplier: number = 1): Combatant[] {
  return [buildCombatant(ENEMY_REGISTRY[worldId].boss, false, 0, statMultiplier)];
}

/** The original Jurupari.iso comuns loader, still used by the CLI demo and existing tests. */
export function loadJurupariComuns(count: number, statMultiplier: number = 1): Combatant[] {
  return loadWorldComuns('jurupari', count, statMultiplier);
}

/** Anhangá.exe, Jurupari.iso's boss — still used by the CLI demo and existing tests. */
export function loadJurupariBoss(statMultiplier: number = 1): Combatant[] {
  return loadWorldBoss('jurupari', statMultiplier);
}
