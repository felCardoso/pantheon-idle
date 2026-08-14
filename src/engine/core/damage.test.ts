import { describe, expect, it } from 'vitest';
import { resolveAttack } from './damage';
import { applyStatus } from './statusEffects';
import { makeCombatant, ScriptedRng } from './testUtils';

describe('resolveAttack — docs/mvp.md section 2 resolution order', () => {
  it('a successful dodge deals zero damage and applies no effects', () => {
    const attacker = makeCombatant({ baseStats: { atk: 100 } });
    const defender = makeCombatant({ baseStats: { esq: 0.5 } });
    // esquiva check: next() < esq (0.5) -> dodge
    const rng = new ScriptedRng([0.1]);

    const result = resolveAttack(attacker, defender, rng);

    expect(result.dodged).toBe(true);
    expect(result.finalDamage).toBe(0);
    expect(defender.hp).toBe(defender.maxHp);
  });

  it('applies the DEF mitigation formula: dmg * (1 - DEF), a direct percentage', () => {
    const attacker = makeCombatant({ baseStats: { atk: 200, esq: 0 } });
    const defender = makeCombatant({ baseStats: { def: 0.3, esq: 0 } });
    // sequence: dodge-check (fail, >= esq 0) , crit-check (fail, >= 0.05)
    const rng = new ScriptedRng([0.99, 0.99]);

    const result = resolveAttack(attacker, defender, rng);

    // DEF 0.3 ignores 30% of the physical damage.
    expect(result.finalDamage).toBe(140);
    expect(defender.hp).toBe(defender.maxHp - 140);
  });

  it('a critical hit multiplies damage by the configured crit multiplier (1.5x)', () => {
    const attacker = makeCombatant({ baseStats: { atk: 200, esq: 0 } });
    const defender = makeCombatant({ baseStats: { def: 0, esq: 0 } });
    const rng = new ScriptedRng([0.99, 0.0]); // no dodge, forced crit

    const result = resolveAttack(attacker, defender, rng);

    expect(result.crit).toBe(true);
    expect(result.finalDamage).toBe(300);
  });

  it('Marcado guarantees a crit and is consumed by the hit that uses it', () => {
    const attacker = makeCombatant({ baseStats: { atk: 200, esq: 0 } });
    const defender = makeCombatant({ baseStats: { def: 0, esq: 0 } });
    applyStatus(defender, attacker, 'marcado', null, 0);
    // Only the dodge roll is consumed from RNG — crit is forced by Marcado, no crit roll happens.
    const rng = new ScriptedRng([0.99]);

    const result = resolveAttack(attacker, defender, rng);

    expect(result.crit).toBe(true);
    expect(defender.statuses.some((s) => s.status === 'marcado')).toBe(false);
  });

  it('applies the elemental advantage multiplier (1.25x) when the attacker counters the defender', () => {
    const attacker = makeCombatant({ element: 'Encryption', baseStats: { atk: 200, esq: 0 } });
    const defender = makeCombatant({ element: 'Backdoor', baseStats: { def: 0, esq: 0 } });
    const rng = new ScriptedRng([0.99, 0.99]); // no dodge, no crit

    const result = resolveAttack(attacker, defender, rng);

    expect(result.elementalAdvantage).toBe(true);
    expect(result.finalDamage).toBe(250);
  });

  it('does not grant elemental advantage for pairs with no defined counter', () => {
    const attacker = makeCombatant({ element: 'Backdoor', baseStats: { atk: 200, esq: 0 } });
    const defender = makeCombatant({ element: 'Encryption', baseStats: { def: 0, esq: 0 } });
    const rng = new ScriptedRng([0.99, 0.99]);

    const result = resolveAttack(attacker, defender, rng);

    expect(result.elementalAdvantage).toBe(false);
    expect(result.finalDamage).toBe(200);
  });

  it('damage hits shield first, and only the excess spills into HP', () => {
    const attacker = makeCombatant({ baseStats: { atk: 200, esq: 0 } });
    const defender = makeCombatant({ baseStats: { def: 0, esq: 0 }, shield: 120 });
    const rng = new ScriptedRng([0.99, 0.99]);

    const result = resolveAttack(attacker, defender, rng);

    expect(result.shieldAbsorbed).toBe(120);
    expect(result.hpDamage).toBe(80);
    expect(defender.shield).toBe(0);
    expect(defender.hp).toBe(defender.maxHp - 80);
  });

  it('marks the defender as dead once HP reaches 0', () => {
    const attacker = makeCombatant({ baseStats: { atk: 9999, esq: 0 } });
    const defender = makeCombatant({ baseStats: { hp: 50, def: 0, esq: 0 } });
    const rng = new ScriptedRng([0.99, 0.99]);

    const result = resolveAttack(attacker, defender, rng);

    expect(result.defenderDied).toBe(true);
    expect(defender.hp).toBe(0);
  });
});
