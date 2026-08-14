import { describe, expect, it } from 'vitest';
import {
  comparePositions,
  difficultyMultiplier,
  enemyCountRange,
  ESTAGIOS_PER_FASE,
  isBossStage,
  nextStage,
  prevStage,
  RECOVERY_WINS_REQUIRED,
  resolveProgression,
  teamSizeMultiplier,
  TOTAL_FASES,
  type ProgressionState,
} from './progression';

describe('isBossStage', () => {
  it('is true only at the 6th slot of the last fase — one estágio past the 5 regular ones', () => {
    expect(isBossStage({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE + 1 })).toBe(true);
  });

  it('is false everywhere else, including the last regular estágio of the final fase', () => {
    expect(isBossStage({ fase: 1, estagio: 1 })).toBe(false);
    expect(isBossStage({ fase: TOTAL_FASES - 1, estagio: ESTAGIOS_PER_FASE })).toBe(false);
    expect(isBossStage({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE })).toBe(false);
  });
});

describe('nextStage', () => {
  it('advances to the next estágio within the same fase', () => {
    expect(nextStage({ fase: 1, estagio: 1 })).toEqual({ fase: 1, estagio: 2 });
    expect(nextStage({ fase: 3, estagio: 4 })).toEqual({ fase: 3, estagio: 5 });
  });

  it('rolls over to the next fase after the last regular estágio (except the final fase)', () => {
    expect(nextStage({ fase: 1, estagio: ESTAGIOS_PER_FASE })).toEqual({ fase: 2, estagio: 1 });
  });

  it('goes to the boss slot after the final fase\'s 5th estágio, instead of rolling to a fase 11', () => {
    expect(nextStage({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE })).toEqual({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE + 1 });
  });

  it('loops back to fase 1 estágio 1 after the boss stage', () => {
    expect(nextStage({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE + 1 })).toEqual({ fase: 1, estagio: 1 });
  });
});

describe('prevStage', () => {
  it('steps back one estágio within the same fase', () => {
    expect(prevStage({ fase: 3, estagio: 4 })).toEqual({ fase: 3, estagio: 3 });
  });

  it('crosses back into the previous fase\'s last estágio', () => {
    expect(prevStage({ fase: 3, estagio: 1 })).toEqual({ fase: 2, estagio: ESTAGIOS_PER_FASE });
  });

  it('is floored at fase 1 estágio 1 — never goes negative', () => {
    expect(prevStage({ fase: 1, estagio: 1 })).toEqual({ fase: 1, estagio: 1 });
  });

  it('steps back from the boss slot into the final fase\'s 5th estágio', () => {
    expect(prevStage({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE + 1 })).toEqual({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE });
  });
});

describe('comparePositions', () => {
  it('orders by fase first, then estágio', () => {
    expect(comparePositions({ fase: 1, estagio: 5 }, { fase: 2, estagio: 1 })).toBeLessThan(0);
    expect(comparePositions({ fase: 2, estagio: 3 }, { fase: 2, estagio: 1 })).toBeGreaterThan(0);
    expect(comparePositions({ fase: 2, estagio: 3 }, { fase: 2, estagio: 3 })).toBe(0);
  });
});

describe('difficultyMultiplier', () => {
  it('is 1x at estágio 1 of any fase (resets every fase, no cross-fase compounding)', () => {
    expect(difficultyMultiplier({ fase: 1, estagio: 1 })).toBe(1);
    expect(difficultyMultiplier({ fase: 7, estagio: 1 })).toBe(1);
  });

  it('adds a flat +5% per estágio within a fase, up to +20% at estágio 5', () => {
    expect(difficultyMultiplier({ fase: 1, estagio: 2 })).toBeCloseTo(1.05);
    expect(difficultyMultiplier({ fase: 1, estagio: 3 })).toBeCloseTo(1.1);
    expect(difficultyMultiplier({ fase: 1, estagio: 4 })).toBeCloseTo(1.15);
    expect(difficultyMultiplier({ fase: 1, estagio: 5 })).toBeCloseTo(1.2);
  });

  it('gives the same multiplier for the same estágio regardless of which fase it is in', () => {
    expect(difficultyMultiplier({ fase: 2, estagio: 3 })).toBeCloseTo(difficultyMultiplier({ fase: 9, estagio: 3 }));
  });
});

describe('enemyCountRange', () => {
  it('starts at exactly 2 enemies for estágio 1', () => {
    expect(enemyCountRange(1)).toEqual([2, 2]);
  });

  it('grows each estágio, capping at exactly 5 for estágio 5 (the fase\'s hardest wave)', () => {
    expect(enemyCountRange(2)).toEqual([2, 3]);
    expect(enemyCountRange(3)).toEqual([3, 4]);
    expect(enemyCountRange(4)).toEqual([3, 5]);
    expect(enemyCountRange(5)).toEqual([5, 5]);
  });
});

describe('teamSizeMultiplier', () => {
  it('is 1x at the original 4-character baseline', () => {
    expect(teamSizeMultiplier(4)).toBe(1);
  });

  it('scales down proportionally for a smaller owned roster', () => {
    expect(teamSizeMultiplier(1)).toBeCloseTo(0.25);
    expect(teamSizeMultiplier(2)).toBeCloseTo(0.5);
    expect(teamSizeMultiplier(3)).toBeCloseTo(0.75);
  });
});

describe('resolveProgression', () => {
  function state(position: ProgressionState['position'], frontier = position, recoveryWinsRemaining: number | null = null): ProgressionState {
    return { position, frontier, recoveryWinsRemaining };
  }

  describe('Avançar (mode: advance), not in recovery', () => {
    it('advances on a win, and moves the frontier forward with it', () => {
      const result = resolveProgression(state({ fase: 1, estagio: 1 }), { mode: 'advance', retreatOnLoss: false, won: true });
      expect(result).toEqual({ position: { fase: 1, estagio: 2 }, frontier: { fase: 1, estagio: 2 }, recoveryWinsRemaining: null });
    });

    it('retries the same estágio on a loss at the frontier, when retirar-se ao perder is off', () => {
      const result = resolveProgression(state({ fase: 1, estagio: 1 }), { mode: 'advance', retreatOnLoss: false, won: false });
      expect(result).toEqual({ position: { fase: 1, estagio: 1 }, frontier: { fase: 1, estagio: 1 }, recoveryWinsRemaining: null });
    });

    it('advances anyway on a loss when the next estágio was already reached before (replaying old content)', () => {
      const result = resolveProgression(state({ fase: 1, estagio: 1 }, { fase: 1, estagio: 4 }), {
        mode: 'advance',
        retreatOnLoss: false,
        won: false,
      });
      expect(result.position).toEqual({ fase: 1, estagio: 2 });
      expect(result.frontier).toEqual({ fase: 1, estagio: 4 }); // unchanged — already ahead of this
    });

    it('retreats one estágio on a loss at the frontier when retirar-se ao perder is on, and starts a recovery streak', () => {
      const result = resolveProgression(state({ fase: 2, estagio: 3 }), { mode: 'advance', retreatOnLoss: true, won: false });
      expect(result).toEqual({
        position: { fase: 2, estagio: 2 },
        frontier: { fase: 2, estagio: 3 },
        recoveryWinsRemaining: RECOVERY_WINS_REQUIRED,
      });
    });

    it('never retreats past fase 1 estágio 1', () => {
      const result = resolveProgression(state({ fase: 1, estagio: 1 }), { mode: 'advance', retreatOnLoss: true, won: false });
      expect(result.position).toEqual({ fase: 1, estagio: 1 });
    });
  });

  describe('Avançar recovery grind (after a retreat)', () => {
    it('a win decrements the streak and stays at the same estágio without advancing', () => {
      const result = resolveProgression(state({ fase: 2, estagio: 2 }, { fase: 2, estagio: 3 }, RECOVERY_WINS_REQUIRED), {
        mode: 'advance',
        retreatOnLoss: true,
        won: true,
      });
      expect(result).toEqual({ position: { fase: 2, estagio: 2 }, frontier: { fase: 2, estagio: 3 }, recoveryWinsRemaining: RECOVERY_WINS_REQUIRED - 1 });
    });

    it('the streak-completing win advances to the next estágio immediately, clearing recovery', () => {
      const result = resolveProgression(state({ fase: 2, estagio: 2 }, { fase: 2, estagio: 3 }, 1), {
        mode: 'advance',
        retreatOnLoss: true,
        won: true,
      });
      expect(result).toEqual({ position: { fase: 2, estagio: 3 }, frontier: { fase: 2, estagio: 3 }, recoveryWinsRemaining: null });
    });

    it('does not use the already-unlocked shortcut mid-grind — a loss during recovery still requires retreatOnLoss to retreat', () => {
      const noRetreat = resolveProgression(state({ fase: 2, estagio: 2 }, { fase: 2, estagio: 3 }, 3), {
        mode: 'advance',
        retreatOnLoss: false,
        won: false,
      });
      expect(noRetreat).toEqual({ position: { fase: 2, estagio: 2 }, frontier: { fase: 2, estagio: 3 }, recoveryWinsRemaining: 3 });
    });

    it('a loss mid-grind with retirar-se ao perder on retreats further and restarts the streak at 5', () => {
      const result = resolveProgression(state({ fase: 2, estagio: 2 }, { fase: 2, estagio: 3 }, 3), {
        mode: 'advance',
        retreatOnLoss: true,
        won: false,
      });
      expect(result).toEqual({
        position: { fase: 2, estagio: 1 },
        frontier: { fase: 2, estagio: 3 },
        recoveryWinsRemaining: RECOVERY_WINS_REQUIRED,
      });
    });
  });

  describe('Repetir estágio (mode: repeat)', () => {
    it('always retries the same estágio on a win, regardless of retirar-se ao perder', () => {
      const result = resolveProgression(state({ fase: 4, estagio: 2 }), { mode: 'repeat', retreatOnLoss: true, won: true });
      expect(result).toEqual({ position: { fase: 4, estagio: 2 }, frontier: { fase: 4, estagio: 2 }, recoveryWinsRemaining: null });
    });

    it('keeps repeating the same estágio on a loss when retirar-se ao perder is off', () => {
      const result = resolveProgression(state({ fase: 4, estagio: 2 }), { mode: 'repeat', retreatOnLoss: false, won: false });
      expect(result.position).toEqual({ fase: 4, estagio: 2 });
    });

    it('retreats one estágio on a loss when retirar-se ao perder is on, with no recovery streak (just keeps repeating the lower estágio)', () => {
      const result = resolveProgression(state({ fase: 4, estagio: 2 }), { mode: 'repeat', retreatOnLoss: true, won: false });
      expect(result).toEqual({ position: { fase: 4, estagio: 1 }, frontier: { fase: 4, estagio: 2 }, recoveryWinsRemaining: null });
    });

    it('is not limited to the frontier estágio — repeating an earlier, already-cleared stage never snaps back', () => {
      const result = resolveProgression(state({ fase: 1, estagio: 2 }, { fase: 5, estagio: 1 }), {
        mode: 'repeat',
        retreatOnLoss: false,
        won: true,
      });
      expect(result.position).toEqual({ fase: 1, estagio: 2 });
      expect(result.frontier).toEqual({ fase: 5, estagio: 1 }); // untouched
    });
  });

  it('frontier never regresses across any retreat', () => {
    const afterRetreat = resolveProgression(state({ fase: 3, estagio: 1 }, { fase: 3, estagio: 1 }), {
      mode: 'advance',
      retreatOnLoss: true,
      won: false,
    });
    expect(afterRetreat.position).toEqual({ fase: 2, estagio: 5 });
    expect(afterRetreat.frontier).toEqual({ fase: 3, estagio: 1 });
  });
});
