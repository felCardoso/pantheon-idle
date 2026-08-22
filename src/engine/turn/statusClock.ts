import { isStunned, tickStatuses } from '../core/statusEffects';
import type { TurnBattleLogEntry, TurnCombatant } from './types';

/**
 * Turn-native sibling of core/statusEffects.ts's tickStatuses: ages every status on `unit` by
 * exactly one round.
 *
 * tickStatuses(unit, deltaSeconds) already does exactly "advance by one whole unit" when called
 * with deltaSeconds = 1 — a DOT/HOT's tickAccumulator starts at 0, so a single call pays out
 * exactly one tick and every duration counts down by exactly 1. Turn-mode content always authors
 * durations as whole-round integers (never core's 'default' seconds sentinel — see
 * src/engine/data/turnAbilities.json), so this is a genuine reuse, not a coincidence: no new
 * ticking math is needed, only a turn-shaped wrapper that logs into a TurnBattleLogEntry stream.
 *
 * Crash (stun) is the one status this does NOT rely on for removal — see roundLoop.ts's
 * consumeStunIfAny, which strips it the instant it blocks a turn rather than waiting for its
 * round-count to run out. That sidesteps an ordering problem a pure countdown would have: a stun
 * applied during the Ally Phase must block the very next Enemy Phase (same round), while a stun
 * applied during the Enemy Phase must block the next Ally Phase (following round) — two different
 * numbers of "phase entries" for what a player would call the same "1 round" of stun. Consuming it
 * on first use makes both cases "blocks exactly your next turn," with no phase-parity math.
 */
export function advanceOneRound(unit: TurnCombatant, round: number, log: (entry: TurnBattleLogEntry) => void): void {
  // Crash is excluded from this generic countdown — see the module comment above. Pulled out
  // before ticking and put back untouched afterward, so DOT/HOT and every other status still
  // ages normally.
  const crashInstances = unit.statuses.filter((s) => s.status === 'crash');
  unit.statuses = unit.statuses.filter((s) => s.status !== 'crash');

  const { ticks, expired } = tickStatuses(unit, 1);
  unit.statuses = [...unit.statuses, ...crashInstances];

  for (const tick of ticks) {
    log({ at: round, kind: 'statusTick', target: unit.name, status: tick.status, amount: tick.amount, tickKind: tick.kind, shieldAbsorbed: tick.shieldAbsorbed });
  }
  for (const status of expired) {
    log({ at: round, kind: 'statusExpired', target: unit.name, status });
  }
}

export { isStunned };
