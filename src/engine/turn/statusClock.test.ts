import { describe, expect, it } from 'vitest';
import { applyStatus } from '../core/statusEffects';
import { advanceOneRound } from './statusClock';
import { makeTurnCombatant } from './testUtils';

describe('advanceOneRound', () => {
  it('decrements a duration-based status by exactly one round per call, expiring it once it hits 0', () => {
    const unit = makeTurnCombatant();
    applyStatus(unit, unit, 'buffAtk', 2, 0.2);

    advanceOneRound(unit, 1, () => {});
    expect(unit.statuses.find((s) => s.status === 'buffAtk')?.remainingSeconds).toBe(1);

    const log: unknown[] = [];
    advanceOneRound(unit, 2, (e) => log.push(e));
    expect(unit.statuses.find((s) => s.status === 'buffAtk')).toBeUndefined();
    expect(log).toContainEqual(expect.objectContaining({ kind: 'statusExpired', status: 'buffAtk' }));
  });

  it('pays a DOT/HOT tick exactly once per round', () => {
    const unit = makeTurnCombatant({ hp: 1000, maxHp: 1000 });
    applyStatus(unit, unit, 'leak', 5, 30); // 30 damage per tick, ignoresDef is an apply-time concern, irrelevant here

    advanceOneRound(unit, 1, () => {});
    expect(unit.hp).toBe(970);

    advanceOneRound(unit, 2, () => {});
    expect(unit.hp).toBe(940);
  });

  it('leaves crash (stun) completely untouched — round-loop.ts consumes it explicitly, not this', () => {
    const unit = makeTurnCombatant();
    applyStatus(unit, unit, 'crash', 1, 0);

    advanceOneRound(unit, 1, () => {});
    advanceOneRound(unit, 2, () => {});
    advanceOneRound(unit, 3, () => {});

    const crash = unit.statuses.find((s) => s.status === 'crash');
    expect(crash).toBeDefined();
    expect(crash?.remainingSeconds).toBe(1); // unchanged across every call
  });
});
