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

describe('decideByRemainingHp (time-limit tiebreaker, docs/combate.md v3.1 §6)', () => {
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

describe('runBattle — anti-infinite-battle safeguard (docs/combate.md v3.1 §6)', () => {
  it('a permanent stalemate (100% dodge both sides) terminates via System Overload, stepping 5% every 5s from 30s', () => {
    const allies = [makeCombatant({ name: 'A', baseStats: { atk: 10, esq: 1, vel: 1 } })];
    const enemies = [makeCombatant({ name: 'B', baseStats: { atk: 10, esq: 1, vel: 1 } })];

    const result = runBattle(allies, enemies, { seed: 1 });

    expect(result.duration).toBeLessThanOrEqual(50);
    const overloads = result.log.filter((e): e is Extract<typeof e, { kind: 'overload' }> => e.kind === 'overload');
    expect(overloads.length).toBeGreaterThan(0);
    expect(overloads[0]).toMatchObject({ at: 30, percent: 0.05 });
    if (overloads.length > 1) {
      expect(overloads[1]).toMatchObject({ at: 35, percent: 0.1 });
    }
  });

  it('never runs past the 50s hard stop', () => {
    // Two immortal healers: nothing but the time limit can end this.
    const allies = [makeCombatant({ name: 'A', baseStats: { atk: 0, esq: 0, vel: 0 }, hp: 10 ** 9, maxHp: 10 ** 9 })];
    const enemies = [makeCombatant({ name: 'B', baseStats: { atk: 0, esq: 0, vel: 0 }, hp: 10 ** 9, maxHp: 10 ** 9 })];

    const result = runBattle(allies, enemies, { seed: 3 });

    expect(result.duration).toBeLessThanOrEqual(50);
    expect(result.reason).toBe('timeLimit');
  });
});

describe('runBattle — full Jurupari.iso integration smoke test', () => {
  it('runs allies vs. the 3 common enemies to completion without throwing', () => {
    const result = runBattle(loadJurupariAllies(), loadJurupariComuns(3), { seed: 42 });
    expect(['allies', 'enemies', 'draw']).toContain(result.winner);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.duration).toBeLessThanOrEqual(50);
  });

  it('runs allies vs. Anhangá.exe to completion without throwing', () => {
    const result = runBattle(loadJurupariAllies(), loadJurupariBoss(), { seed: 42 });
    expect(['allies', 'enemies', 'draw']).toContain(result.winner);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.duration).toBeLessThanOrEqual(50);
  });

  it('runs Medusa/Hércules/Minotauro (4 abilities each, multiple onDamaged/onAttack/battleStart triggers firing every round) to completion without throwing', () => {
    const allies = loadCharactersByIds([
      { id: 'medusa', xp: 0 },
      { id: 'hercules', xp: 0 },
      { id: 'minotauro', xp: 0 },
    ]);
    const result = runBattle(allies, loadJurupariComuns(3), { seed: 42 });
    expect(['allies', 'enemies', 'draw']).toContain(result.winner);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.duration).toBeLessThanOrEqual(50);
  });
});

describe('runBattle — ICE reflection', () => {
  it('reflects a fraction of the damage received back onto the attacker, logged independently of the attack entry', () => {
    const allies = [makeCombatant({ name: 'Attacker', baseStats: { atk: 100, esq: 0, vel: 1 }, hp: 10000, maxHp: 10000 })];
    const enemies = [makeCombatant({ name: 'Defender', baseStats: { esq: 0, ice: 0.5, vel: 0 }, hp: 10000, maxHp: 10000 })];

    const result = runBattle(allies, enemies, { seed: 7 });

    const attackEntry = result.log.find((e): e is Extract<typeof e, { kind: 'attack' }> => e.kind === 'attack')!;
    const iceEntry = result.log.find((e): e is Extract<typeof e, { kind: 'iceReflect' }> => e.kind === 'iceReflect')!;
    expect(attackEntry).toBeDefined();
    expect(iceEntry).toBeDefined();
    expect(iceEntry.source).toBe('Defender');
    expect(iceEntry.target).toBe('Attacker');
    expect(iceEntry.amount).toBeCloseTo(attackEntry.result.finalDamage * 0.5);
  });

  it('scales with the size of the incoming hit — a bigger attack is punished harder', () => {
    const run = (attackerAtk: number) => {
      const allies = [makeCombatant({ name: 'Attacker', baseStats: { atk: attackerAtk, esq: 0, vel: 1 }, hp: 10 ** 7, maxHp: 10 ** 7 })];
      const enemies = [makeCombatant({ name: 'Defender', baseStats: { esq: 0, ice: 0.2, vel: 0 }, hp: 10 ** 7, maxHp: 10 ** 7 })];
      const result = runBattle(allies, enemies, { seed: 7 });
      return result.log.find((e): e is Extract<typeof e, { kind: 'iceReflect' }> => e.kind === 'iceReflect')!.amount;
    };

    expect(run(1000)).toBeCloseTo(run(100) * 10);
  });

  it('still reflects even when the primary hit kills the defender — only the defender\'s own retaliation is cancelled by death', () => {
    const allies = [makeCombatant({ name: 'Attacker', baseStats: { atk: 10000, esq: 0, vel: 1 }, hp: 10000, maxHp: 10000 })];
    const enemies = [makeCombatant({ name: 'Defender', baseStats: { esq: 0, ice: 0.1, vel: 0 }, hp: 1, maxHp: 1 })];

    const result = runBattle(allies, enemies, { seed: 3 });

    const deathEntries = result.log.filter((e): e is Extract<typeof e, { kind: 'death' }> => e.kind === 'death');
    const iceEntry = result.log.find((e): e is Extract<typeof e, { kind: 'iceReflect' }> => e.kind === 'iceReflect');
    expect(deathEntries.some((d) => d.unit === 'Defender')).toBe(true);
    expect(iceEntry).toBeDefined();
  });
});

describe('runBattle — Relay & Bench model (docs/combate.md v3.1 §1)', () => {
  it('a unit that stays benched all battle never attacks and never takes damage', () => {
    // A1 one-shots the enemy, so it never rotates out and A2 never leaves the bench.
    const allies = [
      makeCombatant({ name: 'A1', baseStats: { atk: 9999, esq: 0, vel: 0 }, hp: 1000, maxHp: 1000 }),
      makeCombatant({ name: 'A2', baseStats: { atk: 50, esq: 0, vel: 0 }, hp: 1000, maxHp: 1000 }),
    ];
    const enemies = [makeCombatant({ name: 'E1', baseStats: { atk: 50, esq: 0, vel: 0 }, hp: 100, maxHp: 100 })];

    const result = runBattle(allies, enemies, { seed: 4 });

    expect(result.winner).toBe('allies');
    const attackers = new Set(
      result.log.filter((e): e is Extract<typeof e, { kind: 'attack' }> => e.kind === 'attack').map((e) => e.result.attacker.name),
    );
    expect(attackers.has('A2')).toBe(false);
    expect(allies[1].hp).toBe(1000);
    expect(allies[1].isVanguard).toBe(false);
  });

  it('ejecting the Vanguard promotes the next unit in the queue immediately', () => {
    const allies = [
      makeCombatant({ name: 'Fragile', baseStats: { atk: 1, esq: 0, vel: 0 }, hp: 1, maxHp: 1 }),
      makeCombatant({ name: 'Backup', baseStats: { atk: 1, esq: 0, vel: 0 }, hp: 5000, maxHp: 5000 }),
    ];
    const enemies = [makeCombatant({ name: 'Bruiser', baseStats: { atk: 9999, esq: 0, vel: 0 }, hp: 5000, maxHp: 5000 })];

    const result = runBattle(allies, enemies, { seed: 6 });

    const exit = result.log.find((e): e is Extract<typeof e, { kind: 'vanguardExit' }> => e.kind === 'vanguardExit');
    expect(exit).toMatchObject({ unit: 'Fragile', side: 'allies', replacedBy: 'Backup' });
    const enters = result.log.filter((e): e is Extract<typeof e, { kind: 'vanguardEnter' }> => e.kind === 'vanguardEnter');
    expect(enters.map((e) => e.unit)).toContain('Backup');
  });

  it('the battle ends only once one side has no units left', () => {
    const allies = [makeCombatant({ name: 'Solo', baseStats: { atk: 9999, esq: 0, vel: 1 }, hp: 100000, maxHp: 100000 })];
    const enemies = [
      makeCombatant({ name: 'E1', baseStats: { atk: 1, esq: 0, vel: 0 }, hp: 1, maxHp: 1 }),
      makeCombatant({ name: 'E2', baseStats: { atk: 1, esq: 0, vel: 0 }, hp: 1, maxHp: 1 }),
      makeCombatant({ name: 'E3', baseStats: { atk: 1, esq: 0, vel: 0 }, hp: 1, maxHp: 1 }),
    ];

    const result = runBattle(allies, enemies, { seed: 11 });

    expect(result.winner).toBe('allies');
    expect(result.reason).toBe('elimination');
    expect(enemies.every((e) => e.hp === 0)).toBe(true);
  });

  it('a higher-VEL Vanguard lands more basic attacks than a slower one over the same battle', () => {
    const allies = [makeCombatant({ name: 'Fast', baseStats: { atk: 1, esq: 0, vel: 3 }, hp: 10 ** 7, maxHp: 10 ** 7 })];
    const enemies = [makeCombatant({ name: 'Slow', baseStats: { atk: 1, esq: 0, vel: 0 }, hp: 10 ** 7, maxHp: 10 ** 7 })];

    const result = runBattle(allies, enemies, { seed: 7 });

    const attacks = result.log.filter((e): e is Extract<typeof e, { kind: 'attack' }> => e.kind === 'attack');
    const fast = attacks.filter((e) => e.result.attacker.name === 'Fast').length;
    const slow = attacks.filter((e) => e.result.attacker.name === 'Slow').length;
    expect(fast).toBeGreaterThan(slow);
  });

  it('a Crash-stunned Vanguard loses its ready attack but still gets attacked', () => {
    const allies = [makeCombatant({ name: 'Stunned', baseStats: { atk: 10, esq: 0, vel: 0 }, hp: 10000, maxHp: 10000 })];
    const enemies = [makeCombatant({ name: 'Attacker', baseStats: { atk: 10, esq: 0, vel: 0 }, hp: 10000, maxHp: 10000 })];
    allies[0].statuses.push({ status: 'crash', remainingSeconds: 30, value: 0 });

    const result = runBattle(allies, enemies, { seed: 9 });

    const blocked = result.log.find((e): e is Extract<typeof e, { kind: 'attackBlockedStun' }> => e.kind === 'attackBlockedStun');
    expect(blocked?.unit).toBe('Stunned');
    const firstAttack = result.log.find((e): e is Extract<typeof e, { kind: 'attack' }> => e.kind === 'attack');
    expect(firstAttack?.result.attacker.name).toBe('Attacker');
  });
});
