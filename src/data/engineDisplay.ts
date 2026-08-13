import caiporaArt from '../assets/caipora.png';
import saciArt from '../assets/saci.png';
import modelArt from '../assets/model.png';
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
 * Card art per character, keyed by templateId. These three are placeholder
 * test art (not the final official designs) standing in for allies until
 * the real per-character pixel art is ready — swap the values here once it
 * lands. No other code changes needed beyond this map.
 */
export const DISPLAY_PORTRAIT_BY_TEMPLATE_ID: Record<string, string> = {
  jurupari: caiporaArt,
  saci: saciArt,
  boitata: modelArt,
};

export const FALLBACK_FACTION: Faction = 'Malware';
export const FALLBACK_RARITY: Rarity = 'Alpha';
export const FALLBACK_ELEMENT: Element = 'Backdoor';
