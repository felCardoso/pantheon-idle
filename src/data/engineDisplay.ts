import duatBg from "../assets/worlds/duat.png";
import jurupariBg from "../assets/worlds/jurupari.png";
import olympusBg from "../assets/worlds/olympus.png";
import orunBg from "../assets/worlds/orun.png";
import takamagaharaBg from "../assets/worlds/takamagahara.png";
import yggdrasilBg from "../assets/worlds/yggrdasil.png";

import amaterasuArt from "../assets/characters/amaterasu.png";
import atenaArt from "../assets/characters/atena.png";
import caiporaArt from "../assets/characters/caipora.png";
import curupiraArt from "../assets/characters/curupira.png";
import freyaArt from "../assets/characters/freya.png";
import hadesArt from "../assets/characters/hades.png";
import herculesArt from "../assets/characters/hercules.png";
import jurupariArt from "../assets/characters/jurupari.png";
import medusaArt from "../assets/characters/medusa.png";
import minotauroArt from "../assets/characters/minotauro.png";
import odinArt from "../assets/characters/odin.png";
import ratatoskrArt from "../assets/characters/ratatoskr.png";
import saciArt from "../assets/characters/saci.png";

import type { Element, Faction, Rarity } from "../types";

/**
 * Enemies have no real level system (no XP, they're not owned/progressed) —
 * this is a cosmetic display number, kept here rather than in the engine's
 * data files. Allies used to have a matching hardcoded map, but their level
 * is now real: derived from accumulated XP (see engine/core/leveling.ts) and
 * carried on the Combatant itself, not looked up by templateId.
 */
export const ENEMY_LEVEL_BY_TEMPLATE_ID: Record<string, number> = {
  "script-kiddie": 12,
  "firewall-turret": 12,
  "corrupted-daemon": 12,
  anhanga: 60,
};

/**
 * The combat engine (src/engine) has no concept of "rarity" for enemies —
 * a cosmetic display choice, not combat-relevant, so it lives here rather
 * than in the engine's data files. (Allies technically carry a `rarity`
 * field in their CombatantData JSON, but the engine's Combatant type drops
 * it when building the runtime unit — this map is the UI's source of truth
 * for both.)
 *
 * Rarity is not a fixed trait per character — every character can be found
 * at the lowest tier (Alpha) and, once an upgrade system exists, raised up
 * through Beta/RC/Stable/LTS/Quantum while keeping everything it had at the
 * lower tier. Since no such system is built yet, every ally is Alpha here —
 * this map is what a future upgrade feature would update per-owned-instance
 * rather than per-templateId.
 */
export const DISPLAY_RARITY_BY_TEMPLATE_ID: Record<string, Rarity> = {
  // Folclore Brasileiro
  jurupari: "Alpha",
  curupira: "Alpha",
  caipora: "Alpha",
  saci: "Alpha",
  // Mitologia Nórdica
  odin: "Alpha",
  freya: "Alpha",
  thor: "Alpha",
  ratatoskr: "Alpha",
  // Mitologia Grega
  zeus: "Alpha",
  hades: "Alpha",
  atena: "Alpha",
  satiro: "Alpha",
  medusa: "Alpha",
  hercules: "Alpha",
  minotauro: "Alpha",
  // Mitologia Japonesa
  amaterasu: "Alpha",
  // Jurupari.iso enemies
  "script-kiddie": "Alpha",
  "firewall-turret": "Alpha",
  "corrupted-daemon": "Alpha",
  anhanga: "Quantum",
};

/**
 * Card art per character, keyed by templateId. Saci and Caipora now have art
 * that actually matches who they are; everyone else falls back to UnitCard's
 * pixel-silhouette placeholder until real art lands for them too.
 */
export const DISPLAY_PORTRAIT_BY_TEMPLATE_ID: Record<string, string> = {
  amaterasu: amaterasuArt,
  atena: atenaArt,
  caipora: caiporaArt,
  curupira: curupiraArt,
  freya: freyaArt,
  hades: hadesArt,
  hercules: herculesArt,
  jurupari: jurupariArt,
  medusa: medusaArt,
  minotauro: minotauroArt,
  odin: odinArt,
  ratatoskr: ratatoskrArt,
  saci: saciArt,
};

/**
 * Where each character's face sits in their card art, as a percentage point
 * (x, y) from the image's top-left — used by AvatarCrop to zoom a square
 * portrait into a face-focused profile avatar instead of showing the full
 * body. Calibrated by eye against the actual art; a character without an
 * entry here falls back to DISPLAY_AVATAR_FOCUS_FALLBACK.
 */
export const DISPLAY_AVATAR_FOCUS_BY_TEMPLATE_ID: Record<
  string,
  { x: number; y: number }
> = {
  amaterasu: { x: 50, y: 23 },
  atena: { x: 50, y: 23 },
  caipora: { x: 55, y: 23 },
  curupira: { x: 50, y: 23 },
  freya: { x: 50, y: 23 },
  hades: { x: 50, y: 23 },
  hercules: { x: 50, y: 23 },
  jurupari: { x: 50, y: 23 },
  medusa: { x: 50, y: 23 },
  minotauro: { x: 50, y: 23 },
  odin: { x: 50, y: 23 },
  ratatoskr: { x: 50, y: 23 },
  saci: { x: 50, y: 22 },
};

export const DISPLAY_AVATAR_FOCUS_FALLBACK = { x: 50, y: 25 };

/**
 * Display name + mythology subtitle per world, keyed by the same worldId as
 * WORLD_BACKGROUND_BY_ID below — see progression.ts's WORLD_IDS for the
 * canonical id list/order (docs/mundos.md's proposed launch order).
 */
export const WORLD_DISPLAY_BY_ID: Record<string, { name: string; subtitle: string }> = {
  jurupari: { name: 'Jurupari.iso', subtitle: 'Folclore Brasileiro' },
  duat: { name: 'Duat.iso', subtitle: 'Egípcia' },
  orun: { name: 'Orun.iso', subtitle: 'Iorubá' },
  takamagahara: { name: 'Takamagahara.iso', subtitle: 'Japonesa' },
  olympus: { name: 'Olympus.iso', subtitle: 'Grega' },
  yggdrasil: { name: 'Yggdrasil.iso', subtitle: 'Nórdica' },
};

/**
 * Battle background art per world, keyed by StageInfo.worldId — see
 * WORLD_DISPLAY_BY_ID above for the same id set's display name/subtitle.
 */
export const WORLD_BACKGROUND_BY_ID: Record<string, string> = {
  jurupari: jurupariBg,
  yggdrasil: yggdrasilBg,
  olympus: olympusBg,
  duat: duatBg,
  orun: orunBg,
  takamagahara: takamagaharaBg,
};

export const FALLBACK_FACTION: Faction = "Malware";
export const FALLBACK_RARITY: Rarity = "Alpha";
export const FALLBACK_ELEMENT: Element = "Backdoor";
