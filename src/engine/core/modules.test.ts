import { describe, expect, it } from 'vitest';
import { NO_MODULE_BONUSES, mergeModuleBonuses } from './modules';
import { resolveAttack } from './damage';
import { runBattle } from './battle';
import { makeCombatant, ScriptedRng } from './testUtils';

const bonuses = (partial: Partial<typeof NO_MODULE_BONUSES>) => ({ ...NO_MODULE_BONUSES, ...partial });

describe('mergeModuleBonuses', () => {
  it('sums the additive bonuses across slots, so two crit runes stack', () => {
    const merged = mergeModuleBonuses([bonuses({ critChance: 0.01 }), bonuses({ critChance: 0.01, attackPercent: 0.025 })]);
    expect(merged.critChance).toBeCloseTo(0.02);
    expect(merged.attackPercent).toBeCloseTo(0.025);
  });

  it('takes the shortest cleanse interval rather than stacking them into a faster one', () => {
    const merged = mergeModuleBonuses([bonuses({ cleanseIntervalSeconds: 20 }), bonuses({ cleanseIntervalSeconds: 5 })]);
    expect(merged.cleanseIntervalSeconds).toBe(5);
  });

  it('keeps only the strongest execute, so two never multiply into a delete button', () => {
    const merged = mergeModuleBonuses([
      bonuses({ executeDamagePercent: 0.06, executeThresholdPercent: 0.3 }),
      bonuses({ executeDamagePercent: 0.1, executeThresholdPercent: 0.3 }),
    ]);
    expect(merged.executeDamagePercent).toBeCloseTo(0.1);
  });
});

describe('module effects in combat', () => {
  it('raises crit damage on a hit that actually crits', () => {
    // Two rolls are consumed per attack: dodge, then crit. 0.9 never dodges (esq 0); 0.01 clears
    // the 5% base crit chance, so both attacks below are guaranteed crits.
    const critRolls = () => new ScriptedRng([0.9, 0.01]);
    const plain = makeCombatant({ baseStats: { atk: 100 } });
    const runed = makeCombatant({ baseStats: { atk: 100 }, modules: bonuses({ critDamage: 0.2 }) });

    const a = resolveAttack(plain, makeCombatant({ maxHp: 99999, hp: 99999 }), critRolls());
    const b = resolveAttack(runed, makeCombatant({ maxHp: 99999, hp: 99999 }), critRolls());

    expect(a.crit).toBe(true);
    expect(b.crit).toBe(true);
    // 1.5x base becomes 1.7x, so the runed hit lands 1.7/1.5 harder.
    expect(b.finalDamage).toBeCloseTo(a.finalDamage * (1.7 / 1.5));
  });

  it('raises crit chance, turning a roll that would miss the base rate into a crit', () => {
    // 0.08 clears a 5% + 5% module chance but not the 5% base alone.
    const plain = makeCombatant({ baseStats: { atk: 100 } });
    const runed = makeCombatant({ baseStats: { atk: 100 }, modules: bonuses({ critChance: 0.05 }) });

    expect(resolveAttack(plain, makeCombatant({ maxHp: 9999, hp: 9999 }), new ScriptedRng([0.9, 0.08])).crit).toBe(false);
    expect(resolveAttack(runed, makeCombatant({ maxHp: 9999, hp: 9999 }), new ScriptedRng([0.9, 0.08])).crit).toBe(true);
  });

  it('adds execute damage only below the threshold', () => {
    const attacker = makeCombatant({ baseStats: { atk: 100 }, modules: bonuses({ executeDamagePercent: 0.5, executeThresholdPercent: 0.3 }) });
    const healthy = makeCombatant({ maxHp: 1000, hp: 1000 });
    const wounded = makeCombatant({ maxHp: 1000, hp: 200 }); // 20% — below the threshold

    const full = resolveAttack(attacker, healthy, new ScriptedRng([1, 1]));
    const low = resolveAttack(attacker, wounded, new ScriptedRng([1, 1]));
    expect(low.finalDamage).toBeCloseTo(full.finalDamage * 1.5);
  });

  it('revives a bearer once, and only once, instead of ejecting it', () => {
    const ally = makeCombatant({ isAlly: true, baseStats: { hp: 100, atk: 1 }, maxHp: 100, hp: 100, modules: bonuses({ reviveOncePercent: 0.1 }) });
    const enemy = makeCombatant({ isAlly: false, baseStats: { hp: 100000, atk: 500 }, maxHp: 100000, hp: 100000 });

    const result = runBattle([ally], [enemy], { seed: 7 });
    const revives = result.log.filter((e) => e.kind === 'moduleRevive');
    expect(revives.length).toBe(1);
    // The revive happened, but a lone ally against that wall still loses the battle.
    expect(result.winner).toBe('enemies');
  });

  it('does not revive a bearer with no revive module', () => {
    const ally = makeCombatant({ isAlly: true, baseStats: { hp: 100, atk: 1 }, maxHp: 100, hp: 100 });
    const enemy = makeCombatant({ isAlly: false, baseStats: { hp: 100000, atk: 500 }, maxHp: 100000, hp: 100000 });
    const result = runBattle([ally], [enemy], { seed: 7 });
    expect(result.log.some((e) => e.kind === 'moduleRevive')).toBe(false);
  });
});
