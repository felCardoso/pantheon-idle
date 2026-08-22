// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the source.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import type { AbilityDefinition, StatusType } from '../schema.ts';
import type { AttackResult, Combatant } from '../core/types.ts';

/**
 * Turn engine data model (src/engine/index.ts's turn-mode export section) — shared by
 * interactive PvP and auto-played PvE (see roundLoop.ts's runAutoTurnBattle). The legacy
 * real-time engine (core/battle.ts) stays untouched alongside it.
 *
 * Rounds and phases, not real time: a round is an Ally Phase (the attacking player activates
 * each of their own living units, one at a time, in whatever order they choose) followed by an
 * Enemy Phase (the defending side's AI activates its own living units in its own chosen order).
 * See src/engine/turn/roundLoop.ts for the state machine this feeds.
 */

export type Row = 'front' | 'back';

/**
 * A unit mid-channel on a multi-round ability (AbilityDefinition.channelRounds). Set the instant
 * the ability is activated; the unit takes no other action while charging. `ability`/`targetId`
 * are captured at activation time so the effects can resolve against the original choice once
 * the channel completes, even though the battle state may have moved on by then (e.g. the
 * original target changed row) — src/engine/turn/roundLoop.ts re-resolves `targetId` to whichever
 * living combatant currently holds that id, or drops the effect if it died first.
 */
export interface ChargeState {
  ability: AbilityDefinition;
  targetId: string | null;
  roundsRemaining: number;
}

/**
 * A combatant in the turn engine. Deliberately a structural SUPERSET of Combatant (not a fork):
 * every handler in core/effects.ts, core/targeting.ts, core/statusEffects.ts and core/damage.ts
 * only ever reads/writes fields Combatant already declares, so all of them run unmodified against
 * TurnCombatant[] — a TurnCombatant is assignable wherever a Combatant is expected. The real-time
 * fields (attackCooldownRemaining, abilityCooldownRemaining, isVanguard, cleanseCooldownRemaining)
 * stay present but inert (0/false/{}) since nothing in the turn engine reads them.
 */
export interface TurnCombatant extends Combatant {
  row: Row;
  charging: ChargeState | null;
  /** Reset to false at the start of every round this unit is alive for (see roundLoop.ts). */
  hasActedThisRound: boolean;
}

export function isTurnAlive(c: TurnCombatant): boolean {
  return c.hp > 0;
}

export type TurnPhase = 'allyTurn' | 'enemyTurn';

/** One unit's action for its turn — 'basicAttack' resolves via core/damage.ts's resolveAttack directly; 'ability' activates the unit's single equipped active ability (src/engine/turn/abilityEngine.ts's activateAbility). `targetId` is required for basicAttack and for any ability whose effects target 'chosenTarget'; omitted otherwise (e.g. an ability that only ever targets allEnemies/self). */
export interface TurnAction {
  type: 'basicAttack' | 'ability';
  targetId?: string;
}

/**
 * Turn-native counterpart to core/types.ts's BattleLogEntry. `at` is a round number (not
 * seconds) — reuses the same shared variants that carry over unchanged (attack, dodge, status*,
 * heal, shieldGranted, directDamage, iceReflect, death, battleEnd) and adds the turn-native ones.
 */
export type TurnBattleLogEntry = { at: number } & (
  | { kind: 'battleStart' }
  | { kind: 'roundStart'; round: number }
  | { kind: 'turnStart'; unit: string; side: 'allies' | 'enemies' }
  | { kind: 'abilityUsed'; unit: string; abilityId: string; abilityName: string; scope: 'active' | 'bench' | 'passive' }
  | { kind: 'turnSkippedStun'; unit: string }
  | { kind: 'channelStart'; unit: string; abilityId: string; roundsRemaining: number }
  | { kind: 'channelContinue'; unit: string; roundsRemaining: number }
  | { kind: 'channelResolved'; unit: string; abilityId: string }
  | { kind: 'attack'; result: AttackResult }
  | { kind: 'dodge'; attacker: string; defender: string }
  | { kind: 'statusApplied'; target: string; status: StatusType; source: string; seconds: number | null }
  | { kind: 'statusTick'; target: string; status: StatusType; amount: number; tickKind: 'damage' | 'heal'; shieldAbsorbed: number }
  | { kind: 'statusExpired'; target: string; status: StatusType }
  | { kind: 'heal'; target: string; amount: number; source: string }
  | { kind: 'shieldGranted'; target: string; amount: number; source: string }
  | { kind: 'directDamage'; target: string; source: string; amount: number; shieldAbsorbed: number; hpDamage: number; targetDied: boolean }
  | { kind: 'iceReflect'; source: string; target: string; amount: number; shieldAbsorbed: number; hpDamage: number; targetDied: boolean }
  | { kind: 'death'; unit: string }
  | { kind: 'battleEnd'; winner: 'allies' | 'enemies' | 'draw'; reason: 'elimination' | 'roundLimit' }
);
