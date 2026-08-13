import type { Element, Faction, Rarity } from '../types';

/**
 * The combat engine (src/engine) has no concept of "level" or "rarity" for
 * enemies — those are cosmetic display choices, not combat-relevant, so they
 * live here rather than in the engine's data files.
 */
export const DISPLAY_LEVEL_BY_TEMPLATE_ID: Record<string, number> = {
  jurupari: 45,
  boitata: 42,
  iara: 38,
  saci: 35,
  'script-kiddie': 12,
  'firewall-turret': 12,
  'corrupted-daemon': 12,
  anhanga: 60,
};

export const DISPLAY_RARITY_BY_TEMPLATE_ID: Record<string, Rarity> = {
  jurupari: 'Quantum',
  boitata: 'LTS',
  iara: 'RC',
  saci: 'Alpha',
  'script-kiddie': 'Alpha',
  'firewall-turret': 'Alpha',
  'corrupted-daemon': 'Alpha',
  anhanga: 'Quantum',
};

/**
 * Card art per character, keyed by templateId. Empty for now — drop pixel-art
 * files under `public/portraits/` and register the path here (e.g.
 * `jurupari: '/portraits/jurupari.png'`) to have UnitCard render them instead
 * of the placeholder silhouette. No code changes needed beyond this map.
 */
export const DISPLAY_PORTRAIT_BY_TEMPLATE_ID: Record<string, string> = {};

export const FALLBACK_FACTION: Faction = 'Malware';
export const FALLBACK_RARITY: Rarity = 'Alpha';
export const FALLBACK_ELEMENT: Element = 'Backdoor';
