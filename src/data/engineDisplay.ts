import caiporaArt from '../assets/caipora.png';
import saciArt from '../assets/saci.png';
import type { Element, Faction, Rarity } from '../types';

/**
 * The combat engine (src/engine) has no concept of "level" or "rarity" for
 * enemies — those are cosmetic display choices, not combat-relevant, so they
 * live here rather than in the engine's data files. (Allies technically carry
 * a `rarity` field in their CombatantData JSON, but the engine's Combatant
 * type drops it when building the runtime unit — this map is the UI's source
 * of truth for both, kept consistent by tier across all 3 mythologies.)
 */
export const DISPLAY_LEVEL_BY_TEMPLATE_ID: Record<string, number> = {
  // Folclore Brasileiro
  jurupari: 45,
  curupira: 42,
  caipora: 38,
  saci: 35,
  // Mitologia Nórdica
  odin: 45,
  freya: 42,
  thor: 38,
  ratatoskr: 35,
  // Mitologia Grega
  zeus: 45,
  hades: 42,
  atena: 38,
  satiro: 35,
  // Jurupari.iso enemies
  'script-kiddie': 12,
  'firewall-turret': 12,
  'corrupted-daemon': 12,
  anhanga: 60,
};

export const DISPLAY_RARITY_BY_TEMPLATE_ID: Record<string, Rarity> = {
  // Folclore Brasileiro
  jurupari: 'Quantum',
  curupira: 'LTS',
  caipora: 'RC',
  saci: 'Alpha',
  // Mitologia Nórdica
  odin: 'Quantum',
  freya: 'LTS',
  thor: 'RC',
  ratatoskr: 'Beta',
  // Mitologia Grega
  zeus: 'Quantum',
  hades: 'LTS',
  atena: 'RC',
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
