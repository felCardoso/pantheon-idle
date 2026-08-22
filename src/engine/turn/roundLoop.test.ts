import { describe, expect, it } from 'vitest';
import { targetableRow } from './formation';
import { applyPlayerAction, createTurnBattle, pendingAllyUnit, runAutoTurnBattle } from './roundLoop';
import { makeTurnAbility, makeTurnCombatant } from './testUtils';

describe('DOT damage cascades like a basic attack', () => {
  it('a DOT tick that crosses the 50% HP threshold fires the onHalfHp passive, same as a basic attack would', () => {
    const shieldOnHalfHp = makeTurnAbility({
      id: 'shield-on-half-hp',
      scope: 'passive',
      trigger: 'onHalfHp',
      effects: [{ type: 'grantShield', target: 'self', magnitude: { kind: 'flat', value: 100 } }],
    });
    // hp 520/1000 with a 40/round leak DOT crosses the 500 (50%) threshold on the very first tick.
    const ally = makeTurnCombatant({
      name: 'Ally',
      hp: 520,
      maxHp: 1000,
      passiveAbilities: [shieldOnHalfHp],
      statuses: [{ status: 'leak', remainingSeconds: 5, value: 40 }],
    });
    const enemy = makeTurnCombatant({ name: 'Enemy', isAlly: false });

    const state = createTurnBattle([ally], [enemy], 1);

    expect(ally.hp).toBe(480);
    expect(ally.shield).toBe(100);
    expect(state.log).toContainEqual(expect.objectContaining({ kind: 'shieldGranted', target: 'Ally' }));
  });
});

describe('stun', () => {
  it('a stunned unit skips exactly its next turn, and the stun is gone by the round after', () => {
    const stunAll = makeTurnAbility({
      id: 'stun-all',
      trigger: 'onTurnStart',
      effects: [{ type: 'applyStatus', target: 'allEnemies', status: 'crash', magnitude: { kind: 'flat', value: 0 }, durationSeconds: 1 }],
    });
    const stunner = makeTurnCombatant({ id: 'stunner', name: 'Stunner', activeAbilities: [stunAll], baseStats: { atk: 0, esq: 0 } });
    const enemy = makeTurnCombatant({ id: 'enemy', name: 'Enemy', isAlly: false, baseStats: { atk: 50, esq: 0 } });

    const state = createTurnBattle([stunner], [enemy], 1);
    applyPlayerAction(state, stunner.id, { type: 'ability' });

    expect(state.log).toContainEqual(expect.objectContaining({ kind: 'turnSkippedStun', unit: 'Enemy' }));
    expect(state.log.some((e) => e.kind === 'attack')).toBe(false); // the enemy's whole turn was consumed by the stun

    // Round 2: the enemy is no longer stunned and the stunner can act normally again.
    expect(pendingAllyUnit(state)?.name).toBe('Stunner');
    applyPlayerAction(state, stunner.id, { type: 'basicAttack', targetId: enemy.id });
    expect(state.log.some((e) => e.kind === 'attack')).toBe(true);
  });
});

describe('targeting an ally', () => {
  it('a support ability may target any living ally, ignoring row — formation only gates attacks against the enemy', () => {
    const empowerAlly = makeTurnAbility({
      id: 'empower-ally',
      trigger: 'onTurnStart',
      effects: [{ type: 'buffAttribute', target: 'chosenTarget', attribute: 'atk', magnitude: { kind: 'percent', value: 0.5 }, durationSeconds: 1 }],
    });
    const support = makeTurnCombatant({ id: 'support', name: 'Support', row: 'front', activeAbilities: [empowerAlly] });
    const backAlly = makeTurnCombatant({ id: 'back-ally', name: 'BackAlly', row: 'back', baseStats: { atk: 100 } });
    const enemy = makeTurnCombatant({ id: 'enemy', name: 'Enemy', isAlly: false });

    const state = createTurnBattle([support, backAlly], [enemy], 4);
    // support's front row is alive, yet targeting the back-row ally must still succeed.
    expect(() => applyPlayerAction(state, support.id, { type: 'ability', targetId: backAlly.id })).not.toThrow();
    expect(backAlly.statuses.some((s) => s.status === 'buffAtk')).toBe(true);
  });
});

describe('channeling', () => {
  it('resolves its effect only once the channel completes, never before', () => {
    const bigHit = makeTurnAbility({
      id: 'big-hit',
      trigger: 'onTurnStart',
      channelRounds: 2,
      effects: [{ type: 'directDamage', target: 'chosenTarget', magnitude: { kind: 'flat', value: 500 } }],
    });
    const caster = makeTurnCombatant({ id: 'caster', name: 'Caster', activeAbilities: [bigHit], hp: 1000, maxHp: 1000 });
    const victim = makeTurnCombatant({ id: 'victim', name: 'Victim', isAlly: false, hp: 1000, maxHp: 1000, baseStats: { atk: 0 } });

    const state = createTurnBattle([caster], [victim], 2);
    applyPlayerAction(state, caster.id, { type: 'ability', targetId: victim.id });

    const kinds = state.log.map((e) => e.kind);
    const startIdx = kinds.indexOf('channelStart');
    const continueIdx = kinds.indexOf('channelContinue');
    const resolvedIdx = kinds.indexOf('channelResolved');

    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(continueIdx).toBeGreaterThan(startIdx);
    expect(resolvedIdx).toBeGreaterThan(continueIdx);
    expect(victim.hp).toBe(500); // the 500-flat directDamage landed exactly once, on schedule
  });

  it('is cancelled — its effect never fires — if the caster dies mid-channel', () => {
    const bigHit = makeTurnAbility({
      id: 'big-hit',
      trigger: 'onTurnStart',
      channelRounds: 2,
      effects: [{ type: 'directDamage', target: 'chosenTarget', magnitude: { kind: 'flat', value: 500 } }],
    });
    const caster = makeTurnCombatant({ id: 'caster', name: 'Caster', row: 'front', activeAbilities: [bigHit], hp: 1, maxHp: 1000 });
    const guardian = makeTurnCombatant({ id: 'guardian', name: 'Guardian', row: 'front', hp: 1000, maxHp: 1000, baseStats: { atk: 0 } });
    const striker = makeTurnCombatant({ id: 'striker', name: 'Striker', isAlly: false, row: 'front', baseStats: { atk: 9999, esq: 0 } });
    const victim = makeTurnCombatant({ id: 'victim', name: 'Victim', isAlly: false, row: 'front', hp: 1000, maxHp: 1000, baseStats: { atk: 0 } });

    const state = createTurnBattle([caster, guardian], [striker, victim], 3);
    applyPlayerAction(state, caster.id, { type: 'ability', targetId: victim.id }); // caster starts channeling
    applyPlayerAction(state, guardian.id, { type: 'basicAttack', targetId: striker.id }); // completes the ally phase -> enemy phase runs, striker one-shots the 1-HP caster

    expect(state.log).toContainEqual(expect.objectContaining({ kind: 'death', unit: 'Caster' }));
    expect(state.log.some((e) => e.kind === 'channelResolved')).toBe(false);
    expect(victim.hp).toBe(1000); // the channeled hit never landed
  });
});

describe('runBattle determinism', () => {
  function runScripted(seed: number) {
    const allies = [makeTurnCombatant({ id: 'a1', name: 'A1' }), makeTurnCombatant({ id: 'a2', name: 'A2' })];
    const enemies = [makeTurnCombatant({ id: 'e1', name: 'E1', isAlly: false }), makeTurnCombatant({ id: 'e2', name: 'E2', isAlly: false })];
    const state = createTurnBattle(allies, enemies, seed);

    let guard = 0;
    while (!state.winner && guard < 40) {
      guard += 1;
      const unit = pendingAllyUnit(state);
      if (!unit) break;
      const target = targetableRow(state.enemies)[0];
      applyPlayerAction(state, unit.id, { type: 'basicAttack', targetId: target?.id });
    }
    return state.log;
  }

  it('the same seed and the same action script produce a byte-identical log across two runs', () => {
    expect(runScripted(777)).toEqual(runScripted(777));
  });

  it('a different seed produces a different log (sanity check that the seed is actually threaded through)', () => {
    expect(runScripted(1)).not.toEqual(runScripted(2));
  });
});

describe('runAutoTurnBattle', () => {
  it('plays both sides automatically and always returns a decided winner', () => {
    const allies = [makeTurnCombatant({ id: 'a1', name: 'A1' }), makeTurnCombatant({ id: 'a2', name: 'A2' })];
    const enemies = [makeTurnCombatant({ id: 'e1', name: 'E1', isAlly: false, hp: 200, maxHp: 200 })];
    const state = runAutoTurnBattle(allies, enemies, 42);
    expect(['allies', 'enemies', 'draw']).toContain(state.winner);
    expect(pendingAllyUnit(state)).toBeNull(); // never left mid-decision
  });

  it('is deterministic given the same seed', () => {
    const build = () => [makeTurnCombatant({ id: 'a1', name: 'A1' }), makeTurnCombatant({ id: 'a2', name: 'A2' })];
    const enemy = () => [makeTurnCombatant({ id: 'e1', name: 'E1', isAlly: false })];
    expect(runAutoTurnBattle(build(), enemy(), 7).log).toEqual(runAutoTurnBattle(build(), enemy(), 7).log);
  });
});
