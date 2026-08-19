// Character/world art lives in public/assets (plain string URLs) rather than being
// imported as modules — Next.js's bundler wraps imported images in a StaticImageData
// object instead of the raw URL string these maps are typed/consumed as.
const duatBg = "/assets/worlds/duat.png";
const jurupariBg = "/assets/worlds/jurupari.png";
const olympusBg = "/assets/worlds/olympus.png";
const orunBg = "/assets/worlds/orun.png";
const takamagaharaBg = "/assets/worlds/takamagahara.png";
const yggdrasilBg = "/assets/worlds/yggrdasil.png";

const amaterasuArt = "/assets/characters/amaterasu.png";
const atenaArt = "/assets/characters/atena.png";
const caiporaArt = "/assets/characters/caipora.png";
const curupiraArt = "/assets/characters/curupira.png";
const freyaArt = "/assets/characters/freya.png";
const fujinArt = "/assets/characters/fujin.png";
const hadesArt = "/assets/characters/hades.png";
const herculesArt = "/assets/characters/hercules.png";
const jurupariArt = "/assets/characters/jurupari.png";
const kagutsuchiArt = "/assets/characters/kagutsuchi.png";
const medusaArt = "/assets/characters/medusa.png";
const minotauroArt = "/assets/characters/minotauro.png";
const odinArt = "/assets/characters/odin.png";
const raijinArt = "/assets/characters/raijin.png";
const ratatoskrArt = "/assets/characters/ratatoskr.png";
const saciArt = "/assets/characters/saci.png";
const susanooArt = "/assets/characters/susanoo.png";
const tsukoyomiArt = "/assets/characters/tsukoyomi.png";

import type { Faction, Rarity } from "../types";

/**
 * Enemies have no real level system (no XP, they're not owned/progressed) —
 * this is a cosmetic display number, kept here rather than in the engine's
 * data files. Allies used to have a matching hardcoded map, but their level
 * is now real: derived from accumulated XP (see engine/core/leveling.ts) and
 * carried on the Combatant itself, not looked up by templateId.
 */
export const ENEMY_LEVEL_BY_TEMPLATE_ID: Record<string, number> = {
  // Climbs with the world's position in progression.ts's WORLD_IDS order, so a later world's
  // enemies read as tougher on the card. Cosmetic only — actual difficulty is
  // difficultyMultiplier's job. Worlds past Jurupari used to be missing here entirely, which
  // showed every one of their enemies as "Nv.1".
  "script-kiddie": 12,
  "firewall-turret": 12,
  "corrupted-daemon": 12,
  anhanga: 60,
  // Duat.iso
  mumia: 24,
  "chacal-guardiao": 24,
  "serpente-nilo": 24,
  set: 70,
  // Orun.iso
  "espirito-ancestral": 36,
  "guardiao-mata": 36,
  "tambor-guerra": 36,
  ogum: 80,
  // Takamagahara.iso
  "yokai-menor": 48,
  "samurai-corrompido": 48,
  kappa: 48,
  "yamata-no-orochi": 90,
  // Olympus.iso
  ciclope: 60,
  "esqueleto-espartano": 60,
  "hidra-menor": 60,
  typhon: 100,
  // Yggdrasil.iso
  draugr: 72,
  "valquiria-corrompida": 72,
  "lobo-selvagem": 72,
  fenrir: 110,
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
 * through Beta/Stable/LTS while keeping everything it had at the
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
  anhanga: "LTS",
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
  fujin: fujinArt,
  hades: hadesArt,
  hercules: herculesArt,
  jurupari: jurupariArt,
  kagutsuchi: kagutsuchiArt,
  medusa: medusaArt,
  minotauro: minotauroArt,
  odin: odinArt,
  raijin: raijinArt,
  ratatoskr: ratatoskrArt,
  saci: saciArt,
  susanoo: susanooArt,
  tsukoyomi: tsukoyomiArt,
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
  fujin: { x: 50, y: 23 },
  hades: { x: 50, y: 23 },
  hercules: { x: 50, y: 23 },
  jurupari: { x: 50, y: 23 },
  kagutsuchi: { x: 50, y: 23 },
  medusa: { x: 50, y: 23 },
  minotauro: { x: 50, y: 23 },
  odin: { x: 50, y: 23 },
  raijin: { x: 50, y: 23 },
  ratatoskr: { x: 50, y: 23 },
  saci: { x: 50, y: 22 },
  susanoo: { x: 50, y: 23 },
  tsukoyomi: { x: 50, y: 23 },
};

export const DISPLAY_AVATAR_FOCUS_FALLBACK = { x: 50, y: 25 };

/**
 * Display name + mythology subtitle per world, keyed by the same worldId as
 * WORLD_BACKGROUND_BY_ID below — see progression.ts's WORLD_IDS for the
 * canonical id list/order (docs/mundos.md's proposed launch order).
 */
export const WORLD_DISPLAY_BY_ID: Record<
  string,
  { name: string; subtitle: string }
> = {
  jurupari: { name: "Jurupari.iso", subtitle: "Folclore Brasileiro" },
  duat: { name: "Duat.iso", subtitle: "Egípcia" },
  orun: { name: "Orun.iso", subtitle: "Iorubá" },
  takamagahara: { name: "Takamagahara.iso", subtitle: "Japonesa" },
  olympus: { name: "Olympus.iso", subtitle: "Grega" },
  yggdrasil: { name: "Yggdrasil.iso", subtitle: "Nórdica" },
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
