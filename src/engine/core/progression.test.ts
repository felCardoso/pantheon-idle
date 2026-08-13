import { describe, expect, it } from 'vitest';
import { difficultyMultiplier, ESTAGIOS_PER_FASE, isBossStage, nextStage, TOTAL_FASES } from './progression';

describe('isBossStage', () => {
  it('is true only at the last estágio of the last fase', () => {
    expect(isBossStage({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE })).toBe(true);
  });

  it('is false everywhere else, including the last estágio of an earlier fase', () => {
    expect(isBossStage({ fase: 1, estagio: 1 })).toBe(false);
    expect(isBossStage({ fase: TOTAL_FASES - 1, estagio: ESTAGIOS_PER_FASE })).toBe(false);
    expect(isBossStage({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE - 1 })).toBe(false);
  });
});

describe('nextStage', () => {
  it('advances to the next estágio within the same fase', () => {
    expect(nextStage({ fase: 1, estagio: 1 })).toEqual({ fase: 1, estagio: 2 });
    expect(nextStage({ fase: 3, estagio: 4 })).toEqual({ fase: 3, estagio: 5 });
  });

  it('rolls over to the next fase after the last estágio', () => {
    expect(nextStage({ fase: 1, estagio: ESTAGIOS_PER_FASE })).toEqual({ fase: 2, estagio: 1 });
  });

  it('loops back to fase 1 estágio 1 after the boss stage', () => {
    expect(nextStage({ fase: TOTAL_FASES, estagio: ESTAGIOS_PER_FASE })).toEqual({ fase: 1, estagio: 1 });
  });
});

describe('difficultyMultiplier', () => {
  it('is 1x at estágio 1 of any fase (resets every fase, no cross-fase compounding)', () => {
    expect(difficultyMultiplier({ fase: 1, estagio: 1 })).toBe(1);
    expect(difficultyMultiplier({ fase: 7, estagio: 1 })).toBe(1);
  });

  it('compounds +15% per estágio within a fase', () => {
    expect(difficultyMultiplier({ fase: 1, estagio: 2 })).toBeCloseTo(1.15);
    expect(difficultyMultiplier({ fase: 1, estagio: 5 })).toBeCloseTo(Math.pow(1.15, 4));
  });

  it('gives the same multiplier for the same estágio regardless of which fase it is in', () => {
    expect(difficultyMultiplier({ fase: 2, estagio: 3 })).toBeCloseTo(difficultyMultiplier({ fase: 9, estagio: 3 }));
  });
});
