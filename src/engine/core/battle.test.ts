import { describe, expect, it } from 'vitest';
import { checkVictory, decideByRemainingHp, runBattle } from './battle';
import { loadJurupariAllies, loadJurupariComuns, loadJurupariBoss } from './loader';
import { makeCombatant } from './testUtils';

describe('checkVictory', () => {
  it('returns null while both sides still have living units', () => {
    expect(checkVictory([makeCombatant()], [makeCombatant()])).toBeNull();
  });

  it('declares the other side the winner once one side is fully eliminated', () => {
    expect(checkVictory([makeCombatant({ hp: 0 })], [makeCombatant()])).toBe('enemies');
    expect(checkVictory([makeCombatant()], [makeCombatant({ hp: 0 })])).toBe('allies');
  });

  it('is a draw if both sides are eliminated simultaneously', () => {
    expect(checkVictory([makeCombatant({ hp: 0 })], [makeCombatant({ hp: 0 })])).toBe('draw');
  });
});

describe('decideByRemainingHp (round-limit tiebreaker, docs/combate.md section 7)', () => {
  it('the side with more remaining HP% wins — never an arbitrary tie', () => {
    const allies = [makeCombatant({ hp: 80, maxHp: 100 })];
    const enemies = [makeCombatant({ hp: 40, maxHp: 100 })];
    expect(decideByRemainingHp(allies, enemies)).toBe('allies');
  });

  it('is a draw only on an exact percentage tie', () => {
    const allies = [makeCombatant({ hp: 50, maxHp: 100 })];
    const enemies = [makeCombatant({ hp: 25, maxHp: 50 })];
    expect(decideByRemainingHp(allies, enemies)).toBe('draw');
  });
});

describe('runBattle — anti-infinite-round safeguard', () => {
  it('a permanent stalemate (100% dodge both sides) still terminates via enrage true damage, doubling from 2% at round 30', () => {
    const allies = [makeCombatant({ name: 'A', baseStats: { atk: 10, esq: 1, ini: 100 } })];
    const enemies = [makeCombatant({ name: 'B', baseStats: { atk: 10, esq: 1, ini: 100 } })];

    const result = runBattle(allies, enemies, { seed: 1 });

    expect(result.rounds).toBeLessThanOrEqual(45);
    const enrageEntries = result.log.filter((e): e is Extract<typeof e, { kind: 'enrage' }> => e.kind === 'enrage');
    expect(enrageEntries.length).toBeGreaterThan(0);
    expect(enrageEntries[0]).toMatchObject({ round: 30, percent: 0.02 });
    if (enrageEntries.length > 1) {
      expect(enrageEntries[1]).toMatchObject({ round: 31, percent: 0.04 });
    }
  });
});

describe('runBattle — full Jurupari.iso integration smoke test', () => {
  it('runs allies vs. the 3 common enemies to completion without throwing', () => {
    const result = runBattle(loadJurupariAllies(), loadJurupariComuns(3), { seed: 42 });
    expect(['allies', 'enemies', 'draw']).toContain(result.winner);
    expect(result.rounds).toBeGreaterThan(0);
    expect(result.rounds).toBeLessThanOrEqual(45);
  });

  it('runs allies vs. Anhangá.exe to completion without throwing', () => {
    const result = runBattle(loadJurupariAllies(), loadJurupariBoss(), { seed: 42 });
    expect(['allies', 'enemies', 'draw']).toContain(result.winner);
    expect(result.rounds).toBeGreaterThan(0);
    expect(result.rounds).toBeLessThanOrEqual(45);
  });
});
