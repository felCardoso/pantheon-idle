import { describe, expect, it } from 'vitest';
import {
  comparePositions,
  difficultyMultiplier,
  enemyCountRange,
  ESTAGIOS_PER_FASE,
  FASES_PER_WORLD,
  isBossStage,
  localFaseNumber,
  nextStage,
  prevStage,
  RECOVERY_WINS_REQUIRED,
  resolveProgression,
  teamSizeMultiplier,
  TOTAL_FASES,
  WORLD_IDS,
  worldIdForFase,
  worldIndexForFase,
  type ProgressionState,
} from './progression';

describe('WORLD_IDS / worldIndexForFase / worldIdForFase / localFaseNumber', () => {
  it('has 6 worlds, in docs/mundos.md\'s proposed launch order', () => {
    expect(WORLD_IDS).toEqual(['jurupari', 'duat', 'orun', 'takamagahara', 'olympus', 'yggdrasil']);
  });

  it('TOTAL_FASES spans every world\'s 10 fases', () => {
    expect(TOTAL_FASES).toBe(FASES_PER_WORLD * WORLD_IDS.length);
  });

  it('maps fases 1-10 to world 0 (jurupari), 11-20 to world 1 (duat), and so on', () => {
    expect(worldIndexForFase(1)).toBe(0);
    expect(worldIndexForFase(10)).toBe(0);
    expect(worldIndexForFase(11)).toBe(1);
    expect(worldIndexForFase(20)).toBe(1);
    expect(worldIndexForFase(TOTAL_FASES)).toBe(WORLD_IDS.length - 1);
  });

  it('worldIdForFase resolves the same boundaries to the actual world id', () => {
    expect(worldIdForFase(1)).toBe('jurupari');
    expect(worldIdForFase(11)).toBe('duat');
    expect(worldIdForFase(TOTAL_FASES)).toBe('yggdrasil');
  });

  it('localFaseNumber wraps back to 1-10 within each world', () => {
    expect(localFaseNumber(1)).toBe(1);
    expect(localFaseNumber(10)).toBe(10);
    expect(localFaseNumber(11)).toBe(1);
    expect(localFaseNumber(TOTAL_FASES)).toBe(10);
  });
});

describe('isBossStage', () => {
  it('is true only at the 6th slot of the campaign\'s last fase — one estágio past the 5 regular ones', () => {
    expect(isBossStage({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE + 1 })).toBe(true);
  });

  it('is false everywhere else, including the last regular estágio of the final fase', () => {
    expect(isBossStage({ fase: 1, estagio: 1 })).toBe(false);
    expect(isBossStage({ fase: TOTAL_FASES - 1, estagio: ESTAGIOS_PER_FASE })).toBe(false);
    expect(isBossStage({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE })).toBe(false);
  });

  it('is also true at every non-final world\'s own 6th slot (fase 10, 20, 30...), not just the campaign end', () => {
    expect(isBossStage({ fase: FASES_PER_WORLD, estagio: ESTAGIOS_PER_FASE + 1 })).toBe(true);
    expect(isBossStage({ fase: FASES_PER_WORLD * 2, estagio: ESTAGIOS_PER_FASE + 1 })).toBe(true);
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

  it('loops back to fase 1 estágio 1 after the campaign\'s very last boss', () => {
    expect(nextStage({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE + 1 })).toEqual({ fase: 1, estagio: 1 });
  });

  it('advances into the next world\'s fase 1 estágio 1 after a non-final world\'s boss, instead of looping back', () => {
    expect(nextStage({ fase: FASES_PER_WORLD, estagio: ESTAGIOS_PER_FASE + 1 })).toEqual({ fase: FASES_PER_WORLD + 1, estagio: 1 });
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

  it('crossing back from a world\'s fase 1 lands on the previous world\'s boss slot, not its 5th regular estágio', () => {
    expect(prevStage({ fase: FASES_PER_WORLD + 1, estagio: 1 })).toEqual({ fase: FASES_PER_WORLD, estagio: ESTAGIOS_PER_FASE + 1 });
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

  it('gives the same multiplier for the same estágio regardless of which fase it is in, within one world', () => {
    expect(difficultyMultiplier({ fase: 2, estagio: 3 })).toBeCloseTo(difficultyMultiplier({ fase: 9, estagio: 3 }));
  });

  it('is 12% higher at a new world\'s estágio 1 than the previous world\'s estágio 1', () => {
    const jurupariBase = difficultyMultiplier({ fase: 1, estagio: 1 });
    const duatBase = difficultyMultiplier({ fase: FASES_PER_WORLD + 1, estagio: 1 });
    expect(duatBase).toBeCloseTo(jurupariBase * 1.12);
  });

  it('compounds the per-world step across every world crossed, always relative to Jurupari\'s estágio 1 baseline', () => {
    const jurupariBase = difficultyMultiplier({ fase: 1, estagio: 1 });
    const orunBase = difficultyMultiplier({ fase: FASES_PER_WORLD * 2 + 1, estagio: 1 });
    expect(orunBase).toBeCloseTo(jurupariBase * 1.12 * 1.12);
  });

  it('keeps the whole campaign inside the power curve a levelled roster can reach', () => {
    // A character gains +2%/level and a full same-mythology team +32% synergy, so even a
    // level-60 roster is only ~2.9x its starting power. The last world's baseline has to stay
    // under that or the campaign is unwinnable however long a player grinds — which is exactly
    // what the old 1.3 step (1.3^5 = 3.7x) did.
    const first = difficultyMultiplier({ fase: 1, estagio: 1 });
    const lastWorld = difficultyMultiplier({ fase: FASES_PER_WORLD * 5 + 1, estagio: 1 });
    const level60TeamPower = (1 + 60 * 0.02) * 1.32;
    expect(lastWorld / first).toBeLessThan(level60TeamPower);
  });

  it('still layers the intra-world +5%-per-estágio step on top of a later world\'s higher base', () => {
    const duatEstagio1 = difficultyMultiplier({ fase: FASES_PER_WORLD + 1, estagio: 1 });
    const duatEstagio5 = difficultyMultiplier({ fase: FASES_PER_WORLD + 1, estagio: 5 });
    expect(duatEstagio5).toBeCloseTo(duatEstagio1 * 1.2);
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
