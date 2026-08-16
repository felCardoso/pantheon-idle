import { describe, expect, it } from 'vitest';
import { checkVictory, decideByRemainingHp, runBattle } from './battle';
import { loadJurupariAllies, loadJurupariComuns, loadJurupariBoss, loadCharactersByIds } from './loader';
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

    expect(result.rounds).toBeLessThanOrEqual(50);
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
    expect(result.rounds).toBeLessThanOrEqual(50);
  });

  it('runs allies vs. Anhangá.exe to completion without throwing', () => {
    const result = runBattle(loadJurupariAllies(), loadJurupariBoss(), { seed: 42 });
    expect(['allies', 'enemies', 'draw']).toContain(result.winner);
    expect(result.rounds).toBeGreaterThan(0);
    expect(result.rounds).toBeLessThanOrEqual(50);
  });

  it('runs Medusa/Hércules/Minotauro (4 abilities each, multiple onDamaged/onAttack/battleStart triggers firing every round) to completion without throwing', () => {
    const allies = loadCharactersByIds([
      { id: 'medusa', xp: 0 },
      { id: 'hercules', xp: 0 },
      { id: 'minotauro', xp: 0 },
    ]);
    const result = runBattle(allies, loadJurupariComuns(3), { seed: 42 });
    expect(['allies', 'enemies', 'draw']).toContain(result.winner);
    expect(result.rounds).toBeGreaterThan(0);
    expect(result.rounds).toBeLessThanOrEqual(50);
  });
});

describe('runBattle — ICE reflection', () => {
  it('reflects a fraction of the physical damage received back onto the attacker, logged independently of the attack entry', () => {
    const allies = [makeCombatant({ name: 'Attacker', baseStats: { atk: 100, esq: 0, ini: 1 }, hp: 10000, maxHp: 10000 })];
    const enemies = [makeCombatant({ name: 'Defender', baseStats: { esq: 0, ice: 0.5, ini: 0 }, hp: 10000, maxHp: 10000 })];

    const result = runBattle(allies, enemies, { seed: 7 });

    const attackEntry = result.log.find((e): e is Extract<typeof e, { kind: 'attack' }> => e.kind === 'attack')!;
    const iceEntry = result.log.find((e): e is Extract<typeof e, { kind: 'iceReflect' }> => e.kind === 'iceReflect')!;
    expect(attackEntry).toBeDefined();
    expect(iceEntry).toBeDefined();
    expect(iceEntry.source).toBe('Defender');
    expect(iceEntry.target).toBe('Attacker');
    expect(iceEntry.amount).toBeCloseTo(attackEntry.result.finalDamage * 0.5);
  });

  it('still reflects even when the primary hit kills the defender — only the defender\'s own retaliation is cancelled by death', () => {
    const allies = [makeCombatant({ name: 'Attacker', baseStats: { atk: 10000, esq: 0, ini: 1 }, hp: 10000, maxHp: 10000 })];
    const enemies = [makeCombatant({ name: 'Defender', baseStats: { esq: 0, ice: 0.1, ini: 0 }, hp: 1, maxHp: 1 })];

    const result = runBattle(allies, enemies, { seed: 3 });

    const deathEntries = result.log.filter((e): e is Extract<typeof e, { kind: 'death' }> => e.kind === 'death');
    const iceEntry = result.log.find((e): e is Extract<typeof e, { kind: 'iceReflect' }> => e.kind === 'iceReflect');
    expect(deathEntries.some((d) => d.unit === 'Defender')).toBe(true);
    expect(iceEntry).toBeDefined();
  });
});

describe('runBattle — line-up/queue clash model (docs/combate.md §1-2)', () => {
  it('the higher-Ping front-liner attacks first and cancels the loser\'s action when its hit ejects it', () => {
    const allies = [makeCombatant({ name: 'FastKiller', baseStats: { atk: 99999, esq: 0, ini: 100 }, hp: 1000, maxHp: 1000 })];
    const enemies = [makeCombatant({ name: 'SlowVictim', baseStats: { atk: 1, esq: 0, ini: 0 }, hp: 1, maxHp: 1 })];

    const result = runBattle(allies, enemies, { seed: 1 });

    const pingEntry = result.log.find((e): e is Extract<typeof e, { kind: 'pingAdvantage' }> => e.kind === 'pingAdvantage');
    expect(pingEntry?.unit).toBe('FastKiller');
    const cancelled = result.log.find((e): e is Extract<typeof e, { kind: 'actionCancelled' }> => e.kind === 'actionCancelled');
    expect(cancelled?.unit).toBe('SlowVictim');
    // Only one attack entry should exist — the victim's own action never resolved.
    const attacks = result.log.filter((e): e is Extract<typeof e, { kind: 'attack' }> => e.kind === 'attack');
    expect(attacks).toHaveLength(1);
    expect(attacks[0].result.attacker.name).toBe('FastKiller');
  });

  it('a Ping tie resolves both attacks independently, with no cancellation', () => {
    const allies = [makeCombatant({ name: 'A', baseStats: { atk: 10, esq: 0, ini: 50 }, hp: 10000, maxHp: 10000 })];
    const enemies = [makeCombatant({ name: 'B', baseStats: { atk: 10, esq: 0, ini: 50 }, hp: 10000, maxHp: 10000 })];

    const result = runBattle(allies, enemies, { seed: 5 });

    const firstClashAttacks = result.log
      .slice(0, result.log.findIndex((e) => e.kind === 'clashEnd') + 1)
      .filter((e): e is Extract<typeof e, { kind: 'attack' }> => e.kind === 'attack');
    expect(firstClashAttacks).toHaveLength(2);
    const cancelled = result.log.find((e) => e.kind === 'actionCancelled');
    expect(cancelled).toBeUndefined();
    const pingEntry = result.log.find((e) => e.kind === 'pingAdvantage');
    expect(pingEntry).toBeUndefined();
  });

  it('alwaysActsFirst wins its clash unconditionally, even against a much higher Ping opponent, without logging pingAdvantage', () => {
    const allies = [makeCombatant({ name: 'Saci', baseStats: { atk: 99999, esq: 0, ini: 0 }, hp: 1000, maxHp: 1000, alwaysActsFirst: true })];
    const enemies = [makeCombatant({ name: 'FastButSecond', baseStats: { atk: 1, esq: 0, ini: 9999 }, hp: 1, maxHp: 1 })];

    const result = runBattle(allies, enemies, { seed: 2 });

    const cancelled = result.log.find((e): e is Extract<typeof e, { kind: 'actionCancelled' }> => e.kind === 'actionCancelled');
    expect(cancelled?.unit).toBe('FastButSecond');
    const pingEntry = result.log.find((e) => e.kind === 'pingAdvantage');
    expect(pingEntry).toBeUndefined(); // alwaysActsFirst is not a Ping win
  });

  it('a Crash-stunned front-liner skips its own attack but still gets attacked and requeues', () => {
    const allies = [makeCombatant({ name: 'Stunned', baseStats: { atk: 10, esq: 0, ini: 0 }, hp: 10000, maxHp: 10000 })];
    const enemies = [makeCombatant({ name: 'Attacker', baseStats: { atk: 10, esq: 0, ini: 0 }, hp: 10000, maxHp: 10000 })];
    allies[0].statuses.push({ status: 'crash', remainingRounds: 1, value: 0 });

    const result = runBattle(allies, enemies, { seed: 9 });

    const skipEntry = result.log.find((e): e is Extract<typeof e, { kind: 'turnSkippedStun' }> => e.kind === 'turnSkippedStun');
    expect(skipEntry?.unit).toBe('Stunned');
    const firstAttack = result.log.find((e): e is Extract<typeof e, { kind: 'attack' }> => e.kind === 'attack');
    expect(firstAttack?.result.attacker.name).toBe('Attacker');
    const clashEnd = result.log.find((e): e is Extract<typeof e, { kind: 'clashEnd' }> => e.kind === 'clashEnd');
    expect(clashEnd).toMatchObject({ allyUnit: 'Stunned', enemyUnit: 'Attacker' });
  });

  it('a lone survivor keeps recycling to the front of its own queue every clash (never skips a fight)', () => {
    const allies = [makeCombatant({ name: 'Solo', baseStats: { atk: 5, esq: 0, ini: 50 }, hp: 100000, maxHp: 100000 })];
    const enemies = [
      makeCombatant({ name: 'E1', baseStats: { atk: 1, esq: 0, ini: 40 }, hp: 1, maxHp: 1 }),
      makeCombatant({ name: 'E2', baseStats: { atk: 1, esq: 0, ini: 40 }, hp: 1, maxHp: 1 }),
      makeCombatant({ name: 'E3', baseStats: { atk: 1, esq: 0, ini: 40 }, hp: 1, maxHp: 1 }),
    ];

    const result = runBattle(allies, enemies, { seed: 11 });

    expect(result.winner).toBe('allies');
    // Solo (higher Ping) should have attacked in every clash until the enemy queue ran out.
    const soloAttacks = result.log.filter(
      (e): e is Extract<typeof e, { kind: 'attack' }> => e.kind === 'attack' && e.result.attacker.name === 'Solo',
    );
    expect(soloAttacks).toHaveLength(3);
  });
});
