import { describe, expect, it } from 'vitest';
import { absorbIntoShield, applyStatus, dispelStatuses, effectiveAtk, effectiveDef, effectiveVel, tickStatuses, isStunned } from './statusEffects';
import { makeCombatant } from './testUtils';

describe('applyStatus', () => {
  it('adds the source statusDurationBonus on top of the base duration (Jurupari.exe passive)', () => {
    const jurupari = makeCombatant({ statusDurationBonus: 1 });
    const target = makeCombatant();

    const instance = applyStatus(target, jurupari, 'lag', 2, 0.2);

    expect(instance.remainingSeconds).toBe(3);
  });

  it('replaces an existing non-stacking status instead of adding a second one', () => {
    const source = makeCombatant();
    const target = makeCombatant();

    applyStatus(target, source, 'lag', 2, 0.2);
    applyStatus(target, source, 'lag', 2, 0.2);

    expect(target.statuses.filter((s) => s.status === 'lag')).toHaveLength(1);
  });

  it('stacks Leak-like statuses when explicitly marked as stackable', () => {
    const source = makeCombatant();
    const target = makeCombatant();

    applyStatus(target, source, 'leak', 3, 15, { stacks: true });
    applyStatus(target, source, 'leak', 3, 15, { stacks: true });

    expect(target.statuses.filter((s) => s.status === 'leak')).toHaveLength(2);
  });

  it('never applies a null (round-less) duration bonus to Target', () => {
    const jurupari = makeCombatant({ statusDurationBonus: 1 });
    const target = makeCombatant();

    const instance = applyStatus(target, jurupari, 'target', null, 0);

    expect(instance.remainingSeconds).toBeNull();
  });
});

describe('effective stats', () => {
  it('throttling reduces effective ATK by its percent', () => {
    const c = makeCombatant({ baseStats: { atk: 200 } });
    applyStatus(c, c, 'throttling', 2, 0.15);
    expect(effectiveAtk(c)).toBeCloseTo(170);
  });

  it('lag reduces effective INI by its percent', () => {
    const c = makeCombatant({ baseStats: { vel: 100 } });
    applyStatus(c, c, 'lag', 2, 0.2);
    expect(effectiveVel(c)).toBeCloseTo(80);
  });

  it('a negative buffDef reduces effective Firewall (no dedicated Firewall-reduction status in v2)', () => {
    const c = makeCombatant({ baseStats: { def: 0.4 } });
    applyStatus(c, c, 'buffDef', 2, -0.5);
    expect(effectiveDef(c)).toBeCloseTo(0.2);
  });

  it('effective Firewall is capped at 0.9 (90% mitigation) even when stacked buffDef would push it past 1.0', () => {
    const c = makeCombatant({ baseStats: { def: 0.5 } });
    applyStatus(c, c, 'buffDef', 2, 3);
    expect(effectiveDef(c)).toBe(0.9);
  });
});

describe('isStunned', () => {
  it('is true while Crash is active', () => {
    const c = makeCombatant();
    applyStatus(c, c, 'crash', 1, 0);
    expect(isStunned(c)).toBe(true);
  });
});

describe('tickStatuses', () => {
  it('Leak damage hits shield before HP', () => {
    const c = makeCombatant({ shield: 10 });
    applyStatus(c, c, 'leak', 3, 30);

    const { ticks } = tickStatuses(c, 1);

    expect(ticks).toEqual([{ status: 'leak', amount: 30, kind: 'damage', shieldAbsorbed: 10 }]);
    expect(c.shield).toBe(0);
    expect(c.hp).toBe(c.maxHp - 20);
  });

  it('Trojan bypasses shield entirely', () => {
    const c = makeCombatant({ shield: 100 });
    applyStatus(c, c, 'trojan', 3, 30);

    tickStatuses(c, 1);

    expect(c.shield).toBe(100);
    expect(c.hp).toBe(c.maxHp - 30);
  });

  it('Nanites heals without exceeding max HP', () => {
    const c = makeCombatant({ hp: 990 });
    applyStatus(c, c, 'nanites', 3, 50);

    const { ticks } = tickStatuses(c, 1);

    expect(ticks).toEqual([{ status: 'nanites', amount: 10, kind: 'heal', shieldAbsorbed: 0 }]);
    expect(c.hp).toBe(c.maxHp);
  });

  it('ages a status down by the elapsed seconds and expires it at 0', () => {
    const c = makeCombatant();
    applyStatus(c, c, 'lag', 1, 0.2);

    const { expired } = tickStatuses(c, 1);

    expect(expired).toEqual(['lag']);
    expect(c.statuses).toHaveLength(0);
  });

  it('leaves a null-duration status (Target) untouched by time aging', () => {
    const c = makeCombatant();
    applyStatus(c, c, 'target', null, 0);

    const { expired } = tickStatuses(c, 1);

    expect(expired).toHaveLength(0);
    expect(c.statuses).toHaveLength(1);
  });
});

describe('absorbIntoShield — Fragmentação (docs/combate.md §3: "multiplica o dano causado a Escudos")', () => {
  it('with no Fragmentação active, behaves exactly like a plain shield-then-HP split', () => {
    const c = makeCombatant({ shield: 100 });
    const { shieldAbsorbed, hpDamage } = absorbIntoShield(c, 60);
    expect(shieldAbsorbed).toBe(60);
    expect(hpDamage).toBe(0);
    expect(c.shield).toBe(40);
  });

  it('a 50% Fragmentação multiplier drains the shield 1.5x faster per point of damage covered', () => {
    const c = makeCombatant({ shield: 100 });
    applyStatus(c, c, 'fragmentation', 2, 0.5);

    const { shieldAbsorbed, hpDamage } = absorbIntoShield(c, 100);

    // 100 shield only covers 100/1.5 ≈ 66.67 of the raw damage before running out.
    expect(shieldAbsorbed).toBeCloseTo(66.67, 1);
    expect(hpDamage).toBeCloseTo(33.33, 1);
    expect(c.shield).toBe(0);
  });

  it('ignoresShield bypasses Fragmentação entirely, same as a normal shield bypass', () => {
    const c = makeCombatant({ shield: 100 });
    applyStatus(c, c, 'fragmentation', 2, 0.5);

    const { shieldAbsorbed, hpDamage } = absorbIntoShield(c, 40, true);

    expect(shieldAbsorbed).toBe(0);
    expect(hpDamage).toBe(40);
    expect(c.shield).toBe(100);
  });
});

describe('dispelStatuses', () => {
  it('strips exactly the listed statuses and returns them', () => {
    const c = makeCombatant();
    applyStatus(c, c, 'lag', 2, 0.2);
    applyStatus(c, c, 'crash', 1, 0);
    applyStatus(c, c, 'buffAtk', 2, 0.1);

    const removed = dispelStatuses(c, ['lag', 'crash']);

    expect(removed.sort()).toEqual(['crash', 'lag']);
    expect(c.statuses.map((s) => s.status)).toEqual(['buffAtk']);
  });

  it('with no explicit list, strips the debuff bucket when a debuff is present', () => {
    const c = makeCombatant();
    applyStatus(c, c, 'throttling', 2, 0.15);
    applyStatus(c, c, 'buffDef', 2, 0.1);

    dispelStatuses(c);

    expect(c.statuses.map((s) => s.status)).toEqual(['buffDef']);
  });

  it('with no explicit list and no debuffs present, strips the buff bucket instead', () => {
    const c = makeCombatant();
    applyStatus(c, c, 'buffAtk', 2, 0.1);
    applyStatus(c, c, 'buffEsq', 2, 0.1);

    dispelStatuses(c);

    expect(c.statuses).toHaveLength(0);
  });
});
