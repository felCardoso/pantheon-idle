import { describe, expect, it } from 'vitest';
import { applyReplayEntry, buildNameToId, createInitialReplayState } from './replay';
import { makeCombatant } from './testUtils';
import type { AttackResult, BattleLogEntry } from './types';

function fakeAttack(overrides: Partial<AttackResult> = {}): AttackResult {
  return {
    attacker: makeCombatant({ name: 'Atk' }),
    defender: makeCombatant({ name: 'Def' }),
    dodged: false,
    crit: false,
    elementalAdvantage: false,
    rawDamage: 100,
    finalDamage: 100,
    shieldAbsorbed: 0,
    hpDamage: 100,
    defenderDied: false,
    ...overrides,
  };
}

describe('replay', () => {
  it('starts every unit at full HP and no shield, regardless of the (already-mutated) Combatant.hp passed in', () => {
    const a = makeCombatant({ name: 'A', hp: 5, maxHp: 1000 }); // as if read after a battle already ran
    const b = makeCombatant({ name: 'B', hp: 0, maxHp: 500 });

    const state = createInitialReplayState([a], [b]);

    expect(state.units[a.id]).toEqual({ id: a.id, hp: 1000, maxHp: 1000, shield: 0 });
    expect(state.units[b.id]).toEqual({ id: b.id, hp: 500, maxHp: 500, shield: 0 });
  });

  it('roundStart sets the round and resets the turn counter', () => {
    const a = makeCombatant();
    let state = createInitialReplayState([a], []);
    state = applyReplayEntry(state, { kind: 'roundStart', round: 3 }, {});
    expect(state.round).toBe(3);
    expect(state.turnInRound).toBe(0);
  });

  it('a dodge does not change HP but counts as a turn', () => {
    const a = makeCombatant();
    const b = makeCombatant();
    let state = createInitialReplayState([a], [b]);
    state = applyReplayEntry(state, { kind: 'dodge', attacker: a.name, defender: b.name }, {});
    expect(state.turnInRound).toBe(1);
    expect(state.units[b.id].hp).toBe(b.maxHp);
  });

  it('an attack applies shield-then-HP damage using the defender.id, and counts as a turn', () => {
    const defender = makeCombatant({ name: 'Def', maxHp: 1000 });
    const nameToId = buildNameToId([], [defender]);
    let state = createInitialReplayState([], [defender]);
    state = withInitialShield(state, defender.id, 30);

    const entry: BattleLogEntry = { kind: 'attack', result: fakeAttack({ defender, finalDamage: 50, hpDamage: 20, shieldAbsorbed: 30 }) };
    state = applyReplayEntry(state, entry, nameToId);

    expect(state.turnInRound).toBe(1);
    expect(state.units[defender.id]).toMatchObject({ shield: 0, hp: 980 });
  });

  it('a dodged attack still counts as a turn but changes nothing else', () => {
    const defender = makeCombatant({ name: 'Def' });
    let state = createInitialReplayState([], [defender]);
    const entry: BattleLogEntry = { kind: 'attack', result: fakeAttack({ defender, dodged: true, finalDamage: 0, hpDamage: 0 }) };
    state = applyReplayEntry(state, entry, {});
    expect(state.turnInRound).toBe(1);
    expect(state.units[defender.id].hp).toBe(defender.maxHp);
  });

  it('a damage statusTick hits shield first, like the docs specify for Vírus', () => {
    const target = makeCombatant({ name: 'T', maxHp: 1000 });
    const nameToId = buildNameToId([target], []);
    let state = createInitialReplayState([target], []);
    state = withInitialShield(state, target.id, 10);

    const entry: BattleLogEntry = { kind: 'statusTick', target: 'T', status: 'virus', amount: 30, tickKind: 'damage', shieldAbsorbed: 10 };
    state = applyReplayEntry(state, entry, nameToId);

    expect(state.units[target.id]).toMatchObject({ shield: 0, hp: 980 });
  });

  it('a heal statusTick (Regeneração) increases HP without exceeding max', () => {
    const target = makeCombatant({ name: 'T', maxHp: 1000 });
    const nameToId = buildNameToId([target], []);
    let state = createInitialReplayState([target], []);
    state = applyReplayEntry(state, { kind: 'statusTick', target: 'T', status: 'regeneracao', amount: 9999, tickKind: 'heal', shieldAbsorbed: 0 }, nameToId);
    expect(state.units[target.id].hp).toBe(1000);
  });

  it('heal and shieldGranted entries resolve their target by name', () => {
    const target = makeCombatant({ name: 'T', maxHp: 1000, hp: 500 });
    const nameToId = buildNameToId([target], []);
    let state = createInitialReplayState([target], []);
    // createInitialReplayState always starts at full HP; force a deficit to prove the heal cap works.
    state = { ...state, units: { ...state.units, [target.id]: { ...state.units[target.id], hp: 500 } } };

    state = applyReplayEntry(state, { kind: 'heal', target: 'T', amount: 100, source: 'X' }, nameToId);
    expect(state.units[target.id].hp).toBe(600);

    state = applyReplayEntry(state, { kind: 'shieldGranted', target: 'T', amount: 50, source: 'X' }, nameToId);
    expect(state.units[target.id].shield).toBe(50);
  });

  it('enrage applies each listed per-unit true-damage amount', () => {
    const a = makeCombatant({ name: 'A', maxHp: 1000 });
    const b = makeCombatant({ name: 'B', maxHp: 500 });
    const nameToId = buildNameToId([a], [b]);
    let state = createInitialReplayState([a], [b]);

    state = applyReplayEntry(
      state,
      { kind: 'enrage', round: 30, percent: 0.02, damages: [{ target: 'A', amount: 20 }, { target: 'B', amount: 10 }] },
      nameToId,
    );

    expect(state.units[a.id].hp).toBe(980);
    expect(state.units[b.id].hp).toBe(490);
  });
});

function withInitialShield(state: ReturnType<typeof createInitialReplayState>, id: string, shield: number) {
  return { ...state, units: { ...state.units, [id]: { ...state.units[id], shield } } };
}
