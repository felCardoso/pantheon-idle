// AUTO-GENERATED from src/data — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the source.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
/**
 * Módulos (`.dll`) — the equippable rune system.
 *
 * Every character carries four slots: one Ultimate plus one each of Attack, Defense and Support.
 * A rune's strength comes from its rarity, and so does how many bonuses it carries: an S rune
 * grants its full effect list, while lower grades grant a prefix of it at reduced magnitude. That
 * is what "o número inicial de bonus muda" means mechanically — a C rune is not merely a weaker S,
 * it does less.
 *
 * The authored numbers below are the **S values**; everything else is derived by
 * RARITY_SCALE/RARITY_BONUS_COUNT, so rebalancing a rune means touching one line rather than four.
 */

export type ModuleRarity = 'S' | 'A' | 'B' | 'C';
export type ModuleSlot = 'ultimate' | 'attack' | 'defense' | 'support';

export const MODULE_RARITIES: ModuleRarity[] = ['S', 'A', 'B', 'C'];
export const MODULE_SLOTS: ModuleSlot[] = ['ultimate', 'attack', 'defense', 'support'];

/** Higher is better — for sorting and for "is this an upgrade" comparisons. */
export const MODULE_RARITY_RANK: Record<ModuleRarity, number> = { C: 0, B: 1, A: 2, S: 3 };

/** Fraction of the authored S magnitude each grade keeps. */
export const RARITY_SCALE: Record<ModuleRarity, number> = { S: 1, A: 0.7, B: 0.45, C: 0.25 };

/** How many of a rune's effects each grade actually grants, counting from the first. */
export const RARITY_BONUS_COUNT: Record<ModuleRarity, number> = { S: 3, A: 2, B: 1, C: 1 };

/**
 * What a rune does, in terms the engine already understands (see applyModules in
 * engine/core/modules.ts). Percent-shaped keys are fractions: 0.025 = +2.5%.
 */
export type ModuleEffectKind =
  | 'critChance'
  | 'critDamage'
  | 'attackPercent'
  | 'maxHpPercent'
  | 'defense'
  | 'thorns'
  | 'initialShieldPercent'
  | 'dodge'
  | 'statusDamagePercent'
  | 'healEfficiencyPercent'
  /** Revives once at `magnitude` of max HP the first time this unit would die. */
  | 'reviveOncePercent'
  /** Clears debuffs from the Vanguard every `intervalSeconds`. */
  | 'periodicCleanse'
  /** Extra damage against targets below `thresholdPercent` of their max HP. */
  | 'executeDamagePercent';

export interface ModuleEffect {
  kind: ModuleEffectKind;
  /** Scaled by RARITY_SCALE. */
  magnitude: number;
  /** Only for periodicCleanse. Not scaled — a rarer rune cleanses more often, see cleanseInterval. */
  intervalSeconds?: number;
  /** Only for executeDamagePercent. Not scaled: the threshold is the rune's identity, the bonus is its power. */
  thresholdPercent?: number;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  slot: ModuleSlot;
  /** Portuguese one-liner for the card, with {0}, {1}… substituted for the scaled magnitudes. */
  description: string;
  /** Authored at S. Lower grades take a prefix of this list — order matters, strongest first. */
  effects: ModuleEffect[];
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  // ---------------------------------------------------------------- Ultimate
  {
    id: 'reboot',
    name: 'Reboot',
    slot: 'ultimate',
    description: 'Revive com {0} de vida ao ser derrotado pela primeira vez.',
    effects: [{ kind: 'reviveOncePercent', magnitude: 0.1 }],
  },
  {
    id: 'restore',
    name: 'Restore',
    slot: 'ultimate',
    description: 'A cada {interval} remove os debuffs da Vanguarda.',
    effects: [{ kind: 'periodicCleanse', magnitude: 1, intervalSeconds: 5 }],
  },
  {
    id: 'nanites-plus',
    name: 'Nanites+',
    slot: 'ultimate',
    description: 'Eficiência de cura {0} maior.',
    effects: [{ kind: 'healEfficiencyPercent', magnitude: 0.15 }],
  },
  {
    id: 'shockwave',
    name: 'Shockwave',
    slot: 'ultimate',
    description: 'Dano {0} maior contra inimigos abaixo de 30% de vida.',
    effects: [{ kind: 'executeDamagePercent', magnitude: 0.1, thresholdPercent: 0.3 }],
  },
  {
    id: 'overclock',
    name: 'Overclock',
    slot: 'ultimate',
    description: 'Começa a batalha com {0} do HP como escudo e {1} de ataque.',
    effects: [
      { kind: 'initialShieldPercent', magnitude: 0.12 },
      { kind: 'attackPercent', magnitude: 0.05 },
    ],
  },
  {
    id: 'failsafe',
    name: 'Failsafe',
    slot: 'ultimate',
    description: 'Espinhos {0} e {1} de vida máxima.',
    effects: [
      { kind: 'thorns', magnitude: 0.08 },
      { kind: 'maxHpPercent', magnitude: 0.08 },
    ],
  },

  // ------------------------------------------------------------------ Attack
  {
    id: 'critical-strike',
    name: 'Ataque Crítico',
    slot: 'attack',
    description: '{0} de chance de crítico.',
    effects: [{ kind: 'critChance', magnitude: 0.01 }],
  },
  {
    id: 'critical-damage',
    name: 'Dano Crítico',
    slot: 'attack',
    description: '{0} de dano crítico.',
    effects: [{ kind: 'critDamage', magnitude: 0.2 }],
  },
  {
    id: 'power',
    name: 'Power',
    slot: 'attack',
    description: '{0} de ataque base.',
    effects: [{ kind: 'attackPercent', magnitude: 0.025 }],
  },
  {
    id: 'executioner',
    name: 'Executor',
    slot: 'attack',
    description: 'Dano {0} maior contra inimigos abaixo de 30% de vida.',
    effects: [{ kind: 'executeDamagePercent', magnitude: 0.06, thresholdPercent: 0.3 }],
  },

  // ----------------------------------------------------------------- Defense
  {
    id: 'ice',
    name: 'ICE',
    slot: 'defense',
    description: 'Espinhos: reflete {0} do dano recebido.',
    effects: [{ kind: 'thorns', magnitude: 0.05 }],
  },
  {
    id: 'life',
    name: 'Life',
    slot: 'defense',
    description: '{0} de vida máxima.',
    effects: [{ kind: 'maxHpPercent', magnitude: 0.05 }],
  },
  {
    id: 'defense',
    name: 'Defense',
    slot: 'defense',
    description: '{0} de Firewall (reduz dano físico).',
    effects: [{ kind: 'defense', magnitude: 0.015 }],
  },
  {
    id: 'shield',
    name: 'Shield',
    slot: 'defense',
    description: 'Começa a batalha com {0} do HP base como escudo.',
    effects: [{ kind: 'initialShieldPercent', magnitude: 0.05 }],
  },

  // ----------------------------------------------------------------- Support
  {
    id: 'dodge',
    name: 'Dodge',
    slot: 'support',
    description: '{0} de chance de esquiva.',
    effects: [{ kind: 'dodge', magnitude: 0.01 }],
  },
  {
    id: 'dmg-boost',
    name: 'Dmg Boost',
    slot: 'support',
    description: '{0} de dano de status.',
    effects: [{ kind: 'statusDamagePercent', magnitude: 0.025 }],
  },
  {
    id: 'nanites',
    name: 'Nanites',
    slot: 'support',
    description: '{0} de eficiência de cura.',
    effects: [{ kind: 'healEfficiencyPercent', magnitude: 0.04 }],
  },
  {
    id: 'resilience',
    name: 'Resilience',
    slot: 'support',
    description: '{0} de vida máxima e {1} de esquiva.',
    effects: [
      { kind: 'maxHpPercent', magnitude: 0.03 },
      { kind: 'dodge', magnitude: 0.005 },
    ],
  },
];

export const MODULE_BY_ID: Record<string, ModuleDefinition> = Object.fromEntries(MODULE_DEFINITIONS.map((m) => [m.id, m]));

/** Cleanse fires faster at higher grades rather than "more strongly" — a cleanse has no magnitude. */
export function cleanseInterval(baseSeconds: number, rarity: ModuleRarity): number {
  return Math.round((baseSeconds / RARITY_SCALE[rarity]) * 10) / 10;
}

/**
 * The effects a specific copy of a rune actually grants: the first RARITY_BONUS_COUNT of the
 * authored list, each magnitude scaled by RARITY_SCALE.
 */
export function resolveModuleEffects(definition: ModuleDefinition, rarity: ModuleRarity): ModuleEffect[] {
  return definition.effects.slice(0, RARITY_BONUS_COUNT[rarity]).map((effect) => {
    if (effect.kind === 'periodicCleanse') {
      return { ...effect, intervalSeconds: cleanseInterval(effect.intervalSeconds ?? 5, rarity) };
    }
    return { ...effect, magnitude: Math.round(effect.magnitude * RARITY_SCALE[rarity] * 10000) / 10000 };
  });
}

function formatMagnitude(effect: ModuleEffect): string {
  if (effect.kind === 'periodicCleanse') return `${effect.intervalSeconds}s`;
  return `${(effect.magnitude * 100).toFixed(effect.magnitude * 100 < 1 ? 1 : 0).replace('.', ',')}%`;
}

/** The card's one-liner with this copy's real numbers filled in. */
export function describeModule(definition: ModuleDefinition, rarity: ModuleRarity): string {
  const effects = resolveModuleEffects(definition, rarity);
  let text = definition.description;
  effects.forEach((effect, index) => {
    text = text.replace(`{${index}}`, formatMagnitude(effect));
  });
  const cleanse = effects.find((e) => e.kind === 'periodicCleanse');
  if (cleanse) text = text.replace('{interval}', `${cleanse.intervalSeconds}s`);
  // A grade too low to grant a later effect leaves its placeholder behind — drop that clause
  // rather than printing "{1}" at the player.
  return text.replace(/\s*e\s*\{\d\}[^.]*\.?/g, '.').replace(/\{\d\}/g, '').trim();
}
