import caiporaArt from '../assets/caipora.png';
import saciArt from '../assets/saci.png';
import type { Element, Faction, Rarity } from '../types';

/**
 * The combat engine (src/engine) has no concept of "level" or "rarity" for
 * enemies — those are cosmetic display choices, not combat-relevant, so they
 * live here rather than in the engine's data files. (Allies technically carry
 * a `rarity` field in their CombatantData JSON, but the engine's Combatant
 * type drops it when building the runtime unit — this map is the UI's source
 * of truth for both.)
 *
 * Rarity is not a fixed trait per character — every character can be found
 * at the lowest tier (Alpha) and, once an upgrade system exists, raised up
 * through Beta/RC/Stable/LTS/Quantum while keeping everything it had at the
 * lower tier. Since no such system is built yet, every ally is Alpha here —
 * this map is what a future upgrade feature would update per-owned-instance
 * rather than per-templateId.
 */
export const DISPLAY_LEVEL_BY_TEMPLATE_ID: Record<string, number> = {
  // Folclore Brasileiro
  jurupari: 35,
  curupira: 35,
  caipora: 35,
  saci: 35,
  // Mitologia Nórdica
  odin: 35,
  freya: 35,
  thor: 35,
  ratatoskr: 35,
  // Mitologia Grega
  zeus: 35,
  hades: 35,
  atena: 35,
  satiro: 35,
  // Jurupari.iso enemies
  'script-kiddie': 12,
  'firewall-turret': 12,
  'corrupted-daemon': 12,
  anhanga: 60,
};

export const DISPLAY_RARITY_BY_TEMPLATE_ID: Record<string, Rarity> = {
  // Folclore Brasileiro
  jurupari: 'Alpha',
  curupira: 'Alpha',
  caipora: 'Alpha',
  saci: 'Alpha',
  // Mitologia Nórdica
  odin: 'Alpha',
  freya: 'Alpha',
  thor: 'Alpha',
  ratatoskr: 'Alpha',
  // Mitologia Grega
  zeus: 'Alpha',
  hades: 'Alpha',
  atena: 'Alpha',
  satiro: 'Alpha',
  // Jurupari.iso enemies
  'script-kiddie': 'Alpha',
  'firewall-turret': 'Alpha',
  'corrupted-daemon': 'Alpha',
  anhanga: 'Quantum',
};

/**
 * Card art per character, keyed by templateId. Saci and Caipora now have art
 * that actually matches who they are; everyone else falls back to UnitCard's
 * pixel-silhouette placeholder until real art lands for them too.
 */
export const DISPLAY_PORTRAIT_BY_TEMPLATE_ID: Record<string, string> = {
  saci: saciArt,
  caipora: caiporaArt,
};

export const FALLBACK_FACTION: Faction = 'Malware';
export const FALLBACK_RARITY: Rarity = 'Alpha';
export const FALLBACK_ELEMENT: Element = 'Backdoor';
