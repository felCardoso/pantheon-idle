import type { AbilityDefinition, CombatantData, Rarity } from '../schema';
import { atLevel, passiveAbilityFor, resolveCombatantBaseStats, resolvePassiveUnlock, synergyBonusFor } from '../core/loader';
import { NO_MODULE_BONUSES, type ModuleBonuses } from '../core/modules';
import type { WorldId } from '../core/progression';
import { ALL_CHARACTER_DATA, TURN_ABILITIES, TURN_CHARACTER_KITS, WORLD_ENEMIES } from '../data';
import type { TurnOwnedCharacterEntry } from './schema';
import type { Row, TurnCombatant } from './types';

/**
 * Turn-mode's own character/ability loader — mirrors core/loader.ts's loadCharactersByIds/
 * loadWorldComuns/loadWorldBoss (same mythology-synergy grouping, same stat math via
 * resolveCombatantBaseStats) but resolves a different ability set (turnAbilities.json/
 * turnCharacterKits.json, see below) and builds the TurnCombatant shape instead of Combatant
 * (row/charging/hasActedThisRound, no Vanguard/cooldown fields).
 *
 * Turn-mode actives are NOT the character's real-time activeOptions: those fire automatically off
 * the Vanguard's attack cadence (onAttack etc.), a model that doesn't exist once every unit acts
 * on its own turn by direct choice — see docs/combate.md's real-time trigger vocabulary vs.
 * src/engine/turn/abilityEngine.ts's activateAbility. A character with no turnCharacterKits.json
 * entry simply has no active ability and only ever basic-attacks — a graceful fallback, not an
 * error, since authoring a turn kit for every character is follow-up content work, not required
 * for the engine to function.
 */

const CHARACTER_REGISTRY: Record<string, CombatantData> = Object.fromEntries(ALL_CHARACTER_DATA.map((c) => [c.id, c]));
const TURN_ABILITY_REGISTRY: Record<string, AbilityDefinition> = Object.fromEntries(TURN_ABILITIES.map((a) => [a.id, a]));
const TURN_KIT_BY_CHARACTER: Record<string, { activeAbilityId?: string; passiveAbilityId?: string }> = Object.fromEntries(
  TURN_CHARACTER_KITS.map((k) => [k.characterId, k]),
);

interface WorldEnemyData {
  comuns: CombatantData[];
  boss: CombatantData;
}
const ENEMY_REGISTRY = WORLD_ENEMIES as Record<WorldId, WorldEnemyData>;

function resolveTurnAbility(id: string): AbilityDefinition {
  const def = TURN_ABILITY_REGISTRY[id];
  if (!def) throw new Error(`Unknown turn ability id: ${id}`);
  return def;
}

/** `level` is the player's bought active-ability level (Upgrades screen) — applied the same way core/loader.ts's buildCombatant applies it in real-time, so that purchase isn't inert in turn mode. */
function turnActiveAbilities(templateId: string, selectedAbilityId?: string, level = 1): AbilityDefinition[] {
  const id = selectedAbilityId ?? TURN_KIT_BY_CHARACTER[templateId]?.activeAbilityId;
  return id ? [atLevel(resolveTurnAbility(id), level)] : [];
}

/** Turn-only reactive passive (turnCharacterKits.json) if authored, else the character's ordinary PvE passive (abilities.json, reused verbatim) — either way gated by the same rarity/version unlock rule (allies only — see turnEnemyPassiveAbilities for enemies, which bypass this gate) and scaled by the player's bought passive level. */
function turnAllyPassiveAbilities(data: CombatantData, rarity?: Rarity, version?: number, level = 1): AbilityDefinition[] {
  if (!resolvePassiveUnlock(data, rarity, version)) return [];
  const kitPassiveId = TURN_KIT_BY_CHARACTER[data.id]?.passiveAbilityId;
  const passive = kitPassiveId ? resolveTurnAbility(kitPassiveId) : passiveAbilityFor(data.id);
  return passive ? [atLevel(passive, level)] : [];
}

/** Enemies bypass the rarity/version gate entirely (they have neither) — mirrors core/loader.ts's resolveCombatantAbilities: "enemies bypass the rarity gate". No enemy template is currently authored with a passiveAbilityId, but this stays correct if one ever is. */
function turnEnemyPassiveAbilities(data: CombatantData): AbilityDefinition[] {
  const kitPassiveId = TURN_KIT_BY_CHARACTER[data.id]?.passiveAbilityId;
  const passive = kitPassiveId ? resolveTurnAbility(kitPassiveId) : passiveAbilityFor(data.id);
  return passive ? [passive] : [];
}

function buildTurnCombatant(
  data: CombatantData,
  isAlly: boolean,
  synergyBonus: number,
  statMultiplier: number,
  modules: ModuleBonuses,
  activeAbilities: AbilityDefinition[],
  passiveAbilities: AbilityDefinition[],
  row: Row,
  idSuffix?: string,
): TurnCombatant {
  const { hp, atk, def, vel, esq, ice } = resolveCombatantBaseStats(data, synergyBonus, statMultiplier, modules);
  return {
    id: idSuffix ? `${data.id}#${idSuffix}` : data.id,
    templateId: data.id,
    name: data.name,
    faction: data.faction,
    isAlly,
    stars: data.stars ?? 0,
    level: 0,
    base: { hp, atk, def, vel, esq, ice },
    maxHp: hp,
    hp,
    shield: Math.round(hp * modules.initialShieldPercent),
    statuses: [],
    activeAbilities,
    benchAbilities: [],
    passiveAbilities,
    statusDurationBonus: data.statusDurationBonus ?? 0,
    halfHpTriggered: false,
    // Real-time-only fields — never read by the turn engine, present only because TurnCombatant
    // is a structural superset of Combatant (see types.ts).
    attackCooldownRemaining: 0,
    abilityCooldownRemaining: {},
    isVanguard: false,
    modules,
    revived: false,
    cleanseCooldownRemaining: 0,
    // Turn-native fields.
    row,
    charging: null,
    hasActedThisRound: false,
  };
}

/** Builds a team from owned/leveled player characters (allies — either side of a PvP match, or the player's own PvE squad). Order is preserved; each id may appear at most once. */
export function loadTurnCombatantsByIds(entries: TurnOwnedCharacterEntry[]): TurnCombatant[] {
  const dataByEntry = entries.map((entry) => {
    const data = CHARACTER_REGISTRY[entry.id];
    if (!data) throw new Error(`Unknown character id: ${entry.id}`);
    return { entry, data };
  });

  const countByMythology = new Map<string, number>();
  for (const { data } of dataByEntry) {
    const key = data.mythology ?? 'Desconhecida';
    countByMythology.set(key, (countByMythology.get(key) ?? 0) + 1);
  }

  return dataByEntry.map(({ entry, data }) => {
    const key = data.mythology ?? 'Desconhecida';
    const synergyBonus = synergyBonusFor(countByMythology.get(key)!);
    const modules = entry.modules ?? NO_MODULE_BONUSES;
    return buildTurnCombatant(
      data,
      true,
      synergyBonus,
      1,
      modules,
      turnActiveAbilities(data.id, entry.selectedAbilityId, entry.levels?.active),
      turnAllyPassiveAbilities(data, entry.rarity, entry.version, entry.levels?.passive),
      entry.row,
    );
  });
}

/**
 * A wave of `count` PvE common enemies for `worldId`, cycling through its 3 archetypes and
 * repeating (with unique ids, e.g. `script-kiddie#2`) once `count` exceeds 3 — mirrors
 * core/loader.ts's loadWorldComuns exactly, including its statMultiplier (per-estágio/per-world
 * difficulty scaling from progression.ts), just building TurnCombatant via the turn-mode kit
 * lookup instead of the real-time one. Enemies never get a mythology synergy bonus (isAlly false)
 * and never carry equipped modules (they're scripts, not owned characters) — same as real-time.
 * `row` assigns formation per archetype slot (0/1/2 within the 3-archetype cycle); a world without
 * an explicit assignment defaults every enemy to 'front'.
 */
export function loadTurnWorldComuns(worldId: WorldId, count: number, statMultiplier: number = 1, rowForSlot: (slot: number) => Row = () => 'front'): TurnCombatant[] {
  const archetypes = ENEMY_REGISTRY[worldId].comuns;
  const seenCount = new Array<number>(archetypes.length).fill(0);
  const wave: TurnCombatant[] = [];
  for (let i = 0; i < count; i++) {
    const archetypeIndex = i % archetypes.length;
    const occurrence = seenCount[archetypeIndex]++;
    const idSuffix = occurrence > 0 ? String(occurrence + 1) : undefined;
    const data = archetypes[archetypeIndex];
    wave.push(
      buildTurnCombatant(
        data,
        false,
        0,
        statMultiplier,
        NO_MODULE_BONUSES,
        turnActiveAbilities(data.id),
        turnEnemyPassiveAbilities(data),
        rowForSlot(archetypeIndex),
        idSuffix,
      ),
    );
  }
  return wave;
}

/** The given world's boss, as a single-unit TurnCombatant array (matches core/loader.ts's loadWorldBoss shape). Always front row — a lone boss has no formation to speak of. */
export function loadTurnWorldBoss(worldId: WorldId, statMultiplier: number = 1): TurnCombatant[] {
  const data = ENEMY_REGISTRY[worldId].boss;
  return [buildTurnCombatant(data, false, 0, statMultiplier, NO_MODULE_BONUSES, turnActiveAbilities(data.id), turnEnemyPassiveAbilities(data), 'front')];
}
