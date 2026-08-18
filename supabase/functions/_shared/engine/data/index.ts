// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the engine.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import type { AbilityDefinition, CombatantData, CombatConstants } from '../schema.ts';
import type { WorldId } from '../core/progression.ts';

import constantsJson from './constants.json' with { type: 'json' };

import jurupariAbilities from './abilities/jurupari.json' with { type: 'json' };
import jurupariCharacters from './characters/jurupari.json' with { type: 'json' };
import jurupariEnemies from './enemies/jurupari.json' with { type: 'json' };

import yggdrasilAbilities from './abilities/yggdrasil.json' with { type: 'json' };
import yggdrasilCharacters from './characters/yggdrasil.json' with { type: 'json' };
import yggdrasilEnemyAbilities from './abilities/yggdrasil-enemies.json' with { type: 'json' };
import yggdrasilEnemies from './enemies/yggdrasil.json' with { type: 'json' };

import olympusAbilities from './abilities/olympus.json' with { type: 'json' };
import olympusCharacters from './characters/olympus.json' with { type: 'json' };
import olympusEnemyAbilities from './abilities/olympus-enemies.json' with { type: 'json' };
import olympusEnemies from './enemies/olympus.json' with { type: 'json' };

import takamagaharaAbilities from './abilities/takamagahara.json' with { type: 'json' };
import takamagaharaCharacters from './characters/takamagahara.json' with { type: 'json' };
import takamagaharaEnemies from './enemies/takamagahara.json' with { type: 'json' };

import duatAbilities from './abilities/duat.json' with { type: 'json' };
import duatEnemies from './enemies/duat.json' with { type: 'json' };

import orunAbilities from './abilities/orun.json' with { type: 'json' };
import orunEnemies from './enemies/orun.json' with { type: 'json' };

/**
 * CONTENT MANIFEST — the single place the engine learns what content exists.
 *
 * Adding a mythology/world used to mean editing three separate spots inside
 * loader.ts (its import block, ALL_CHARACTERS, and the two registries). Now it
 * is one entry in WORLD_CONTENT below: loader.ts derives every registry from
 * this table and never changes when content is added.
 *
 * Static imports (rather than a glob) are deliberate — the bundler needs to
 * see them to tree-shake and typecheck the JSON, and this project builds under
 * both Next.js/webpack and Deno (supabase/functions), neither of which shares
 * a glob syntax.
 */
export interface WorldContent {
  /** Playable ally characters from this mythology. Empty is valid — Duat/Orun have none yet (see docs/personagens.md). */
  characters: CombatantData[];
  /** Enemy templates for this world's stages, boss included. */
  enemies: unknown;
  /** Every ability definition referenced by the two above. */
  abilities: AbilityDefinition[];
}

export const WORLD_CONTENT: Record<WorldId, WorldContent> = {
  jurupari: {
    characters: jurupariCharacters as CombatantData[],
    enemies: jurupariEnemies,
    abilities: jurupariAbilities as AbilityDefinition[],
  },
  yggdrasil: {
    characters: yggdrasilCharacters as CombatantData[],
    enemies: yggdrasilEnemies,
    abilities: [...(yggdrasilAbilities as AbilityDefinition[]), ...(yggdrasilEnemyAbilities as AbilityDefinition[])],
  },
  olympus: {
    characters: olympusCharacters as CombatantData[],
    enemies: olympusEnemies,
    abilities: [...(olympusAbilities as AbilityDefinition[]), ...(olympusEnemyAbilities as AbilityDefinition[])],
  },
  takamagahara: {
    characters: takamagaharaCharacters as CombatantData[],
    enemies: takamagaharaEnemies,
    abilities: takamagaharaAbilities as AbilityDefinition[],
  },
  duat: {
    characters: [],
    enemies: duatEnemies,
    abilities: duatAbilities as AbilityDefinition[],
  },
  orun: {
    characters: [],
    enemies: orunEnemies,
    abilities: orunAbilities as AbilityDefinition[],
  },
};

export const CONSTANTS = constantsJson as CombatConstants;
