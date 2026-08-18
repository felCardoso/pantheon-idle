import type { AbilityDefinition, CombatantData, CombatConstants } from '../schema';
import type { WorldId } from '../core/progression';

import constantsJson from './constants.json';

import abilitiesJson from './abilities.json';
import charactersJson from './characters.json';

import jurupariEnemies from './enemies/jurupari.json';
import yggdrasilEnemies from './enemies/yggdrasil.json';
import olympusEnemies from './enemies/olympus.json';
import takamagaharaEnemies from './enemies/takamagahara.json';
import duatEnemies from './enemies/duat.json';
import orunEnemies from './enemies/orun.json';

/**
 * CONTENT MANIFEST — the single place the engine learns what content exists.
 *
 * Abilities and characters live in one flat file each. They were once split per
 * world (jurupari.json, olympus.json, ...), but neither is actually world-scoped:
 * loader.ts immediately flattened both into a single id-keyed registry, and an
 * ability is looked up by id from anywhere regardless of which file it sat in. The
 * split only meant that adding a character touched a different file depending on
 * its mythology, while the grouping the UI really uses comes from each character's
 * own `mythology` field (see characterIdsByMythology).
 *
 * Enemies stay per-world because they genuinely are: each world's stages roll from
 * its own comuns/boss set, and ENEMY_REGISTRY is keyed by WorldId.
 *
 * Static imports (rather than a glob) are deliberate — the bundler needs to see
 * them to tree-shake and typecheck the JSON, and this project builds under both
 * Next.js/webpack and Deno (supabase/functions), neither of which shares a glob
 * syntax.
 */

/** Every ability definition in the game, ally and enemy alike, keyed by id downstream. */
export const ALL_ABILITIES = abilitiesJson as AbilityDefinition[];

/**
 * Every playable ally character across all implemented mythologies. Not every
 * world has allies yet (Duat/Orun have none — see docs/personagens.md); the ally
 * roster is one pool that fights across all worlds.
 */
export const ALL_CHARACTER_DATA = charactersJson as CombatantData[];

/** Enemy templates per world — comuns + boss for that world's stages. */
export const WORLD_ENEMIES: Record<WorldId, unknown> = {
  jurupari: jurupariEnemies,
  yggdrasil: yggdrasilEnemies,
  olympus: olympusEnemies,
  takamagahara: takamagaharaEnemies,
  duat: duatEnemies,
  orun: orunEnemies,
};

export const CONSTANTS = constantsJson as CombatConstants;
