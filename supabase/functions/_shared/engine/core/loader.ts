// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run `npm run sync:pvp-engine` after changing the engine.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
import { PASSIVE_UNLOCK_RARITY, RARITY_RANK } from '../schema.ts';
import type { AbilityDefinition, CombatantData, Rarity } from '../schema.ts';
import type { Combatant } from './types.ts';
import { levelForXp, levelMultiplier } from './leveling.ts';
import type { WorldId } from './progression.ts';
import { ALL_ABILITIES, ALL_CHARACTER_DATA, CONSTANTS, WORLD_ENEMIES } from '../data/index.ts';
import { NO_MODULE_BONUSES, type ModuleBonuses } from './modules.ts';

// Re-exported so existing engine/UI call sites keep importing it from here.
export { CONSTANTS };

/**
 * Every playable ally character across all implemented mythologies, keyed by
 * id. Every world in WORLD_IDS (progression.ts) is now a real playable
 * enemy campaign (see ENEMY_REGISTRY below), but the ally roster is still
 * its own separate pool that fights across all of them — not every world's
 * mythology has ally characters yet (Duat/Orun have none so far; see
 * docs/personagens.md for the planned full 24-character roster).
 */
const ALL_CHARACTERS: CombatantData[] = ALL_CHARACTER_DATA;

/** Jurupari.iso's mythology, as spelled in characters.json — see loadJurupariAllies. */
const JURUPARI_MYTHOLOGY = 'Folclore Brasileiro';

const CHARACTER_REGISTRY: Record<string, CombatantData> = Object.fromEntries(ALL_CHARACTERS.map((c) => [c.id, c]));

export const ALL_CHARACTER_IDS: string[] = ALL_CHARACTERS.map((c) => c.id);

/** Character ids grouped by their `mythology` field, in file order — the compendium/onboarding UI's source of truth for "which mythology is this from." */
export function characterIdsByMythology(): { mythology: string; ids: string[] }[] {
  const order: string[] = [];
  const groups = new Map<string, string[]>();
  for (const c of ALL_CHARACTERS) {
    const key = c.mythology ?? 'Desconhecida';
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(c.id);
  }
  return order.map((mythology) => ({ mythology, ids: groups.get(mythology)! }));
}

const ABILITY_REGISTRY: Record<string, AbilityDefinition> = Object.fromEntries(ALL_ABILITIES.map((a) => [a.id, a]));

function resolveAbilities(ids: string[]): AbilityDefinition[] {
  return ids.map((id) => {
    const def = ABILITY_REGISTRY[id];
    if (!def) throw new Error(`Unknown ability id: ${id}`);
    return def;
  });
}

/**
 * Every candidate active-ability definition for a character template, in
 * data-file order — the ability-picker UI's source of truth for "what can
 * this character equip" (docs/roster.ts's toRosterCharacter). Distinct from
 * a resolved Combatant's `.abilities`, which only ever carries whichever one
 * is actually equipped for a given battle.
 */
export function activeOptionsFor(templateId: string): AbilityDefinition[] {
  const data = CHARACTER_REGISTRY[templateId];
  return data ? resolveAbilities(data.activeOptions) : [];
}

/** The character's passive ability definition, if authored — independent of whether it's currently rarity-unlocked for any given owner. */
export function passiveAbilityFor(templateId: string): AbilityDefinition | undefined {
  const id = CHARACTER_REGISTRY[templateId]?.passiveAbilityId;
  return id ? ABILITY_REGISTRY[id] : undefined;
}

/** The character's bench-ability options, if authored (docs/combate.md v3.1 §3). */
export function benchOptionsFor(templateId: string): AbilityDefinition[] {
  const data = CHARACTER_REGISTRY[templateId];
  return data ? resolveAbilities(data.benchOptions ?? []) : [];
}

export interface ResolvedAbilities {
  active: AbilityDefinition[];
  bench: AbilityDefinition[];
  passive: AbilityDefinition[];
}

/**
 * Splits a character's kit into the three scopes the real-time engine gates on
 * (docs/combate.md v3.1 §3).
 *
 * Enemies never choose (§7: "scripts fixos" — a boss runs several abilities at
 * once) so every one of their activeOptions fires, plus their passive
 * unconditionally (enemies bypass the rarity gate). Per §7A they carry no
 * bench abilities at all.
 *
 * Allies get exactly one active and one bench ability — the player's
 * selection if it is genuinely one of that character's options, else the first
 * one — plus their passive only once `rarity` clears PASSIVE_UNLOCK_RARITY.
 */
function resolveCombatantAbilities(
  data: CombatantData,
  isAlly: boolean,
  rarity?: Rarity,
  selectedAbilityId?: string,
  selectedBenchAbilityId?: string,
): ResolvedAbilities {
  if (!isAlly) {
    return {
      active: resolveAbilities(data.activeOptions),
      bench: [],
      passive: resolveAbilities(data.passiveAbilityId ? [data.passiveAbilityId] : []),
    };
  }

  const selectedActive = selectedAbilityId && data.activeOptions.includes(selectedAbilityId) ? selectedAbilityId : data.activeOptions[0];
  const benchOptions = data.benchOptions ?? [];
  const selectedBench =
    selectedBenchAbilityId && benchOptions.includes(selectedBenchAbilityId) ? selectedBenchAbilityId : benchOptions[0];
  const passiveUnlocked = !!rarity && !!data.passiveAbilityId && RARITY_RANK[rarity] >= RARITY_RANK[PASSIVE_UNLOCK_RARITY];

  return {
    active: resolveAbilities(selectedActive ? [selectedActive] : []),
    bench: resolveAbilities(selectedBench ? [selectedBench] : []),
    passive: resolveAbilities(passiveUnlocked ? [data.passiveAbilityId!] : []),
  };
}

/** Mythological synergy bonus for a same-mythology team, per combate.md section 5. */
function synergyBonusFor(teamSize: number): number {
  return CONSTANTS.synergyByCount[String(teamSize)] ?? 0;
}

function buildCombatant(
  data: CombatantData,
  isAlly: boolean,
  synergyBonus: number,
  statMultiplier: number = 1,
  idSuffix?: string,
  level: number = 0,
  rarity?: Rarity,
  selectedAbilityId?: string,
  selectedBenchAbilityId?: string,
  modules: ModuleBonuses = NO_MODULE_BONUSES,
): Combatant {
  // Equipment multiplies on top of synergy/level/difficulty rather than being folded into them,
  // so a rune's "+5% de vida" reads as 5% of what the character already has.
  const scale = (1 + synergyBonus) * statMultiplier;
  const hp = Math.round(data.baseStats.hp * scale * (1 + modules.maxHpPercent));
  const atk = Math.round(data.baseStats.atk * scale * (1 + modules.attackPercent));
  // DEF/VEL/ESQ/ICE are never scaled — for allies because they're ability-granted build
  // choices rather than generic growing stats (schema.ts), and for enemies because scaling
  // them made world difficulty compound several times over instead of once.
  //
  // They used to be multiplied by statMultiplier for enemies. HP and ATK are pools and
  // per-hit output, so scaling those raises difficulty linearly; DEF is a mitigation
  // *fraction* and VEL is a *rate*. Scaling all four at once meant a world-6 boss (x1.76
  // world, x1.25 team-size) simultaneously had 2.2x the HP, hit 2.2x harder, attacked 2.2x
  // more often, and absorbed 44% of incoming damage instead of 20% — a combined jump far
  // steeper than the multiplier suggests, and the reason no roster could clear the later
  // worlds at any level. DEF/VEL/ESQ now stay exactly as authored, so they read as that
  // enemy's archetype (a bulwark, a flurry attacker) and world difficulty comes from the
  // pools alone.
  // Module DEF/ICE/ESQ are added, not multiplied: they're fractions, and a character's own base
  // is 0 for allies, so a multiplier would leave every defensive rune doing nothing.
  const def = data.baseStats.def + modules.defense;
  // VEL is a rate, not a pool: it is NOT rounded (unlike the old INI, which was an
  // ordering key) because attackIntervalFor() reads it as a continuous multiplier —
  // rounding would collapse every enemy speed tier below 1.0 down to 0.
  const vel = data.baseStats.vel;
  const esq = data.baseStats.esq + modules.dodge;
  const ice = (data.baseStats.ice ?? 0) + modules.thorns;

  const abilities = resolveCombatantAbilities(data, isAlly, rarity, selectedAbilityId, selectedBenchAbilityId);

  return {
    id: idSuffix ? `${data.id}#${idSuffix}` : data.id,
    templateId: data.id,
    name: data.name,
    faction: data.faction,
    isAlly,
    stars: data.stars ?? 0,
    level,
    base: { hp, atk, def, vel, esq, ice },
    maxHp: hp,
    hp,
    shield: Math.round(hp * modules.initialShieldPercent),
    statuses: [],
    activeAbilities: abilities.active,
    benchAbilities: abilities.bench,
    passiveAbilities: abilities.passive,
    statusDurationBonus: data.statusDurationBonus ?? 0,
    halfHpTriggered: false,
    attackCooldownRemaining: 0,
    abilityCooldownRemaining: {},
    isVanguard: false,
    modules,
    revived: false,
    cleanseCooldownRemaining: modules.cleanseIntervalSeconds ?? 0,
  };
}

export interface OwnedCharacterEntry {
  id: string;
  /** Accumulated XP — level is always derived from this, never passed independently (see engine/core/leveling.ts). */
  xp: number;
  /** The card's current best owned rarity — gates whether its passive is active (see resolveCombatantAbilities). Omitted = passive locked, same as browsing an unowned character. */
  rarity?: Rarity;
  /** Already-summed equipment bonuses for this character (see core/modules.ts). */
  modules?: ModuleBonuses;
  /** The player's equipped active ability id — falls back to the character's first activeOptions entry if omitted or not actually one of its options. */
  selectedAbilityId?: string;
}

/**
 * Builds an ally team from whichever characters are passed (a player's owned
 * roster, of any size/mythology mix), with each character's level (derived
 * from its xp) scaling its stats via levelMultiplier, and the mythology
 * synergy bonus (combate.md section 5) applied per same-mythology subgroup —
 * a mixed-mythology team only gets the bonus for however many characters it
 * has *of each given mythology*, never a flat bonus for the whole team's
 * size regardless of mix. Order is preserved, and each id may appear at most
 * once (no duplicate/star-up support yet).
 */
export function loadCharactersByIds(entries: OwnedCharacterEntry[]): Combatant[] {
  const dataByEntry = entries.map(({ id, xp, rarity, selectedAbilityId, modules }) => {
    const data = CHARACTER_REGISTRY[id];
    if (!data) throw new Error(`Unknown character id: ${id}`);
    return { data, xp, rarity, selectedAbilityId, modules };
  });

  const countByMythology = new Map<string, number>();
  for (const { data } of dataByEntry) {
    const key = data.mythology ?? 'Desconhecida';
    countByMythology.set(key, (countByMythology.get(key) ?? 0) + 1);
  }

  return dataByEntry.map(({ data, xp, rarity, selectedAbilityId, modules }) => {
    const key = data.mythology ?? 'Desconhecida';
    const synergyBonus = synergyBonusFor(countByMythology.get(key)!);
    const level = levelForXp(xp);
    return buildCombatant(data, true, synergyBonus, levelMultiplier(level), undefined, level, rarity, selectedAbilityId, undefined, modules);
  });
}

/** The original 4-character Jurupari.iso roster at level 0, still used by the CLI demo and existing tests. */
export function loadJurupariAllies(): Combatant[] {
  // Characters are one flat list now, so this selects by the mythology field rather than by which
  // file a character happened to live in — the same grouping key characterIdsByMythology uses.
  return loadCharactersByIds(
    ALL_CHARACTERS.filter((c) => c.mythology === JURUPARI_MYTHOLOGY).map((c) => ({ id: c.id, xp: 0 })),
  );
}

interface WorldEnemyData {
  comuns: CombatantData[];
  boss: CombatantData;
}

/**
 * Enemy data for every world in progression.ts's WORLD_IDS. All 6 are
 * calibrated at the exact same baseline numbers (reskinned per world's
 * lore) — the actual difficulty ramp between worlds comes entirely from
 * progression.ts's difficultyMultiplier (+30% base per world) applied at
 * load time via `statMultiplier` below, not from hand-tuned stats here.
 *
 * Note: docs/mundos.md names Olympus.iso's boss "Medusa.exe", but Medusa is
 * already a playable ally character in this build (see olympus.json under
 * characters/) — renamed to Typhon.exe here to avoid a same-name ally/enemy
 * collision in one battle, the same reasoning that renamed Jurupari.iso's
 * "Caipora.sh"/"Curupira.sh" trash mobs once those became real allies.
 */
const ENEMY_REGISTRY = WORLD_ENEMIES as Record<WorldId, WorldEnemyData>;

/**
 * Builds a wave of `count` comuns enemies for the given world, cycling
 * through its 3 archetypes and repeating (with unique ids, e.g.
 * `script-kiddie#2`) once `count` exceeds 3 — see progression.ts's
 * enemyCountRange for how many a given estágio should roll. `statMultiplier`
 * applies the per-estágio + per-world scaling (progression.ts's
 * difficultyMultiplier) and — since a player's owned team can be smaller
 * than the original 4-character baseline these were calibrated against —
 * teamSizeMultiplier.
 */
export function loadWorldComuns(worldId: WorldId, count: number, statMultiplier: number = 1): Combatant[] {
  const archetypes = ENEMY_REGISTRY[worldId].comuns;
  const seenCount = new Array<number>(archetypes.length).fill(0);
  const wave: Combatant[] = [];
  for (let i = 0; i < count; i++) {
    const archetypeIndex = i % archetypes.length;
    const occurrence = seenCount[archetypeIndex]++;
    const idSuffix = occurrence > 0 ? String(occurrence + 1) : undefined;
    wave.push(buildCombatant(archetypes[archetypeIndex], false, 0, statMultiplier, idSuffix));
  }
  return wave;
}

/** The given world's boss. `statMultiplier` — see loadWorldComuns. */
export function loadWorldBoss(worldId: WorldId, statMultiplier: number = 1): Combatant[] {
  return [buildCombatant(ENEMY_REGISTRY[worldId].boss, false, 0, statMultiplier)];
}

/** The original Jurupari.iso comuns loader, still used by the CLI demo and existing tests. */
export function loadJurupariComuns(count: number, statMultiplier: number = 1): Combatant[] {
  return loadWorldComuns('jurupari', count, statMultiplier);
}

/** Anhangá.exe, Jurupari.iso's boss — still used by the CLI demo and existing tests. */
export function loadJurupariBoss(statMultiplier: number = 1): Combatant[] {
  return loadWorldBoss('jurupari', statMultiplier);
}
