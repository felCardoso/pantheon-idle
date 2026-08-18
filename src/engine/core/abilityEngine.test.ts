import { describe, expect, it } from 'vitest';
import { fireDeath, fireOnWounded, fireTrigger, type TriggerContext } from './abilityEngine';
import { makeAbility, makeCombatant, ScriptedRng } from './testUtils';
import type { AttackResult } from './types';

function baseCtx(overrides: Partial<TriggerContext>): TriggerContext {
  return {
    self: makeCombatant(),
    allies: [],
    enemies: [],
    rng: new ScriptedRng([]),
    log: () => {},
    now: 0,
    ...overrides,
  };
}

describe('fireTrigger — Boitatá.exe-style counter (onCounter, % of base ATK, star scaling)', () => {
  const counterAbility = makeAbility({
    id: 'counter-trojan',
    trigger: 'onCounter',
    chance: 0.25,
    effects: [
      {
        type: 'applyStatus',
        target: 'attacker',
        status: 'trojan',
        durationSeconds: 'default',
        magnitude: { kind: 'percentOfBaseAtk', basePercent: 0.2, perStarBonus: 0.02 },
      },
    ],
  });

  it('applies Vírus on the attacker for 20% of base ATK at 0 stars', () => {
    const boitata = makeCombatant({ baseStats: { atk: 220 }, stars: 0, activeAbilities: [counterAbility] });
    const enemy = makeCombatant();
    const ctx = baseCtx({ self: boitata, attacker: enemy, rng: new ScriptedRng([0]) }); // chance roll succeeds

    fireTrigger('onCounter', ctx);

    const trojan = enemy.statuses.find((s) => s.status === 'trojan');
    expect(trojan?.value).toBeCloseTo(44); // 220 * 20%
  });

  it('scales the percentage by +2pp per star', () => {
    const boitata = makeCombatant({ baseStats: { atk: 220 }, stars: 3, activeAbilities: [counterAbility] });
    const enemy = makeCombatant();
    const ctx = baseCtx({ self: boitata, attacker: enemy, rng: new ScriptedRng([0]) });

    fireTrigger('onCounter', ctx);

    const trojan = enemy.statuses.find((s) => s.status === 'trojan');
    expect(trojan?.value).toBeCloseTo(220 * 0.26); // 20% + 3*2pp = 26%
  });

  it('does not fire when the chance roll fails', () => {
    const boitata = makeCombatant({ activeAbilities: [counterAbility] });
    const enemy = makeCombatant();
    const ctx = baseCtx({ self: boitata, attacker: enemy, rng: new ScriptedRng([0.99]) });

    fireTrigger('onCounter', ctx);

    expect(enemy.statuses).toHaveLength(0);
  });
});

describe('fireTrigger — Anhangá.exe-style crit heal + infect', () => {
  const critAbility = makeAbility({
    id: 'crit-heal-trojan',
    trigger: 'onCriticalHit',
    effects: [
      { type: 'heal', target: 'self', magnitude: { kind: 'percentOfMaxHp', percent: 0.1 } },
      { type: 'applyStatus', target: 'defender', status: 'trojan', durationSeconds: 'default', magnitude: { kind: 'triggeringDamage' } },
    ],
  });

  it('heals self for 10% max HP and infects the crit target with Vírus equal to the crit damage dealt', () => {
    const anhanga = makeCombatant({ baseStats: { hp: 12000 }, hp: 10000, activeAbilities: [critAbility] });
    const target = makeCombatant();
    const fakeAttackResult: AttackResult = {
      attacker: anhanga,
      defender: target,
      dodged: false,
      crit: true,
      rawDamage: 400,
      finalDamage: 500,
      shieldAbsorbed: 0,
      hpDamage: 500,
      defenderDied: false,
    };
    const ctx = baseCtx({ self: anhanga, defender: target, attackResult: fakeAttackResult });

    fireTrigger('onCriticalHit', ctx);

    expect(anhanga.hp).toBe(10000 + 1200); // 10% of 12000
    const trojan = target.statuses.find((s) => s.status === 'trojan');
    expect(trojan?.value).toBe(500);
  });

  it('never targets the caster itself with the infection (resolved ambiguity: target is the crit victim)', () => {
    const anhanga = makeCombatant({ activeAbilities: [critAbility] });
    const target = makeCombatant();
    const fakeAttackResult: AttackResult = {
      attacker: anhanga,
      defender: target,
      dodged: false,
      crit: true,
      rawDamage: 100,
      finalDamage: 100,
      shieldAbsorbed: 0,
      hpDamage: 100,
      defenderDied: false,
    };
    const ctx = baseCtx({ self: anhanga, defender: target, attackResult: fakeAttackResult });

    fireTrigger('onCriticalHit', ctx);

    expect(anhanga.statuses.some((s) => s.status === 'trojan')).toBe(false);
    expect(target.statuses.some((s) => s.status === 'trojan')).toBe(true);
  });
});

describe('fireTrigger — Firewall Turret-style battle-start shield', () => {
  const shieldAbility = makeAbility({
    id: 'shield-on-start',
    trigger: 'battleStart',
    effects: [{ type: 'grantShield', target: 'self', magnitude: { kind: 'percentOfMaxHp', percent: 0.2 } }],
  });

  it('grants shield equal to 20% of its own max HP', () => {
    const turret = makeCombatant({ baseStats: { hp: 600 }, activeAbilities: [shieldAbility] });
    const ctx = baseCtx({ self: turret });

    fireTrigger('battleStart', ctx);

    expect(turret.shield).toBe(120);
  });
});

describe('resolveTargets — ownVanguard (the index-0 fighter)', () => {
  const healFrontAlly = makeAbility({
    id: 'heal-front-ally',
    trigger: 'battleStart',
    effects: [{ type: 'heal', target: 'ownVanguard', magnitude: { kind: 'flat', value: 100 } }],
  });

  it('targets the first living unit in ctx.allies (the Vanguard)', () => {
    const front = makeCombatant({ hp: 500, maxHp: 1000 });
    const back = makeCombatant({ hp: 500, maxHp: 1000 });
    const caster = makeCombatant({ activeAbilities: [healFrontAlly] });
    const ctx = baseCtx({ self: caster, allies: [front, back] });

    fireTrigger('battleStart', ctx);

    expect(front.hp).toBe(600);
    expect(back.hp).toBe(500);
  });

  it('skips a dead front-of-queue unit and targets the next living one', () => {
    const dead = makeCombatant({ hp: 0, maxHp: 1000 });
    const nextUp = makeCombatant({ hp: 500, maxHp: 1000 });
    const caster = makeCombatant({ activeAbilities: [healFrontAlly] });
    const ctx = baseCtx({ self: caster, allies: [dead, nextUp] });

    fireTrigger('battleStart', ctx);

    expect(nextUp.hp).toBe(600);
  });
});

describe('applyEffect — dispel (v2 "quebra direta de status inimigo")', () => {
  const dispelDebuffs = makeAbility({
    id: 'cleanse-ally',
    trigger: 'battleStart',
    effects: [{ type: 'dispel', target: 'self', statuses: ['lag', 'throttling'] }],
  });

  it('strips exactly the listed statuses and logs one statusExpired per removed status', () => {
    const c = makeCombatant({ activeAbilities: [dispelDebuffs] });
    c.statuses.push({ status: 'lag', remainingSeconds: 2, value: 0.2 }, { status: 'buffAtk', remainingSeconds: 2, value: 0.1 });
    const logged: string[] = [];
    const ctx = baseCtx({ self: c, log: (e) => e.kind === 'statusExpired' && logged.push(e.status) });

    fireTrigger('battleStart', ctx);

    expect(c.statuses.map((s) => s.status)).toEqual(['buffAtk']);
    expect(logged).toEqual(['lag']);
  });

  it('with no explicit list, strips whichever bucket (debuffs vs buffs) is currently active', () => {
    const dispelAuto = makeAbility({ id: 'cleanse-auto', trigger: 'battleStart', effects: [{ type: 'dispel', target: 'self' }] });
    const c = makeCombatant({ activeAbilities: [dispelAuto] });
    c.statuses.push({ status: 'crash', remainingSeconds: 1, value: 0 }, { status: 'buffDef', remainingSeconds: 2, value: 0.1 });
    const ctx = baseCtx({ self: c });

    fireTrigger('battleStart', ctx);

    // crash (a debuff) present -> the debuff bucket is stripped, buffDef untouched.
    expect(c.statuses.map((s) => s.status)).toEqual(['buffDef']);
  });
});

describe('Echo triggers — onAllyAppliedLeak/Trojan/Crash', () => {
  it('broadcasts to the caster\'s other living allies (not the target) when Leak is successfully applied', () => {
    const echoAbility = makeAbility({
      id: 'echo-listener',
      trigger: 'onAllyAppliedLeak',
      effects: [{ type: 'grantShield', target: 'self', magnitude: { kind: 'flat', value: 50 } }],
    });
    const applyLeak = makeAbility({
      id: 'apply-leak',
      trigger: 'battleStart',
      effects: [{ type: 'applyStatus', target: 'defender', status: 'leak', durationSeconds: 3, magnitude: { kind: 'flat', value: 10 } }],
    });
    const caster = makeCombatant({ activeAbilities: [applyLeak] });
    const listener = makeCombatant({ activeAbilities: [echoAbility] });
    const enemyTarget = makeCombatant();
    const ctx = baseCtx({ self: caster, allies: [caster, listener], defender: enemyTarget });

    fireTrigger('battleStart', ctx);

    expect(listener.shield).toBe(50);
    expect(caster.shield).toBe(0); // the caster itself doesn't hear its own echo
  });
});

describe('shared exports — fireDeath/fireOnWounded broadcast their "ally" pair', () => {
  it('fireDeath fires onAllyDeath on the dead unit\'s living allies (not on the dead unit or the enemy side)', () => {
    const onAllyDeathAbility = makeAbility({ id: 'on-ally-death', trigger: 'onAllyDeath', effects: [{ type: 'grantShield', target: 'self', magnitude: { kind: 'flat', value: 20 } }] });
    const dead = makeCombatant({ hp: 0 });
    const ally = makeCombatant({ activeAbilities: [onAllyDeathAbility] });
    const enemy = makeCombatant({ activeAbilities: [onAllyDeathAbility] });

    fireDeath(dead, [dead, ally], [enemy], new ScriptedRng([]), () => {}, 0);

    expect(ally.shield).toBe(20);
    expect(enemy.shield).toBe(0);
  });

  it('fireOnWounded fires onWounded on the unit and onAllyWounded on its living allies', () => {
    const onWoundedAbility = makeAbility({ id: 'on-wounded', trigger: 'onWounded', effects: [{ type: 'grantShield', target: 'self', magnitude: { kind: 'flat', value: 5 } }] });
    const onAllyWoundedAbility = makeAbility({ id: 'on-ally-wounded', trigger: 'onAllyWounded', effects: [{ type: 'grantShield', target: 'self', magnitude: { kind: 'flat', value: 7 } }] });
    const wounded = makeCombatant({ activeAbilities: [onWoundedAbility] });
    const ally = makeCombatant({ activeAbilities: [onAllyWoundedAbility] });

    fireOnWounded(wounded, [wounded, ally], [], new ScriptedRng([]), () => {}, 0);

    expect(wounded.shield).toBe(5);
    expect(ally.shield).toBe(7);
  });
});
