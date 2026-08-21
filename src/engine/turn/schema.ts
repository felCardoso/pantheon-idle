import type { StatusDurationTable } from '../schema';
import type { ModuleBonuses } from '../core/modules';
import type { Rarity } from '../schema';
import type { Row } from './types';

/**
 * Turn-engine-only content/config types. Everything genuinely shared with PvE (AbilityDefinition,
 * AbilityEffect, Magnitude, TargetSelector, StatusType) stays in ../schema.ts and is reused
 * verbatim — see src/engine/turn/loader.ts and abilityEngine.ts for how.
 */

/**
 * Same shape as core/schema.ts's StatusDurationTable, but every value is a count of ROUNDS, not
 * seconds — the turn engine's statuses age down once per phase-entry (src/engine/turn/roundLoop.ts),
 * not on a real clock. Kept as a type alias rather than a duplicate interface so the two can never
 * drift on which statuses exist.
 */
export type TurnStatusDurationTable = StatusDurationTable;

/**
 * Mirrors core/loader.ts's OwnedCharacterEntry, plus the turn engine's own formation concept —
 * which row (src/engine/turn/types.ts's Row) this character is assigned to for this battle.
 */
export interface TurnOwnedCharacterEntry {
  id: string;
  xp: number;
  rarity?: Rarity;
  modules?: ModuleBonuses;
  /** Falls back to turnCharacterKits.json's entry for this character, if any, else basic-attack-only. */
  selectedAbilityId?: string;
  version?: number;
  row: Row;
}
