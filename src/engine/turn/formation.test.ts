import { describe, expect, it } from 'vitest';
import { isLegalSingleTarget, targetableRow } from './formation';
import { makeTurnCombatant } from './testUtils';

describe('targetableRow', () => {
  it('restricts to the front row while it has a living member', () => {
    const front = makeTurnCombatant({ name: 'Front', row: 'front' });
    const back = makeTurnCombatant({ name: 'Back', row: 'back' });
    expect(targetableRow([front, back]).map((c) => c.name)).toEqual(['Front']);
  });

  it('falls back to the back row once the front row is fully dead', () => {
    const front = makeTurnCombatant({ name: 'Front', row: 'front', hp: 0 });
    const back = makeTurnCombatant({ name: 'Back', row: 'back' });
    expect(targetableRow([front, back]).map((c) => c.name)).toEqual(['Back']);
  });

  it('ignores dead back-row units too — an empty pool if both rows are dead', () => {
    const front = makeTurnCombatant({ name: 'Front', row: 'front', hp: 0 });
    const back = makeTurnCombatant({ name: 'Back', row: 'back', hp: 0 });
    expect(targetableRow([front, back])).toEqual([]);
  });

  it('a living front-row member with allies elsewhere in front stays fully targetable', () => {
    const frontA = makeTurnCombatant({ name: 'FrontA', row: 'front' });
    const frontB = makeTurnCombatant({ name: 'FrontB', row: 'front', hp: 0 });
    const back = makeTurnCombatant({ name: 'Back', row: 'back' });
    expect(targetableRow([frontA, frontB, back]).map((c) => c.name)).toEqual(['FrontA']);
  });
});

describe('isLegalSingleTarget', () => {
  it('accepts a living front-row unit while front is up', () => {
    const front = makeTurnCombatant({ name: 'Front', row: 'front' });
    const back = makeTurnCombatant({ name: 'Back', row: 'back' });
    expect(isLegalSingleTarget(front, [front, back])).toBe(true);
    expect(isLegalSingleTarget(back, [front, back])).toBe(false);
  });

  it('accepts a back-row unit once front is fully dead', () => {
    const front = makeTurnCombatant({ name: 'Front', row: 'front', hp: 0 });
    const back = makeTurnCombatant({ name: 'Back', row: 'back' });
    expect(isLegalSingleTarget(back, [front, back])).toBe(true);
  });
});
