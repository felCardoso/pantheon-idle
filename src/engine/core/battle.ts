import type { BattleLogEntry, Combatant } from './types';
import { Rng } from './rng';
import { CONSTANTS } from './loader';
import { resolveAttack } from './damage';
import { absorbIntoShield, effectiveIce, effectiveIni, endOfRoundTick, isStunned } from './statusEffects';
import {
  fireDeath as fireDeathTrigger,
  fireOnKill as fireOnKillTrigger,
  fireOnWounded as fireOnWoundedTrigger,
  fireTrigger,
  maybeFireFrontAllyWounded as maybeFireFrontAllyWoundedTrigger,
  maybeFireHalfHp as maybeFireHalfHpTrigger,
  maybeFireShieldBreak as maybeFireShieldBreakTrigger,
  type TriggerContext,
} from './abilityEngine';

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

type ClashPriority = 'ally' | 'enemy' | 'tie';

/**
 * Who acts first in a line-up clash (docs/combate.md §2's Ping rule).
 * alwaysActsFirst (Saci.exe's passive) unconditionally wins its own clash —
 * "acts before the whole team" has no meaning once only 2 units act per
 * round, so it's reinterpreted as "wins Ping priority in its own clash."
 * `viaPing` is false whenever alwaysActsFirst decided it, since Ping
 * Advantage (docs/combate.md: "apenas se o personagem possuir um INI maior")
 * is specifically about a genuine Ping-stat win, not this override.
 */
function determineClashPriority(allyFront: Combatant, enemyFront: Combatant): { priority: ClashPriority; viaPing: boolean } {
  if (allyFront.alwaysActsFirst !== enemyFront.alwaysActsFirst) {
    return { priority: allyFront.alwaysActsFirst ? 'ally' : 'enemy', viaPing: false };
  }
  const allyIni = effectiveIni(allyFront);
  const enemyIni = effectiveIni(enemyFront);
  if (allyIni === enemyIni) return { priority: 'tie', viaPing: false };
  return { priority: allyIni > enemyIni ? 'ally' : 'enemy', viaPing: true };
}

/**
 * Runs one full battle per docs/combate.md (v2): line-up/queue clashes (front
 * of each side's queue fights, survivors requeue to their own back), the
 * documented damage pipeline, the full ability-trigger vocabulary, status
 * effects with durations, and the anti-infinite-round safeguard.
 */
export function runBattle(allies: Combatant[], enemies: Combatant[], options: BattleOptions = {}): BattleResult {
  const rng = new Rng(options.seed ?? Date.now());
  const log: BattleLogEntry[] = [];
  const pushLog = (entry: BattleLogEntry) => log.push(entry);
  const allUnits = [...allies, ...enemies];

  // The live line-up queues — front = index 0. These ARE what every
  // TriggerContext.allies/.enemies gets built from during a round, so queue
  // order doubles as "who's on my team" for every trigger/target resolution
  // (see abilityEngine.ts's TriggerContext doc comment).
  let allyQueue = allies.filter((c) => c.hp > 0);
  let enemyQueue = enemies.filter((c) => c.hp > 0);

  // `allies`/`enemies` (the original, never-reordered params) only ever
  // decide which side a unit started on — teamsOf always hands back the
  // CURRENT (possibly-rotated) queue for that side.
  const teamsOf = (unit: Combatant): { own: Combatant[]; opposing: Combatant[] } =>
    allies.includes(unit) ? { own: allyQueue, opposing: enemyQueue } : { own: enemyQueue, opposing: allyQueue };

  // Thin wrappers around abilityEngine's shared trigger firers, just filling in this battle's
  // own team-lookup + rng/log. Each of these also broadcasts its "quando aliado..." pair.
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
  const fireOnWounded = (unit: Combatant) => {
    const { own, opposing } = teamsOf(unit);
    fireOnWoundedTrigger(unit, own, opposing, rng, pushLog);
  };
  const fireOnKill = (unit: Combatant) => {
    const { own, opposing } = teamsOf(unit);
    fireOnKillTrigger(unit, own, opposing, rng, pushLog);
  };
  const maybeFireFrontAllyWounded = (unit: Combatant) => {
    const { own, opposing } = teamsOf(unit);
    maybeFireFrontAllyWoundedTrigger(unit, own, opposing, rng, pushLog);
  };

  pushLog({ kind: 'battleStart' });
  for (const unit of allUnits) {
    const { own, opposing } = teamsOf(unit);
    const ctx: TriggerContext = { self: unit, allies: own, enemies: opposing, rng, log: pushLog };
    fireTrigger('battleStart', ctx);
    fireTrigger('constant', ctx); // "Background Service" — always-on passives fire once here, same as battleStart.
  }

  /** Resolves one attacker->defender exchange: the documented damage pipeline plus the full trigger cascade. */
  function performAttack(attacker: Combatant, defender: Combatant): void {
    const { own, opposing } = teamsOf(attacker);
    const { own: defOwn, opposing: defOpposing } = teamsOf(defender);

    fireTrigger('preAttack', { self: attacker, allies: own, enemies: opposing, rng, log: pushLog, defender });

    const defenderShieldBefore = defender.shield;
    const result = resolveAttack(attacker, defender, rng);

    if (result.dodged) {
      pushLog({ kind: 'dodge', attacker: attacker.name, defender: defender.name });
      fireTrigger('onDodge', { self: defender, allies: defOwn, enemies: defOpposing, rng, log: pushLog, attacker });
      return;
    }

    pushLog({ kind: 'attack', result });
    maybeFireShieldBreak(defender, defenderShieldBefore);
    if (result.hpDamage > 0) fireOnWounded(defender);
    if (result.defenderDied) {
      pushLog({ kind: 'death', unit: defender.name });
      fireDeath(defender);
    } else {
      maybeFireHalfHp(defender);
    }

    const attackCtx: TriggerContext = { self: attacker, allies: own, enemies: opposing, rng, log: pushLog, defender, attackResult: result };
    fireTrigger('onAttack', attackCtx);
    if (result.crit) fireTrigger('onCriticalHit', attackCtx);

    // "quando aliado ataca" — broadcast to attacker's own living allies (attacker itself already got onAttack above).
    for (const ally of own.filter((a) => a !== attacker && a.hp > 0)) {
      fireTrigger('onAllyAttack', { self: ally, allies: own, enemies: opposing, rng, log: pushLog, attacker, defender, attackResult: result });
    }

    fireTrigger('onCounter', { self: defender, allies: defOwn, enemies: defOpposing, rng, log: pushLog, attacker, attackResult: result });
    if (result.defenderDied) fireOnKill(attacker);
    if (result.hpDamage > 0) maybeFireFrontAllyWounded(defender);

    // ICE: reflects a fraction of the physical damage the defender just received back onto
    // the attacker — fires as part of *receiving* the hit, not as the defender's own turn,
    // so it still applies even when the defender died from this blow (their own retaliation
    // is what gets cancelled by death, not ICE).
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
        kind: 'iceReflect',
        source: defender.name,
        target: attacker.name,
        amount: reflected,
        shieldAbsorbed: iceShieldAbsorbed,
        hpDamage: iceHpDamage,
        targetDied,
      });
      if (targetDied) {
        pushLog({ kind: 'death', unit: attacker.name });
        fireDeath(attacker);
      } else {
        maybeFireHalfHp(attacker);
      }
    }

    // "Post-Execution" — only if the attacker survived the whole exchange, including ICE reflect.
    if (attacker.hp > 0) {
      fireTrigger('postAttack', { self: attacker, allies: own, enemies: opposing, rng, log: pushLog, defender, attackResult: result });
    }
  }

  /** One line-up clash: front-of-queue vs front-of-queue. */
  function resolveClash(allyFront: Combatant, enemyFront: Combatant): void {
    const allyStunned = isStunned(allyFront);
    const enemyStunned = isStunned(enemyFront);
    if (allyStunned) pushLog({ kind: 'turnSkippedStun', unit: allyFront.name });
    if (enemyStunned) pushLog({ kind: 'turnSkippedStun', unit: enemyFront.name });

    if (allyStunned && enemyStunned) return;
    if (allyStunned) return void performAttack(enemyFront, allyFront);
    if (enemyStunned) return void performAttack(allyFront, enemyFront);

    const { priority, viaPing } = determineClashPriority(allyFront, enemyFront);
    if (priority === 'tie') {
      performAttack(allyFront, enemyFront);
      performAttack(enemyFront, allyFront);
      return;
    }

    const [winner, loser] = priority === 'ally' ? [allyFront, enemyFront] : [enemyFront, allyFront];
    if (viaPing) {
      const { own, opposing } = teamsOf(winner);
      pushLog({ kind: 'pingAdvantage', unit: winner.name });
      fireTrigger('onPingAdvantage', { self: winner, allies: own, enemies: opposing, rng, log: pushLog });
    }
    performAttack(winner, loser);
    if (loser.hp <= 0) {
      pushLog({ kind: 'actionCancelled', unit: loser.name });
    } else {
      performAttack(loser, winner);
    }
  }

  let winner: 'allies' | 'enemies' | 'draw' | null = checkVictory(allies, enemies);
  let reason: 'elimination' | 'roundLimit' = 'elimination';
  let round = 0;

  while (winner === null) {
    round += 1;
    pushLog({ kind: 'clashStart', round });

    for (const unit of allUnits) {
      if (unit.hp <= 0) continue;
      const { own, opposing } = teamsOf(unit);
      fireTrigger('roundStart', { self: unit, allies: own, enemies: opposing, rng, log: pushLog });
    }
    allyQueue = allyQueue.filter((c) => c.hp > 0);
    enemyQueue = enemyQueue.filter((c) => c.hp > 0);

    winner = checkVictory(allies, enemies);
    if (winner) break;

    const allyFront = allyQueue[0];
    const enemyFront = enemyQueue[0];
    resolveClash(allyFront, enemyFront);
    pushLog({ kind: 'clashEnd', allyUnit: allyFront.name, enemyUnit: enemyFront.name });

    allyQueue = allyQueue.filter((c) => c !== allyFront).concat(allyFront.hp > 0 ? [allyFront] : []);
    enemyQueue = enemyQueue.filter((c) => c !== enemyFront).concat(enemyFront.hp > 0 ? [enemyFront] : []);

    winner = checkVictory(allies, enemies);
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
      if (ticks.some((t) => t.kind === 'damage' && t.amount - t.shieldAbsorbed > 0)) fireOnWounded(unit);
      maybeFireHalfHp(unit);
      const { own, opposing } = teamsOf(unit);
      fireTrigger('roundEnd', { self: unit, allies: own, enemies: opposing, rng, log: pushLog });
      if (unit.hp <= 0) {
        pushLog({ kind: 'death', unit: unit.name });
        fireDeath(unit);
      }
    }
    allyQueue = allyQueue.filter((c) => c.hp > 0);
    enemyQueue = enemyQueue.filter((c) => c.hp > 0);

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
        if (trueDamage > 0) fireOnWounded(unit);
        maybeFireHalfHp(unit);
        if (unit.hp <= 0) {
          pushLog({ kind: 'death', unit: unit.name });
          fireDeath(unit);
        }
      }
      allyQueue = allyQueue.filter((c) => c.hp > 0);
      enemyQueue = enemyQueue.filter((c) => c.hp > 0);
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
