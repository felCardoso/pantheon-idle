// AUTO-GENERATED from src/data — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the source.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import { mergeModuleBonuses, NO_MODULE_BONUSES, type ModuleBonuses } from '../engine/index.ts';
import { MODULE_BY_ID, resolveModuleEffects, type ModuleRarity } from './modules.ts';

/**
 * The bridge between "runes" and what the engine understands.
 *
 * src/data owns rune identity — names, slots, grades, how many bonuses a grade grants. The engine
 * owns only ModuleBonuses, a flat bag of totals. This turns one into the other, and it is the
 * single place that knows both, so neither side has to learn the other's vocabulary.
 */

/** One equipped copy, as stored in player_modules. */
export interface EquippedModule {
  moduleId: string;
  rarity: ModuleRarity;
}

/** Sums a character's equipped runes into the totals the engine applies. Unknown ids are skipped. */
export function bonusesFromModules(equipped: EquippedModule[]): ModuleBonuses {
  const parts: Partial<ModuleBonuses>[] = [];

  for (const { moduleId, rarity } of equipped) {
    const definition = MODULE_BY_ID[moduleId];
    // A rune id that no longer exists in the data (renamed, removed) is ignored rather than
    // throwing: a stale row in someone's inventory shouldn't make their battles unresolvable.
    if (!definition) continue;

    for (const effect of resolveModuleEffects(definition, rarity)) {
      switch (effect.kind) {
        case 'critChance':
          parts.push({ critChance: effect.magnitude });
          break;
        case 'critDamage':
          parts.push({ critDamage: effect.magnitude });
          break;
        case 'attackPercent':
          parts.push({ attackPercent: effect.magnitude });
          break;
        case 'maxHpPercent':
          parts.push({ maxHpPercent: effect.magnitude });
          break;
        case 'defense':
          parts.push({ defense: effect.magnitude });
          break;
        case 'thorns':
          parts.push({ thorns: effect.magnitude });
          break;
        case 'initialShieldPercent':
          parts.push({ initialShieldPercent: effect.magnitude });
          break;
        case 'dodge':
          parts.push({ dodge: effect.magnitude });
          break;
        case 'statusDamagePercent':
          parts.push({ statusDamagePercent: effect.magnitude });
          break;
        case 'healEfficiencyPercent':
          parts.push({ healEfficiencyPercent: effect.magnitude });
          break;
        case 'reviveOncePercent':
          parts.push({ reviveOncePercent: effect.magnitude });
          break;
        case 'periodicCleanse':
          parts.push({ cleanseIntervalSeconds: effect.intervalSeconds ?? null });
          break;
        case 'executeDamagePercent':
          parts.push({ executeDamagePercent: effect.magnitude, executeThresholdPercent: effect.thresholdPercent ?? 0 });
          break;
      }
    }
  }

  return parts.length === 0 ? NO_MODULE_BONUSES : mergeModuleBonuses(parts);
}

/** Groups equipped rows by the character wearing them, ready for bonusesFromModules. */
export function equippedByCharacter(rows: { module_id: string; rarity: string; equipped_on: string | null }[]): Record<string, EquippedModule[]> {
  const byCharacter: Record<string, EquippedModule[]> = {};
  for (const row of rows) {
    if (!row.equipped_on) continue;
    (byCharacter[row.equipped_on] ??= []).push({ moduleId: row.module_id, rarity: row.rarity as ModuleRarity });
  }
  return byCharacter;
}
