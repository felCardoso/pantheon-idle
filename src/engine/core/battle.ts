import type { BattleLogEntry, Combatant } from './types';
import { Rng } from './rng';
import { CONSTANTS } from './loader';
import { attackIntervalFor } from '../schema';
import { resolveAttack } from './damage';
import { absorbIntoShield, detachBenchStatuses, effectiveIce, effectiveVel, isStunned, tickStatuses } from './statusEffects';
import {
  fireAbility,
  fireDeath as fireDeathTrigger,
  fireOnKill as fireOnKillTrigger,
  fireOnWounded as fireOnWoundedTrigger,
  fireTrigger,
  maybeFireHalfHp as maybeFireHalfHpTrigger,
  maybeFireShieldBreak as maybeFireShieldBreakTrigger,
  type TriggerContext,
} from './abilityEngine';

export interface BattleOptions {
  seed?: number;
}

export interface BattleResult {
  winner: 'allies' | 'enemies' | 'draw';
  reason: 'elimination' | 'timeLimit';
  /** Simulated duration in seconds. */
  duration: number;
  log: BattleLogEntry[];
  allies: Combatant[];
  enemies: Combatant[];
}

export function checkVictory(allies: Combatant[], enemies: Combatant[]): 'allies' | 'enemies' | 'draw' | null {
  const alliesAlive = allies.some((c) => c.hp > 0);
  const enemiesAlive = enemies.some((c) => c.hp > 0);
  if (!alliesAlive && !enemiesAlive) return 'draw';
  if (!enemiesAlive) return 'allies';
  if (!alliesAlive) return 'enemies';
  return null;
}

export function decideByRemainingHp(allies: Combatant[], enemies: Combatant[]): 'allies' | 'enemies' | 'draw' {
  const pct = (team: Combatant[]) => {
    const totalMax = team.reduce((sum, c) => sum + c.maxHp, 0);
    const totalHp = team.reduce((sum, c) => sum + c.hp, 0);
    return totalMax === 0 ? 0 : totalHp / totalMax;
  };
  const alliesPct = pct(allies);
  const enemiesPct = pct(enemies);
  if (alliesPct === enemiesPct) return 'draw';
  return alliesPct > enemiesPct ? 'allies' : 'enemies';
}

/**
 * Runs one full battle per docs/combate.md v3.1 — Relay & Bench, real-time
 * continuous.
 *
 * There are no turns, rounds or initiative order. The simulation advances in
 * fixed ticks (CONSTANTS.tickSeconds); each side's Vanguard (first living unit
 * in its queue) attacks whenever its own VEL-derived cooldown elapses, and the
 * four benched units never attack or take damage — they only hold buffs on
 * their own Vanguard. A Vanguard reaching 0 HP is ejected and the next unit in
 * the queue takes over immediately.
 */
export function runBattle(allies: Combatant[], enemies: Combatant[], options: BattleOptions = {}): BattleResult {
  const rng = new Rng(options.seed ?? Date.now());
  const log: BattleLogEntry[] = [];
  const allUnits = [...allies, ...enemies];
  const { tickSeconds, antiInfinite } = CONSTANTS;

  let now = 0;
  const pushLog = (entry: BattleLogEntry) => log.push(entry);

  const teamsOf = (unit: Combatant): { own: Combatant[]; opposing: Combatant[] } =>
    allies.includes(unit) ? { own: allies, opposing: enemies } : { own: enemies, opposing: allies };

  const vanguardOf = (queue: Combatant[]): Combatant | undefined => queue.find((c) => c.hp > 0);

  const ctxFor = (unit: Combatant, extra: Partial<TriggerContext> = {}): TriggerContext => {
    const { own, opposing } = teamsOf(unit);
    return { self: unit, allies: own, enemies: opposing, rng, log: pushLog, now, ...extra };
  };

  // Thin wrappers filling in this battle's team lookup + clock.
  const fireDeath = (unit: Combatant) => {
    const { own, opposing } = teamsOf(unit);
    fireDeathTrigger(unit, own, opposing, rng, pushLog, now);
  };
  const maybeFireHalfHp = (unit: Combatant) => {
    const { own, opposing } = teamsOf(unit);
    maybeFireHalfHpTrigger(unit, own, opposing, rng, pushLog, now);
  };
  const maybeFireShieldBreak = (unit: Combatant, shieldBefore: number) => {
    const { own, opposing } = teamsOf(unit);
    maybeFireShieldBreakTrigger(unit, shieldBefore, own, opposing, rng, pushLog, now);
  };
  const fireOnWounded = (unit: Combatant) => {
    const { own, opposing } = teamsOf(unit);
    fireOnWoundedTrigger(unit, own, opposing, rng, pushLog, now);
  };
  const fireOnKill = (unit: Combatant) => {
    const { own, opposing } = teamsOf(unit);
    fireOnKillTrigger(unit, own, opposing, rng, pushLog, now);
  };

  /**
   * Reattaches every benched unit's `constant` bench ability onto its side's
   * current Vanguard. Bench buffs are held open by their owner staying
   * benched (no timer — see abilityEngine's buffAttribute case), so they are
   * torn down and rebuilt whenever the Vanguard changes rather than ticking
   * down on their own.
   */
  function refreshBenchBuffs(queue: Combatant[]): void {
    const front = vanguardOf(queue);
    if (!front) return;
    for (const unit of queue) {
      if (unit.hp <= 0) continue;
      detachBenchStatuses(front, unit.id);
    }
    for (const unit of queue) {
      if (unit.hp <= 0 || unit === front) continue;
      for (const ability of unit.benchAbilities) {
        if (ability.trigger !== 'constant') continue;
        if (ability.chance !== undefined && !rng.chance(ability.chance)) continue;
        fireAbility(ability, ctxFor(unit, { benchSourceId: unit.id }));
      }
    }
  }

  /** Recomputes isVanguard for one side, emitting enter/exit and refreshing bench buffs when the front changes. */
  function syncVanguard(queue: Combatant[], side: 'allies' | 'enemies'): void {
    const front = vanguardOf(queue);
    let changed = false;
    for (const unit of queue) {
      const shouldBeVanguard = unit === front;
      if (unit.isVanguard === shouldBeVanguard) continue;
      changed = true;
      unit.isVanguard = shouldBeVanguard;
      if (shouldBeVanguard) {
        pushLog({ at: now, kind: 'vanguardEnter', unit: unit.name, side });
        // A unit rotating in starts its attack timer fresh, so a long-benched
        // reserve can't storm in with an instantly-ready attack.
        unit.attackCooldownRemaining = attackIntervalFor(effectiveVel(unit));
        fireTrigger('onVanguardEnter', ctxFor(unit));
      } else if (unit.hp > 0) {
        fireTrigger('onVanguardExit', ctxFor(unit));
      }
    }
    if (changed) refreshBenchBuffs(queue);
  }

  /** Ejects the dead, then re-seats each side's Vanguard. */
  function reconcile(): void {
    for (const [queue, side] of [
      [allies, 'allies'],
      [enemies, 'enemies'],
    ] as const) {
      const front = queue.find((c) => c.isVanguard);
      if (front && front.hp <= 0) {
        front.isVanguard = false;
        const next = vanguardOf(queue);
        pushLog({ at: now, kind: 'vanguardExit', unit: front.name, side, replacedBy: next?.name ?? null });
      }
      syncVanguard(queue, side);
    }
  }

  /** Resolves one attacker->defender exchange: the documented damage pipeline plus the full trigger cascade. */
  function performAttack(attacker: Combatant, defender: Combatant): void {
    fireTrigger('preAttack', ctxFor(attacker, { defender }));

    const defenderShieldBefore = defender.shield;
    const result = resolveAttack(attacker, defender, rng);

    if (result.dodged) {
      pushLog({ at: now, kind: 'dodge', attacker: attacker.name, defender: defender.name });
      fireTrigger('onDodge', ctxFor(defender, { attacker }));
      return;
    }

    pushLog({ at: now, kind: 'attack', result });
    maybeFireShieldBreak(defender, defenderShieldBefore);
    if (result.hpDamage > 0) fireOnWounded(defender);
    if (result.defenderDied) {
      pushLog({ at: now, kind: 'death', unit: defender.name });
      fireDeath(defender);
    } else {
      maybeFireHalfHp(defender);
    }

    const attackCtx = ctxFor(attacker, { defender, attackResult: result });
    fireTrigger('onAttack', attackCtx);
    if (result.crit) fireTrigger('onCriticalHit', attackCtx);

    // "quando aliado ataca" — the benched reserve reacting to their Vanguard's hit.
    const { own } = teamsOf(attacker);
    for (const ally of own.filter((a) => a !== attacker && a.hp > 0)) {
      fireTrigger('onAllyAttack', ctxFor(ally, { attacker, defender, attackResult: result }));
    }

    fireTrigger('onCounter', ctxFor(defender, { attacker, attackResult: result }));
    if (result.defenderDied) fireOnKill(attacker);

    // ICE: reflects a fraction of the physical damage the defender just
    // received back onto the attacker — fires as part of *receiving* the hit,
    // so it still applies even when the defender died from this blow.
    const iceFraction = effectiveIce(defender);
    if (result.finalDamage > 0 && iceFraction > 0) {
      const reflected = result.finalDamage * iceFraction;
      const attackerShieldBefore = attacker.shield;
      const { shieldAbsorbed: iceShieldAbsorbed, hpDamage: iceHpDamage } = absorbIntoShield(attacker, reflected);
      attacker.hp = Math.max(0, attacker.hp - iceHpDamage);
      maybeFireShieldBreak(attacker, attackerShieldBefore);
      if (iceHpDamage > 0) fireOnWounded(attacker);
      const targetDied = attacker.hp <= 0;
      pushLog({
        at: now,
        kind: 'iceReflect',
        source: defender.name,
        target: attacker.name,
        amount: reflected,
        shieldAbsorbed: iceShieldAbsorbed,
        hpDamage: iceHpDamage,
        targetDied,
      });
      if (targetDied) {
        pushLog({ at: now, kind: 'death', unit: attacker.name });
        fireDeath(attacker);
      } else {
        maybeFireHalfHp(attacker);
      }
    }

    if (attacker.hp > 0) {
      fireTrigger('postAttack', ctxFor(attacker, { defender, attackResult: result }));
    }
  }

  // ---- Boot Sequence -------------------------------------------------------
  pushLog({ at: 0, kind: 'battleStart' });
  for (const unit of allUnits) {
    unit.isVanguard = false;
    unit.attackCooldownRemaining = attackIntervalFor(effectiveVel(unit));
    unit.abilityCooldownRemaining = {};
  }
  syncVanguard(allies, 'allies');
  syncVanguard(enemies, 'enemies');

  for (const unit of allUnits) {
    fireTrigger('battleStart', ctxFor(unit));
  }
  // Bench buffs are attached after battleStart so opening abilities that swap
  // the front (or grant stats) are already reflected in what the bench sees.
  refreshBenchBuffs(allies);
  refreshBenchBuffs(enemies);

  let winner: 'allies' | 'enemies' | 'draw' | null = checkVictory(allies, enemies);
  let reason: 'elimination' | 'timeLimit' = 'elimination';
  let nextOverloadAt = antiInfinite.overloadStartSeconds;
  let overloadStep = 0;

  // ---- Simulation loop -----------------------------------------------------
  while (winner === null) {
    now = Math.round((now + tickSeconds) * 1000) / 1000;

    // 1. Status ticks (DOT/HOT pay out on whole-second boundaries).
    for (const unit of allUnits) {
      if (unit.hp <= 0) continue;
      const shieldBefore = unit.shield;
      const { ticks, expired } = tickStatuses(unit, tickSeconds);
      for (const tick of ticks) {
        pushLog({
          at: now,
          kind: 'statusTick',
          target: unit.name,
          status: tick.status,
          amount: tick.amount,
          tickKind: tick.kind,
          shieldAbsorbed: tick.shieldAbsorbed,
        });
      }
      for (const status of expired) pushLog({ at: now, kind: 'statusExpired', target: unit.name, status });
      if (ticks.length > 0) {
        maybeFireShieldBreak(unit, shieldBefore);
        if (ticks.some((t) => t.kind === 'damage' && t.amount - t.shieldAbsorbed > 0)) fireOnWounded(unit);
        maybeFireHalfHp(unit);
      }
      if (unit.hp <= 0) {
        pushLog({ at: now, kind: 'death', unit: unit.name });
        fireDeath(unit);
      }
    }
    reconcile();
    winner = checkVictory(allies, enemies);
    if (winner) break;

    // 2. Cooldown-driven abilities (the doc's "a cada N segundos" bosses).
    for (const unit of allUnits) {
      if (unit.hp <= 0) continue;
      for (const ability of unit.isVanguard ? unit.activeAbilities : unit.benchAbilities) {
        if (ability.trigger !== 'constant' || ability.cooldownSeconds === undefined) continue;
        const remaining = (unit.abilityCooldownRemaining[ability.id] ?? ability.cooldownSeconds) - tickSeconds;
        if (remaining > 0) {
          unit.abilityCooldownRemaining[ability.id] = remaining;
          continue;
        }
        unit.abilityCooldownRemaining[ability.id] = ability.cooldownSeconds;
        if (ability.chance !== undefined && !rng.chance(ability.chance)) continue;
        fireAbility(ability, ctxFor(unit));
      }
    }
    reconcile();
    winner = checkVictory(allies, enemies);
    if (winner) break;

    // 3. Vanguard basic attacks, gated by VEL.
    for (const [queue, opposing] of [
      [allies, enemies],
      [enemies, allies],
    ] as const) {
      const attacker = vanguardOf(queue);
      const defender = vanguardOf(opposing);
      if (!attacker || !defender) continue;

      attacker.attackCooldownRemaining -= tickSeconds;
      if (attacker.attackCooldownRemaining > 1e-9) continue;

      // Crash consumes the ready attack rather than banking it, so a stun
      // genuinely costs tempo instead of merely delaying a guaranteed hit.
      attacker.attackCooldownRemaining = attackIntervalFor(effectiveVel(attacker));
      if (isStunned(attacker)) {
        pushLog({ at: now, kind: 'attackBlockedStun', unit: attacker.name });
        continue;
      }
      performAttack(attacker, defender);
    }
    reconcile();
    winner = checkVictory(allies, enemies);
    if (winner) break;

    // 4. System Overload (§6) — absolute damage, ignores Firewall, every 5s from 30s.
    if (now >= nextOverloadAt - 1e-9) {
      overloadStep += 1;
      nextOverloadAt += antiInfinite.overloadIntervalSeconds;
      const percent = antiInfinite.overloadStepPercent * overloadStep;
      const living = allUnits.filter((u) => u.hp > 0);
      pushLog({
        at: now,
        kind: 'overload',
        percent,
        damages: living.map((u) => ({ target: u.name, amount: Math.min(u.hp, Math.round(u.maxHp * percent)) })),
      });
      for (const unit of living) {
        const trueDamage = Math.round(unit.maxHp * percent);
        unit.hp = Math.max(0, unit.hp - trueDamage);
        if (trueDamage > 0) fireOnWounded(unit);
        maybeFireHalfHp(unit);
        if (unit.hp <= 0) {
          pushLog({ at: now, kind: 'death', unit: unit.name });
          fireDeath(unit);
        }
      }
      reconcile();
      winner = checkVictory(allies, enemies);
      if (winner) break;
    }

    // 5. Hard stop (§6) — "encerrada à força pelo sistema por risco térmico".
    if (now >= antiInfinite.timeLimitSeconds - 1e-9) {
      winner = decideByRemainingHp(allies, enemies);
      reason = 'timeLimit';
      break;
    }
  }

  pushLog({ at: now, kind: 'battleEnd', winner, reason });
  return { winner, reason, duration: now, log, allies, enemies };
}
