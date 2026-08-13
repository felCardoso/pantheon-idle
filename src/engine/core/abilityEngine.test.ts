import { describe, expect, it } from 'vitest';
import { fireTrigger, type TriggerContext } from './abilityEngine';
import { makeAbility, makeCombatant, ScriptedRng } from './testUtils';
import type { AttackResult } from './types';

function baseCtx(overrides: Partial<TriggerContext>): TriggerContext {
  return {
    self: makeCombatant(),
    allies: [],
    enemies: [],
    rng: new ScriptedRng([]),
    log: () => {},
    ...overrides,
  };
}

describe('fireTrigger — Boitatá.exe-style counter (onDamaged, % of base ATK, star scaling)', () => {
  const counterAbility = makeAbility({
    id: 'counter-virus',
    trigger: 'onDamaged',
    chance: 0.25,
    effects: [
      {
        type: 'applyStatus',
        target: 'attacker',
        status: 'virus',
        duration: 'default',
        magnitude: { kind: 'percentOfBaseAtk', basePercent: 0.2, perStarBonus: 0.02 },
      },
    ],
  });

  it('applies Vírus on the attacker for 20% of base ATK at 0 stars', () => {
    const boitata = makeCombatant({ baseStats: { atk: 220 }, stars: 0, abilities: [counterAbility] });
    const enemy = makeCombatant();
    const ctx = baseCtx({ self: boitata, attacker: enemy, rng: new ScriptedRng([0]) }); // chance roll succeeds

    fireTrigger('onDamaged', ctx);

    const virus = enemy.statuses.find((s) => s.status === 'virus');
    expect(virus?.value).toBeCloseTo(44); // 220 * 20%
  });

  it('scales the percentage by +2pp per star', () => {
    const boitata = makeCombatant({ baseStats: { atk: 220 }, stars: 3, abilities: [counterAbility] });
    const enemy = makeCombatant();
    const ctx = baseCtx({ self: boitata, attacker: enemy, rng: new ScriptedRng([0]) });

    fireTrigger('onDamaged', ctx);

    const virus = enemy.statuses.find((s) => s.status === 'virus');
    expect(virus?.value).toBeCloseTo(220 * 0.26); // 20% + 3*2pp = 26%
  });

  it('does not fire when the chance roll fails', () => {
    const boitata = makeCombatant({ abilities: [counterAbility] });
    const enemy = makeCombatant();
    const ctx = baseCtx({ self: boitata, attacker: enemy, rng: new ScriptedRng([0.99]) });

    fireTrigger('onDamaged', ctx);

    expect(enemy.statuses).toHaveLength(0);
  });
});

describe('fireTrigger — Anhangá.exe-style crit heal + infect', () => {
  const critAbility = makeAbility({
    id: 'crit-heal-virus',
    trigger: 'onCriticalHit',
    effects: [
      { type: 'heal', target: 'self', magnitude: { kind: 'percentOfMaxHp', percent: 0.1 } },
      { type: 'applyStatus', target: 'defender', status: 'virus', duration: 'default', magnitude: { kind: 'triggeringDamage' } },
    ],
  });

  it('heals self for 10% max HP and infects the crit target with Vírus equal to the crit damage dealt', () => {
    const anhanga = makeCombatant({ baseStats: { hp: 12000 }, hp: 10000, abilities: [critAbility] });
    const target = makeCombatant();
    const fakeAttackResult: AttackResult = {
      attacker: anhanga,
      defender: target,
      dodged: false,
      crit: true,
      elementalAdvantage: false,
      rawDamage: 400,
      finalDamage: 500,
      shieldAbsorbed: 0,
      hpDamage: 500,
      defenderDied: false,
    };
    const ctx = baseCtx({ self: anhanga, defender: target, attackResult: fakeAttackResult });

    fireTrigger('onCriticalHit', ctx);

    expect(anhanga.hp).toBe(10000 + 1200); // 10% of 12000
    const virus = target.statuses.find((s) => s.status === 'virus');
    expect(virus?.value).toBe(500);
  });

  it('never targets the caster itself with the infection (resolved ambiguity: target is the crit victim)', () => {
    const anhanga = makeCombatant({ abilities: [critAbility] });
    const target = makeCombatant();
    const fakeAttackResult: AttackResult = {
      attacker: anhanga,
      defender: target,
      dodged: false,
      crit: true,
      elementalAdvantage: false,
      rawDamage: 100,
      finalDamage: 100,
      shieldAbsorbed: 0,
      hpDamage: 100,
      defenderDied: false,
    };
    const ctx = baseCtx({ self: anhanga, defender: target, attackResult: fakeAttackResult });

    fireTrigger('onCriticalHit', ctx);

    expect(anhanga.statuses.some((s) => s.status === 'virus')).toBe(false);
    expect(target.statuses.some((s) => s.status === 'virus')).toBe(true);
  });
});

describe('fireTrigger — Firewall Turret-style battle-start shield', () => {
  const shieldAbility = makeAbility({
    id: 'shield-on-start',
    trigger: 'battleStart',
    effects: [{ type: 'grantShield', target: 'self', magnitude: { kind: 'percentOfMaxHp', percent: 0.2 } }],
  });

  it('grants shield equal to 20% of its own max HP', () => {
    const turret = makeCombatant({ baseStats: { hp: 600 }, abilities: [shieldAbility] });
    const ctx = baseCtx({ self: turret });

    fireTrigger('battleStart', ctx);

    expect(turret.shield).toBe(120);
  });
});
