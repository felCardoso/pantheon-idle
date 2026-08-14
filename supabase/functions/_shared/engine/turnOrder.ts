import type { Combatant } from './types.ts';
import { effectiveIni } from './statusEffects.ts';

/**
 * Living units in initiative order for one round. Saci.exe's "always acts
 * first" passive overrides INI entirely (per design intent: it never risks
 * losing its action to dying before its turn), everyone else falls back to
 * INI descending, recomputed every round since Lentidão can change it mid-battle.
 */
export function computeTurnOrder(units: Combatant[]): Combatant[] {
  return units
    .filter((c) => c.hp > 0)
    .slice()
    .sort((a, b) => {
      if (a.alwaysActsFirst !== b.alwaysActsFirst) return a.alwaysActsFirst ? -1 : 1;
      return effectiveIni(b) - effectiveIni(a);
    });
}
