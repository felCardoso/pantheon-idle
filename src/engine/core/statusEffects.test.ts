import { describe, expect, it } from 'vitest';
import { applyStatus, effectiveAtk, effectiveDef, effectiveIni, endOfRoundTick, isStunned } from './statusEffects';
import { makeCombatant } from './testUtils';

describe('applyStatus', () => {
  it('adds the source statusDurationBonus on top of the base duration (Jurupari.exe passive)', () => {
    const jurupari = makeCombatant({ statusDurationBonus: 1 });
    const target = makeCombatant();

    const instance = applyStatus(target, jurupari, 'lentidao', 2, 0.2);

    expect(instance.remainingRounds).toBe(3);
  });

  it('replaces an existing non-stacking status instead of adding a second one', () => {
    const source = makeCombatant();
    const target = makeCombatant();

    applyStatus(target, source, 'lentidao', 2, 0.2);
    applyStatus(target, source, 'lentidao', 2, 0.2);

    expect(target.statuses.filter((s) => s.status === 'lentidao')).toHaveLength(1);
  });

  it('stacks Sangramento-like statuses when explicitly marked as stackable', () => {
    const source = makeCombatant();
    const target = makeCombatant();

    applyStatus(target, source, 'sangramento', 3, 15, { stacks: true });
    applyStatus(target, source, 'sangramento', 3, 15, { stacks: true });

    expect(target.statuses.filter((s) => s.status === 'sangramento')).toHaveLength(2);
  });

  it('never applies a null (round-less) duration bonus to Marcado', () => {
    const jurupari = makeCombatant({ statusDurationBonus: 1 });
    const target = makeCombatant();

    const instance = applyStatus(target, jurupari, 'marcado', null, 0);

    expect(instance.remainingRounds).toBeNull();
  });
});

describe('effective stats', () => {
  it('enfraquecimento reduces effective ATK by its percent', () => {
    const c = makeCombatant({ baseStats: { atk: 200 } });
    applyStatus(c, c, 'enfraquecimento', 2, 0.15);
    expect(effectiveAtk(c)).toBeCloseTo(170);
  });

  it('lentidao reduces effective INI by its percent', () => {
    const c = makeCombatant({ baseStats: { ini: 100 } });
    applyStatus(c, c, 'lentidao', 2, 0.2);
    expect(effectiveIni(c)).toBeCloseTo(80);
  });

  it('corrosao reduces effective DEF by its percent', () => {
    const c = makeCombatant({ baseStats: { def: 40 } });
    applyStatus(c, c, 'corrosao', 2, 0.5);
    expect(effectiveDef(c)).toBeCloseTo(20);
  });
});

describe('isStunned', () => {
  it('is true while Atordoamento is active', () => {
    const c = makeCombatant();
    applyStatus(c, c, 'atordoamento', 1, 0);
    expect(isStunned(c)).toBe(true);
  });
});

describe('endOfRoundTick', () => {
  it('Vírus damage hits shield before HP', () => {
    const c = makeCombatant({ shield: 10 });
    applyStatus(c, c, 'virus', 3, 30);

    const { ticks } = endOfRoundTick(c);

    expect(ticks).toEqual([{ status: 'virus', amount: 30, kind: 'damage', shieldAbsorbed: 10 }]);
    expect(c.shield).toBe(0);
    expect(c.hp).toBe(c.maxHp - 20);
  });

  it('Veneno bypasses shield entirely', () => {
    const c = makeCombatant({ shield: 100 });
    applyStatus(c, c, 'veneno', 3, 30);

    endOfRoundTick(c);

    expect(c.shield).toBe(100);
    expect(c.hp).toBe(c.maxHp - 30);
  });

  it('Regeneração heals without exceeding max HP', () => {
    const c = makeCombatant({ hp: 990 });
    applyStatus(c, c, 'regeneracao', 3, 50);

    const { ticks } = endOfRoundTick(c);

    expect(ticks).toEqual([{ status: 'regeneracao', amount: 10, kind: 'heal', shieldAbsorbed: 0 }]);
    expect(c.hp).toBe(c.maxHp);
  });

  it('decrements duration and expires a status that reaches 0 rounds remaining', () => {
    const c = makeCombatant();
    applyStatus(c, c, 'lentidao', 1, 0.2);

    const { expired } = endOfRoundTick(c);

    expect(expired).toEqual(['lentidao']);
    expect(c.statuses).toHaveLength(0);
  });

  it('leaves a null-duration status (Marcado) untouched by round aging', () => {
    const c = makeCombatant();
    applyStatus(c, c, 'marcado', null, 0);

    const { expired } = endOfRoundTick(c);

    expect(expired).toHaveLength(0);
    expect(c.statuses).toHaveLength(1);
  });
});
