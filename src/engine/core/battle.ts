import type { BattleLogEntry, Combatant } from './types';
import { Rng } from './rng';
import { CONSTANTS } from './loader';
import { resolveAttack } from './damage';
import { effectiveIce, endOfRoundTick, isStunned } from './statusEffects';
import { fireDeath as fireDeathTrigger, fireTrigger, maybeFireHalfHp as maybeFireHalfHpTrigger, maybeFireShieldBreak as maybeFireShieldBreakTrigger, type TriggerContext } from './abilityEngine';
import { computeTurnOrder } from './turnOrder';

export interface BattleOptions {
  seed?: number;
}

export interface BattleResult {
  winner: 'allies' | 'enemies' | 'draw';
  reason: 'elimination' | 'roundLimit';
  rounds: number;
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
 * Runs one full battle (docs/mvp.md + combate.md rules): INI-ordered rounds,
 * the documented damage pipeline, ability triggers, status effects with
 * durations, and the anti-infinite-round safeguard.
 */
export function runBattle(allies: Combatant[], enemies: Combatant[], options: BattleOptions = {}): BattleResult {
  const rng = new Rng(options.seed ?? Date.now());
  const log: BattleLogEntry[] = [];
  const pushLog = (entry: BattleLogEntry) => log.push(entry);
  const allUnits = [...allies, ...enemies];

  const teamsOf = (unit: Combatant): { own: Combatant[]; opposing: Combatant[] } => {
    const isAlly = allies.includes(unit);
    return { own: isAlly ? allies : enemies, opposing: isAlly ? enemies : allies };
  };

  // Thin wrappers around abilityEngine's shared onDeath/onHalfHp/onShieldBreak firers (also used
  // by the directDamage ability effect), just filling in this battle's own team-lookup + rng/log.
  const fireDeath = (unit: Combatant) => {
    const { own, opposing } = teamsOf(unit);
    fireDeathTrigger(unit, own, opposing, rng, pushLog);
  };
  const maybeFireHalfHp = (unit: Combatant) => {
    const { own, opposing } = teamsOf(unit);
    maybeFireHalfHpTrigger(unit, own, opposing, rng, pushLog);
  };
  const maybeFireShieldBreak = (unit: Combatant, shieldBefore: number) => {
    const { own, opposing } = teamsOf(unit);
    maybeFireShieldBreakTrigger(unit, shieldBefore, own, opposing, rng, pushLog);
  };

  pushLog({ kind: 'battleStart' });
  for (const unit of allUnits) {
    const { own, opposing } = teamsOf(unit);
    const ctx: TriggerContext = { self: unit, allies: own, enemies: opposing, rng, log: pushLog };
    fireTrigger('battleStart', ctx);
  }

  let winner: 'allies' | 'enemies' | 'draw' | null = checkVictory(allies, enemies);
  let reason: 'elimination' | 'roundLimit' = 'elimination';
  let round = 0;

  while (winner === null) {
    round += 1;
    pushLog({ kind: 'roundStart', round });

    for (const unit of computeTurnOrder(allUnits)) {
      if (unit.hp <= 0) continue; // died earlier this round, action cancelled

      const { own, opposing } = teamsOf(unit);
      const livingOpponents = opposing.filter((c) => c.hp > 0);
      if (livingOpponents.length === 0) break;

      if (isStunned(unit)) {
        pushLog({ kind: 'turnSkippedStun', unit: unit.name });
      } else {
        const defender = rng.pick(livingOpponents);
        const defenderShieldBefore = defender.shield;
        const result = resolveAttack(unit, defender, rng);

        if (result.dodged) {
          pushLog({ kind: 'dodge', attacker: unit.name, defender: defender.name });
        } else {
          pushLog({ kind: 'attack', result });
          maybeFireShieldBreak(defender, defenderShieldBefore);
          maybeFireHalfHp(defender);
          if (result.defenderDied) {
            pushLog({ kind: 'death', unit: defender.name });
            fireDeath(defender);
          }

          const attackCtx: TriggerContext = {
            self: unit,
            allies: own,
            enemies: opposing,
            rng,
            log: pushLog,
            defender,
            attackResult: result,
          };
          fireTrigger('onAttack', attackCtx);
          if (result.crit) fireTrigger('onCriticalHit', attackCtx);

          // "quando aliado ataca" — broadcast to unit's own living allies (unit itself already got onAttack above).
          for (const ally of own.filter((a) => a !== unit && a.hp > 0)) {
            fireTrigger('onAllyAttack', { self: ally, allies: own, enemies: opposing, rng, log: pushLog, attacker: unit, defender, attackResult: result });
          }

          fireTrigger('onDamaged', {
            self: defender,
            allies: opposing,
            enemies: own,
            rng,
            log: pushLog,
            attacker: unit,
            attackResult: result,
          });

          // ICE: reflects a fraction of the physical damage the defender just received back onto
          // the attacker — fires as part of *receiving* the hit, not as the defender's own turn,
          // so it still applies even when the defender died from this blow (their own retaliation
          // is what gets cancelled by death, not ICE).
          const iceFraction = effectiveIce(defender);
          if (result.finalDamage > 0 && iceFraction > 0) {
            const reflected = result.finalDamage * iceFraction;
            const unitShieldBefore = unit.shield;
            let iceShieldAbsorbed = 0;
            let iceHpDamage = reflected;
            if (unit.shield > 0) {
              iceShieldAbsorbed = Math.min(unit.shield, reflected);
              unit.shield -= iceShieldAbsorbed;
              iceHpDamage = reflected - iceShieldAbsorbed;
            }
            unit.hp = Math.max(0, unit.hp - iceHpDamage);
            maybeFireShieldBreak(unit, unitShieldBefore);
            maybeFireHalfHp(unit);
            const targetDied = unit.hp <= 0;
            pushLog({
              kind: 'iceReflect',
              source: defender.name,
              target: unit.name,
              amount: reflected,
              shieldAbsorbed: iceShieldAbsorbed,
              hpDamage: iceHpDamage,
              targetDied,
            });
            if (targetDied) {
              pushLog({ kind: 'death', unit: unit.name });
              fireDeath(unit);
            }
          }
        }
      }

      winner = checkVictory(allies, enemies);
      if (winner) break;
    }

    if (winner) break;

    for (const unit of allUnits) {
      if (unit.hp <= 0) continue;
      const shieldBefore = unit.shield;
      const { ticks, expired } = endOfRoundTick(unit);
      for (const tick of ticks) {
        pushLog({
          kind: 'statusTick',
          target: unit.name,
          status: tick.status,
          amount: tick.amount,
          tickKind: tick.kind,
          shieldAbsorbed: tick.shieldAbsorbed,
        });
      }
      for (const status of expired) pushLog({ kind: 'statusExpired', target: unit.name, status });
      maybeFireShieldBreak(unit, shieldBefore);
      maybeFireHalfHp(unit);
      if (unit.hp <= 0) {
        pushLog({ kind: 'death', unit: unit.name });
        fireDeath(unit);
      }
    }

    winner = checkVictory(allies, enemies);
    if (winner) break;

    const { roundLimit, enrageStartRound, enrageBasePercent } = CONSTANTS.antiInfiniteRound;
    if (round >= enrageStartRound) {
      const percent = enrageBasePercent * Math.pow(2, round - enrageStartRound);
      const damages = allUnits
        .filter((unit) => unit.hp > 0)
        .map((unit) => ({ target: unit.name, amount: Math.min(unit.hp, Math.round(unit.maxHp * percent)) }));
      pushLog({ kind: 'enrage', round, percent, damages });
      for (const unit of allUnits) {
        if (unit.hp <= 0) continue;
        const trueDamage = Math.round(unit.maxHp * percent);
        unit.hp = Math.max(0, unit.hp - trueDamage);
        maybeFireHalfHp(unit);
        if (unit.hp <= 0) {
          pushLog({ kind: 'death', unit: unit.name });
          fireDeath(unit);
        }
      }
      winner = checkVictory(allies, enemies);
      if (winner) break;
    }

    if (round >= roundLimit) {
      winner = decideByRemainingHp(allies, enemies);
      reason = 'roundLimit';
      break;
    }
  }

  pushLog({ kind: 'battleEnd', winner, reason });
  return { winner, reason, rounds: round, log, allies, enemies };
}
