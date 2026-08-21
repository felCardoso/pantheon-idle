// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the source.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import type { AbilityDefinition, CombatantData, Rarity } from '../schema.ts';
import { passiveAbilityFor, resolveCombatantBaseStats, resolvePassiveUnlock, synergyBonusFor } from '../core/loader.ts';
import { NO_MODULE_BONUSES } from '../core/modules.ts';
import { ALL_CHARACTER_DATA, TURN_ABILITIES, TURN_CHARACTER_KITS } from '../data/index.ts';
import type { TurnOwnedCharacterEntry } from './schema.ts';
import type { TurnCombatant } from './types.ts';

/**
 * Turn-mode's own character/ability loader — mirrors core/loader.ts's loadCharactersByIds
 * (same mythology-synergy grouping, same stat math via resolveCombatantBaseStats) but resolves a
 * different ability set (turnAbilities.json/turnCharacterKits.json, see below) and builds the
 * TurnCombatant shape instead of Combatant (row/charging/hasActedThisRound, no Vanguard/cooldown
 * fields).
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

function resolveTurnAbility(id: string): AbilityDefinition {
  const def = TURN_ABILITY_REGISTRY[id];
  if (!def) throw new Error(`Unknown turn ability id: ${id}`);
  return def;
}

function turnActiveAbilities(templateId: string, selectedAbilityId?: string): AbilityDefinition[] {
  const id = selectedAbilityId ?? TURN_KIT_BY_CHARACTER[templateId]?.activeAbilityId;
  return id ? [resolveTurnAbility(id)] : [];
}

/** Turn-only reactive passive (turnCharacterKits.json) if authored, else the character's ordinary PvE passive (abilities.json, reused verbatim) — either way gated by the same rarity/version unlock rule. */
function turnPassiveAbilities(data: CombatantData, rarity?: Rarity, version?: number): AbilityDefinition[] {
  if (!resolvePassiveUnlock(data, rarity, version)) return [];
  const kitPassiveId = TURN_KIT_BY_CHARACTER[data.id]?.passiveAbilityId;
  const passive = kitPassiveId ? resolveTurnAbility(kitPassiveId) : passiveAbilityFor(data.id);
  return passive ? [passive] : [];
}

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
    const { hp, atk, def, vel, esq, ice } = resolveCombatantBaseStats(data, synergyBonus, 1, modules);

    return {
      id: entry.id,
      templateId: data.id,
      name: data.name,
      faction: data.faction,
      isAlly: true,
      stars: data.stars ?? 0,
      level: 0,
      base: { hp, atk, def, vel, esq, ice },
      maxHp: hp,
      hp,
      shield: Math.round(hp * modules.initialShieldPercent),
      statuses: [],
      activeAbilities: turnActiveAbilities(data.id, entry.selectedAbilityId),
      benchAbilities: [],
      passiveAbilities: turnPassiveAbilities(data, entry.rarity, entry.version),
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
      row: entry.row,
      charging: null,
      hasActedThisRound: false,
    };
  });
}
