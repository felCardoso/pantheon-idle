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

    expect(state.units[a.id]).toEqual({ id: a.id, hp: 1000, maxHp: 1000, shield: 0, statuses: {} });
    expect(state.units[b.id]).toEqual({ id: b.id, hp: 500, maxHp: 500, shield: 0, statuses: {} });
  });

  it('every entry advances the replay clock to its own timestamp', () => {
    const a = makeCombatant();
    let state = createInitialReplayState([a], []);
    expect(state.now).toBe(0);
    state = applyReplayEntry(state, { at: 3.4, kind: 'battleStart' }, {});
    expect(state.now).toBe(3.4);
  });

  it('a dodge does not change HP', () => {
    const a = makeCombatant();
    const b = makeCombatant();
    let state = createInitialReplayState([a], [b]);
    state = applyReplayEntry(state, { at: 0, kind: 'dodge', attacker: a.name, defender: b.name }, {});
    expect(state.units[b.id].hp).toBe(b.maxHp);
  });

  it('an attack applies shield-then-HP damage using the defender.id', () => {
    const defender = makeCombatant({ name: 'Def', maxHp: 1000 });
    const nameToId = buildNameToId([], [defender]);
    let state = createInitialReplayState([], [defender]);
    state = withInitialShield(state, defender.id, 30);

    const entry: BattleLogEntry = { at: 0, kind: 'attack', result: fakeAttack({ defender, finalDamage: 50, hpDamage: 20, shieldAbsorbed: 30 }) };
    state = applyReplayEntry(state, entry, nameToId);

    expect(state.units[defender.id]).toMatchObject({ shield: 0, hp: 980 });
  });

  it('a dodged attack changes nothing', () => {
    const defender = makeCombatant({ name: 'Def' });
    let state = createInitialReplayState([], [defender]);
    const entry: BattleLogEntry = { at: 0, kind: 'attack', result: fakeAttack({ defender, dodged: true, finalDamage: 0, hpDamage: 0 }) };
    state = applyReplayEntry(state, entry, {});
    expect(state.units[defender.id].hp).toBe(defender.maxHp);
  });

  it('a damage statusTick hits shield first, like the docs specify for Leak', () => {
    const target = makeCombatant({ name: 'T', maxHp: 1000 });
    const nameToId = buildNameToId([target], []);
    let state = createInitialReplayState([target], []);
    state = withInitialShield(state, target.id, 10);

    const entry: BattleLogEntry = { at: 0, kind: 'statusTick', target: 'T', status: 'trojan', amount: 30, tickKind: 'damage', shieldAbsorbed: 10 };
    state = applyReplayEntry(state, entry, nameToId);

    expect(state.units[target.id]).toMatchObject({ shield: 0, hp: 980 });
  });

  it('a heal statusTick (Nanites) increases HP without exceeding max', () => {
    const target = makeCombatant({ name: 'T', maxHp: 1000 });
    const nameToId = buildNameToId([target], []);
    let state = createInitialReplayState([target], []);
    state = applyReplayEntry(state, { at: 0, kind: 'statusTick', target: 'T', status: 'nanites', amount: 9999, tickKind: 'heal', shieldAbsorbed: 0 }, nameToId);
    expect(state.units[target.id].hp).toBe(1000);
  });

  it('heal and shieldGranted entries resolve their target by name', () => {
    const target = makeCombatant({ name: 'T', maxHp: 1000, hp: 500 });
    const nameToId = buildNameToId([target], []);
    let state = createInitialReplayState([target], []);
    // createInitialReplayState always starts at full HP; force a deficit to prove the heal cap works.
    state = { ...state, units: { ...state.units, [target.id]: { ...state.units[target.id], hp: 500 } } };

    state = applyReplayEntry(state, { at: 0, kind: 'heal', target: 'T', amount: 100, source: 'X' }, nameToId);
    expect(state.units[target.id].hp).toBe(600);

    state = applyReplayEntry(state, { at: 0, kind: 'shieldGranted', target: 'T', amount: 50, source: 'X' }, nameToId);
    expect(state.units[target.id].shield).toBe(50);
  });

  it('iceReflect applies shield-then-HP damage to its target, same as a normal attack', () => {
    const attacker = makeCombatant({ name: 'Attacker', maxHp: 1000 });
    const nameToId = buildNameToId([attacker], []);
    let state = createInitialReplayState([attacker], []);
    // createInitialReplayState always starts at shield 0; force a starting shield to prove the split works.
    state = { ...state, units: { ...state.units, [attacker.id]: { ...state.units[attacker.id], shield: 30 } } };

    state = applyReplayEntry(
      state,
      { at: 0, kind: 'iceReflect', source: 'Defender', target: 'Attacker', amount: 50, shieldAbsorbed: 30, hpDamage: 20, targetDied: false },
      nameToId,
    );

    expect(state.units[attacker.id].shield).toBe(0);
    expect(state.units[attacker.id].hp).toBe(980);
  });

  it('enrage applies each listed per-unit true-damage amount', () => {
    const a = makeCombatant({ name: 'A', maxHp: 1000 });
    const b = makeCombatant({ name: 'B', maxHp: 500 });
    const nameToId = buildNameToId([a], [b]);
    let state = createInitialReplayState([a], [b]);

    state = applyReplayEntry(
      state,
      { at: 31, kind: 'overload', percent: 0.05, damages: [{ target: 'A', amount: 20 }, { target: 'B', amount: 10 }] },
      nameToId,
    );

    expect(state.units[a.id].hp).toBe(980);
    expect(state.units[b.id].hp).toBe(490);
  });

  it('statusApplied tracks a non-stacking status as present (count 1), and reapplying does not accumulate', () => {
    const target = makeCombatant({ name: 'T' });
    const nameToId = buildNameToId([target], []);
    let state = createInitialReplayState([target], []);

    const entry: BattleLogEntry = { at: 0, kind: 'statusApplied', target: 'T', status: 'lag', source: 'X', seconds: 2 };
    state = applyReplayEntry(state, entry, nameToId);
    expect(state.units[target.id].statuses.lag).toBe(1);

    // Reapplying (e.g. every round) must not drift the count upward.
    state = applyReplayEntry(state, entry, nameToId);
    expect(state.units[target.id].statuses.lag).toBe(1);
  });

  it('statusApplied accumulates a stackable status (Leak) across independent applications', () => {
    const target = makeCombatant({ name: 'T' });
    const nameToId = buildNameToId([target], []);
    let state = createInitialReplayState([target], []);
    const entry: BattleLogEntry = { at: 0, kind: 'statusApplied', target: 'T', status: 'leak', source: 'X', seconds: 3 };

    state = applyReplayEntry(state, entry, nameToId);
    state = applyReplayEntry(state, entry, nameToId);

    expect(state.units[target.id].statuses.leak).toBe(2);
  });

  it('statusExpired decrements the count and removes the entry once it reaches 0', () => {
    const target = makeCombatant({ name: 'T' });
    const nameToId = buildNameToId([target], []);
    let state = createInitialReplayState([target], []);
    state = applyReplayEntry(state, { at: 0, kind: 'statusApplied', target: 'T', status: 'lag', source: 'X', seconds: 2 }, nameToId);

    state = applyReplayEntry(state, { at: 0, kind: 'statusExpired', target: 'T', status: 'lag' }, nameToId);

    expect(state.units[target.id].statuses.lag).toBeUndefined();
  });

  describe('queue rotation (clashEnd)', () => {
    it('starts each side in its natural array order', () => {
      const a = makeCombatant({ name: 'A' });
      const b = makeCombatant({ name: 'B' });
      const c = makeCombatant({ name: 'C' });
      const state = createInitialReplayState([a, b], [c]);
      expect(state.allyOrder).toEqual([a.id, b.id]);
      expect(state.enemyOrder).toEqual([c.id]);
    });

    it('vanguardExit drops the ejected unit and promotes the named replacement', () => {
      const a = makeCombatant({ name: 'A' });
      const b = makeCombatant({ name: 'B' });
      const enemy = makeCombatant({ name: 'E' });
      const nameToId = buildNameToId([a, b], [enemy]);
      let state = createInitialReplayState([a, b], [enemy]);
      expect(state.allyVanguardId).toBe(a.id);

      state = applyReplayEntry(state, { at: 5, kind: 'vanguardExit', unit: 'A', side: 'allies', replacedBy: 'B' }, nameToId);

      expect(state.allyOrder).toEqual([b.id]);
      expect(state.allyVanguardId).toBe(b.id);
      expect(state.enemyOrder).toEqual([enemy.id]);
    });

    it('a surviving Vanguard is never rotated to the back — it holds the front until ejected', () => {
      const a = makeCombatant({ name: 'A' });
      const b = makeCombatant({ name: 'B' });
      const enemy = makeCombatant({ name: 'E' });
      const nameToId = buildNameToId([a, b], [enemy]);
      let state = createInitialReplayState([a, b], [enemy]);

      state = applyReplayEntry(state, { at: 2, kind: 'attack', result: fakeAttack({ defender: enemy, finalDamage: 10, hpDamage: 10 }) }, nameToId);

      expect(state.allyOrder).toEqual([a.id, b.id]);
      expect(state.allyVanguardId).toBe(a.id);
    });

    it('the last vanguardExit on a side leaves no replacement', () => {
      const a = makeCombatant({ name: 'A' });
      const enemy = makeCombatant({ name: 'E' });
      const nameToId = buildNameToId([a], [enemy]);
      let state = createInitialReplayState([a], [enemy]);

      state = applyReplayEntry(state, { at: 9, kind: 'vanguardExit', unit: 'A', side: 'allies', replacedBy: null }, nameToId);

      expect(state.allyOrder).toEqual([]);
      expect(state.allyVanguardId).toBeNull();
    });
  });
});

function withInitialShield(state: ReturnType<typeof createInitialReplayState>, id: string, shield: number) {
  return { ...state, units: { ...state.units, [id]: { ...state.units[id], shield } } };
}
