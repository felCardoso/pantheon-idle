import { describe, expect, it } from 'vitest';
import { WORLD_IDS, type WorldId } from '../core/progression';
import { ALL_CHARACTER_IDS } from '../core/loader';
import { applyPlayerAction, createTurnBattle, pendingAllyUnit } from './roundLoop';
import { loadTurnCombatantsByIds, loadTurnWorldBoss, loadTurnWorldComuns } from './loader';
import { targetableRow } from './formation';
import type { TurnCombatant } from './types';

/**
 * Smoke coverage for every authored turn-mode kit (src/engine/data/turnAbilities.json +
 * turnCharacterKits.json) — every playable character, every world's common-enemy archetypes and
 * every world boss. Not a balance check: just "the whole roster's kits parse and a full battle
 * runs to completion without the engine throwing," the same bar core/battle.test.ts's own
 * "full Jurupari.iso integration smoke test" holds the real-time roster to.
 */

function playToCompletion(allies: TurnCombatant[], enemies: TurnCombatant[], seed: number) {
  const state = createTurnBattle(allies, enemies, seed);
  let guard = 0;
  while (!state.winner && guard < 200) {
    guard += 1;
    const unit = pendingAllyUnit(state);
    if (!unit) break;
    const target = targetableRow(state.enemies)[0];
    applyPlayerAction(state, unit.id, { type: 'basicAttack', targetId: target?.id });
  }
  return state;
}

describe('every playable character\'s turn kit runs without throwing', () => {
  // 16 characters split into 4 teams of 4-5 so every kit gets exercised across a couple of battles.
  const teams = [
    ['jurupari', 'curupira', 'caipora', 'saci'],
    ['odin', 'freya', 'thor', 'ratatoskr'],
    ['zeus', 'hades', 'atena', 'satiro', 'medusa'],
    ['hercules', 'minotauro', 'amaterasu'],
  ];

  it('covers all 16 characters in characters.json', () => {
    expect(teams.flat().sort()).toEqual([...ALL_CHARACTER_IDS].sort());
  });

  for (const team of teams) {
    it(`[${team.join(', ')}] vs a common-enemy wave runs to a decided winner`, () => {
      const allies = loadTurnCombatantsByIds(team.map((id) => ({ id, xp: 0, rarity: 'Zero-Day' as const, version: 20, row: 'front' as const })));
      const enemies = loadTurnWorldComuns('jurupari', 3);
      const state = playToCompletion(allies, enemies, 1);
      expect(['allies', 'enemies', 'draw']).toContain(state.winner);
    });
  }
});

describe('every world\'s common-enemy archetypes and boss run without throwing', () => {
  const sampleAllies = () =>
    loadTurnCombatantsByIds([
      { id: 'odin', xp: 0, rarity: 'Zero-Day', version: 20, row: 'back' },
      { id: 'freya', xp: 0, rarity: 'Zero-Day', version: 20, row: 'back' },
      { id: 'zeus', xp: 0, row: 'front' },
      { id: 'hercules', xp: 0, row: 'front' },
      { id: 'amaterasu', xp: 0, row: 'front' },
    ]);

  for (const worldId of WORLD_IDS as readonly WorldId[]) {
    it(`${worldId}: common-enemy wave (3, cycling all 3 archetypes) runs to a decided winner`, () => {
      const state = playToCompletion(sampleAllies(), loadTurnWorldComuns(worldId, 3), 2);
      expect(['allies', 'enemies', 'draw']).toContain(state.winner);
    });

    it(`${worldId}: boss fight runs to a decided winner`, () => {
      const state = playToCompletion(sampleAllies(), loadTurnWorldBoss(worldId), 3);
      expect(['allies', 'enemies', 'draw']).toContain(state.winner);
    });
  }
});
