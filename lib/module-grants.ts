import 'server-only';
import { randomInt } from 'node:crypto';
import { MODULE_DEFINITIONS, type ModuleRarity } from '../src/data/modules';
import { supabaseAdmin } from './supabase-admin';

/**
 * Granting runes, shared by the two sources that hand them out: the `.rar` capsule in Invocações
 * and beating a world boss.
 *
 * The grade is rolled here rather than by either caller, so both paths draw from one table and a
 * change to the odds can't apply to only half the game.
 */

/** Odds per grade, in tenths of a percent so the table sums to an exact 10000. */
const RARITY_WEIGHTS: { rarity: ModuleRarity; weight: number }[] = [
  { rarity: 'C', weight: 5000 },
  { rarity: 'B', weight: 3000 },
  { rarity: 'A', weight: 1700 },
  { rarity: 'S', weight: 300 },
];

/** A boss is a milestone, so it skips the bottom grade entirely rather than paying out a C. */
const BOSS_RARITY_WEIGHTS: { rarity: ModuleRarity; weight: number }[] = [
  { rarity: 'B', weight: 5500 },
  { rarity: 'A', weight: 3500 },
  { rarity: 'S', weight: 1000 },
];

export interface GrantedModule {
  moduleId: string;
  rarity: ModuleRarity;
  slot: string;
}

function rollRarity(table: { rarity: ModuleRarity; weight: number }[]): ModuleRarity {
  const total = table.reduce((sum, t) => sum + t.weight, 0);
  let roll = randomInt(0, total);
  for (const entry of table) {
    roll -= entry.weight;
    if (roll < 0) return entry.rarity;
  }
  return table[table.length - 1].rarity;
}

/** Rolls `count` runes — uniform across the catalogue, weighted only on grade. */
export function rollModules(count: number, source: 'capsule' | 'boss'): GrantedModule[] {
  const table = source === 'boss' ? BOSS_RARITY_WEIGHTS : RARITY_WEIGHTS;
  return Array.from({ length: count }, () => {
    const definition = MODULE_DEFINITIONS[randomInt(0, MODULE_DEFINITIONS.length)];
    return { moduleId: definition.id, rarity: rollRarity(table), slot: definition.slot };
  });
}

/** Persists rolled runes as unequipped inventory rows. */
export async function grantModules(userId: string, modules: GrantedModule[]): Promise<void> {
  if (modules.length === 0) return;
  const { error } = await supabaseAdmin.from('player_modules').insert(
    modules.map((m) => ({ user_id: userId, module_id: m.moduleId, rarity: m.rarity, slot: m.slot, equipped_on: null })),
  );
  if (error) throw new Error(error.message);
}
