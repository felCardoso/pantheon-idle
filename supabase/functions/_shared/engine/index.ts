// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the engine.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
/**
 * THE ENGINE'S PUBLIC API — the only surface the view layer may import.
 *
 * Everything under src/engine/core/** and src/engine/data/** is INTERNAL.
 * Consumers (React components, hooks, API routes, src/data/**) must import
 * from '@/engine' (this file) and never from a deep path, so the engine's
 * internals can be reorganised without touching a single consumer.
 *
 * The rule is enforced automatically by scripts/check-engine-boundary.mjs,
 * which `npm run lint` runs — it fails the build on a deep import, on any
 * import that escapes src/engine, and on presentation concerns leaking in.
 *
 * WHAT DOES NOT BELONG HERE
 * Anything the UI has no business calling: the ability interpreter
 * (abilityEngine, effects, targeting, magnitude, context), the status
 * machinery (statusEffects, statusRegistry), the damage pipeline, and the
 * content manifest. Those are how the simulation works, not what it offers.
 *
 * The engine is deliberately dependency-free and framework-agnostic: it
 * imports nothing outside itself, touches no browser or Node global, and
 * knows nothing about colours, icons, portraits or copy. That is what lets
 * the same code run in the browser (PvE), in Deno (the PvP Edge Function,
 * see scripts/sync-pvp-engine.mjs) and in a terminal harness
 * (tools/battle-cli) with no adapters.
 */

// ---------------------------------------------------------------------------
// Data model — the vocabulary shared with content JSON and the UI.
// ---------------------------------------------------------------------------
export type {
  AbilityDefinition,
  AbilityEffect,
  AbilityScope,
  AbilityTrigger,
  BaseStats,
  BuffableAttribute,
  CombatantData,
  CombatConstants,
  Faction,
  Magnitude,
  Rarity,
  StatusType,
  TargetSelector,
} from './schema.ts';

export { PASSIVE_UNLOCK_RARITY, RARITY_RANK, attackIntervalFor } from './schema.ts';

// ---------------------------------------------------------------------------
// Simulation — run a battle, then replay its log at the view's own pace.
// ---------------------------------------------------------------------------
export { runBattle } from './core/battle.ts';
export type { BattleOptions, BattleResult } from './core/battle.ts';

export type { AttackResult, BattleLogEntry, Combatant, StatusEffectInstance } from './core/types.ts';
export { isAlive } from './core/types.ts';

/**
 * The intended engine→view boundary for animation: `runBattle` returns a
 * complete log, and these turn it into successive snapshots the UI can step
 * through on a real clock (every entry carries its `at` timestamp in seconds).
 * The view never inspects Combatant objects mid-battle — it reads snapshots.
 */
export { applyReplayEntry, buildNameToId, createInitialReplayState } from './core/replay.ts';
export type { ReplayState, UnitSnapshot } from './core/replay.ts';

// ---------------------------------------------------------------------------
// Content loading — turns ids into battle-ready Combatants.
// ---------------------------------------------------------------------------
export {
  ALL_CHARACTER_IDS,
  CONSTANTS,
  activeOptionsFor,
  benchOptionsFor,
  characterIdsByMythology,
  loadCharactersByIds,
  loadJurupariAllies,
  loadJurupariBoss,
  loadJurupariComuns,
  loadWorldBoss,
  loadWorldComuns,
  passiveAbilityFor,
} from './core/loader.ts';
export type { OwnedCharacterEntry } from './core/loader.ts';

// ---------------------------------------------------------------------------
// Progression — where a player is in the world/stage graph.
// ---------------------------------------------------------------------------
export {
  ESTAGIOS_PER_FASE,
  FASES_PER_WORLD,
  comparePositions,
  difficultyMultiplier,
  enemyCountRange,
  isBossStage,
  localFaseNumber,
  resolveProgression,
  teamSizeMultiplier,
  worldIdForFase,
  worldIndexForFase,
} from './core/progression.ts';
export type { WorldId, WorldPosition } from './core/progression.ts';

// ---------------------------------------------------------------------------
// Levelling + RNG.
// ---------------------------------------------------------------------------
export { levelForXp, levelMultiplier, xpProgress } from './core/leveling.ts';
export type { XpProgress } from './core/leveling.ts';

/** Exposed so callers can seed deterministic rolls (gacha, onboarding picks). */
export { Rng } from './core/rng.ts';
export type { RngLike } from './core/rng.ts';
