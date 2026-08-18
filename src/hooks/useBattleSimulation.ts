import { useCallback, useEffect, useReducer, useState } from 'react';
import {
  applyReplayEntry,
  buildNameToId,
  createInitialReplayState,
  difficultyMultiplier,
  enemyCountRange,
  ESTAGIOS_PER_FASE,
  FASES_PER_WORLD,
  isBossStage,
  loadCharactersByIds,
  loadWorldBoss,
  loadWorldComuns,
  localFaseNumber,
  resolveProgression,
  Rng,
  runBattle,
  teamSizeMultiplier,
  worldIdForFase,
  worldIndexForFase,
  type BattleLogEntry,
  type Combatant,
  type ReplayState,
  type WorldPosition,
} from '../engine';
import {
  DISPLAY_PORTRAIT_BY_TEMPLATE_ID,
  DISPLAY_RARITY_BY_TEMPLATE_ID,
  ENEMY_LEVEL_BY_TEMPLATE_ID,
  FALLBACK_FACTION,
  FALLBACK_RARITY,
  WORLD_DISPLAY_BY_ID,
} from '../data/engineDisplay';
import type { OwnedCharacter } from './useOwnedCharacters';
import type { ActiveStatus, BattleUnit, ChatMessage, StageInfo } from '../types';

interface BattleSession extends WorldPosition {
  seed: number;
  isBoss: boolean;
  ownedCharacters: OwnedCharacter[];
  allies: Combatant[];
  enemies: Combatant[];
  log: BattleLogEntry[];
  nameToId: Record<string, string>;
  /** Combined Root Access (+15%) / Cluster (+25%) reward multiplier in effect when this battle started — see usePlayerProgress.ts's VIP_CREDIT_XP_BONUS_PERCENT/CLUSTER_CREDIT_XP_BONUS_PERCENT. */
  bonusMultiplier: number;
}

/**
 * Enemies are calibrated against the original 4-character team; a player's
 * owned roster can now be smaller (a solo starter, until Invocação ships), so
 * scale enemy stats down proportionally on top of the per-estágio and
 * per-world difficulty. Non-boss waves also roll a random enemy count within
 * that estágio's enemyCountRange, using a separate Rng seeded off the
 * battle's own seed so the roll is deterministic (repeatBattle reproduces
 * it) without perturbing the battle simulation's own Rng sequence.
 */
function createSession(
  seed: number,
  position: WorldPosition,
  ownedCharacters: OwnedCharacter[],
  bonusMultiplier: number,
  selectedAbilityByCharacterId: Record<string, string>,
): BattleSession {
  const boss = isBossStage(position);
  const worldId = worldIdForFase(position.fase);
  const allies = loadCharactersByIds(
    ownedCharacters.map((o) => ({ id: o.characterId, xp: o.xp, rarity: o.rarity, selectedAbilityId: selectedAbilityByCharacterId[o.characterId] })),
  );
  const sizeFactor = teamSizeMultiplier(ownedCharacters.length);
  let enemies: Combatant[];
  if (boss) {
    // The boss only ever appears once per world (no intra-estágio scaling), but should still be
    // that world's base multiplier harder than the previous world's boss — difficultyMultiplier at
    // estágio 1 is exactly that base (no +5%-per-estágio component applied).
    enemies = loadWorldBoss(worldId, sizeFactor * difficultyMultiplier({ fase: position.fase, estagio: 1 }));
  } else {
    const [min, max] = enemyCountRange(position.estagio);
    const compositionRng = new Rng(seed);
    const count = min + Math.floor(compositionRng.next() * (max - min + 1));
    enemies = loadWorldComuns(worldId, count, difficultyMultiplier(position) * sizeFactor);
  }
  const result = runBattle(allies, enemies, { seed });
  return { seed, ...position, isBoss: boss, ownedCharacters, allies, enemies, log: result.log, nameToId: buildNameToId(allies, enemies), bonusMultiplier };
}

export type FloatingTextKind = 'damage' | 'crit' | 'heal' | 'shield';

export interface FloatingText {
  id: string;
  unitId: string;
  amount: number;
  kind: FloatingTextKind;
  createdAt: number;
}

/** How long a floating number stays on screen before being pruned. */
const FLOATER_LIFETIME_MS = 1100;

/** The full-screen "ability cast" callout (darken + sliding name + caster portrait) triggered by a BattleLogEntry's 'abilityUsed' kind — see abilityEngine.ts's fireTrigger. */
export interface AbilityCastEvent {
  id: string;
  unitId: string;
  unitName: string;
  isAlly: boolean;
  abilityName: string;
  portraitUrl?: string;
  createdAt: number;
}

/** How long the ability-cast callout stays on screen before being pruned — matches index.css's ability-cast-* keyframe durations. */
const ABILITY_CAST_LIFETIME_MS = 1800;

interface PlaybackState {
  session: BattleSession;
  replay: ReplayState;
  index: number;
  logFeed: ChatMessage[];
  floaters: FloatingText[];
  /** Non-null while the "ability cast" callout should be showing — see ABILITY_CAST_LIFETIME_MS. */
  activeAbility: AbilityCastEvent | null;
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  totalCredits: number;
  totalXp: number;
  /** Credits/XP earned from this specific battle — set once it ends, shown on the winner overlay. */
  lastReward: Reward | null;
  /**
   * The player's real saved progress — the highest position ever reached.
   * Distinct from `session.fase/estagio` (what's currently on screen), and
   * never regresses even when the live position does (e.g. after a retreat,
   * or replaying an earlier estágio via playStage). See progression.ts's
   * resolveProgression for the full transition rules.
   */
  frontier: WorldPosition;
  /** Non-null while grinding back up after a retirar-se-ao-perder retreat — see progression.ts's resolveProgression. */
  recoveryWinsRemaining: number | null;
}

type Action =
  | { type: 'reset'; session: BattleSession; frontier: WorldPosition; recoveryWinsRemaining: number | null }
  | { type: 'tick' }
  | { type: 'pruneFloaters' }
  | { type: 'pruneActiveAbility' }
  | { type: 'adjustCredits'; delta: number }
  | { type: 'setWallet'; credits: number; xp: number };

let chatIdCounter = 0;
let floaterIdCounter = 0;
let abilityCastIdCounter = 0;

// The reward numbers below are the same across every world — a placeholder
// until the real per-world economy (docs/mundos.md's "recompensas
// específicas" per world) lands.
const REWARDS: Record<'comuns' | 'boss', { win: { credits: number; xp: number }; lossOrDraw: { credits: number } }> = {
  comuns: { win: { credits: 20, xp: 15 }, lossOrDraw: { credits: 5 } },
  boss: { win: { credits: 80, xp: 40 }, lossOrDraw: { credits: 10 } },
};

export interface Reward {
  credits: number;
  xp: number;
}

/** Credits/XP earned for a battle's outcome — the single source both the log line and the running totals read from. Root Access/Cluster bonuses apply to both win and loss/draw payouts. */
function rewardFor(winner: 'allies' | 'enemies' | 'draw', session: BattleSession): Reward {
  const rewards = REWARDS[session.isBoss ? 'boss' : 'comuns'];
  const base = winner === 'allies' ? rewards.win : { credits: rewards.lossOrDraw.credits, xp: 0 };
  return { credits: Math.round(base.credits * session.bonusMultiplier), xp: Math.round(base.xp * session.bonusMultiplier) };
}

/** "[1] Jurupari 1-6 / Venceu [+20 C / +15 XP]" — the only line the Log tab shows, once per finished battle. */
function buildBattleSummary(winner: 'allies' | 'enemies' | 'draw', session: BattleSession, reward: Reward): ChatMessage {
  const won = winner === 'allies';
  const resultLabel = won ? 'Venceu' : winner === 'draw' ? 'Empate' : 'Perdeu';
  const rewardText = won ? `+${reward.credits} C / +${reward.xp} XP` : `+${reward.credits} C`;
  const worldDisplay = WORLD_DISPLAY_BY_ID[worldIdForFase(session.fase)];
  const worldNumber = worldIndexForFase(session.fase) + 1;
  const text = `[${worldNumber}] ${worldDisplay.name.replace(/\.iso$/, '')} ${localFaseNumber(session.fase)}-${session.estagio} / ${resultLabel} [${rewardText}]`;

  chatIdCounter += 1;
  return {
    id: `battle-log-${chatIdCounter}`,
    tab: 'log',
    text,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    tone: won ? 'success' : winner === 'draw' ? 'system' : 'danger',
  };
}

/** What floating numbers (if any) a log entry should spawn, keyed by target unit id. */
function floatersFor(entry: BattleLogEntry, nameToId: Record<string, string>): Omit<FloatingText, 'id' | 'createdAt'>[] {
  switch (entry.kind) {
    case 'attack':
      if (entry.result.dodged) return [];
      return [
        {
          unitId: entry.result.defender.id,
          amount: entry.result.finalDamage,
          kind: entry.result.crit ? 'crit' : 'damage',
        },
      ];
    case 'statusTick':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: entry.tickKind === 'heal' ? 'heal' : 'damage' }];
    case 'heal':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: 'heal' }];
    case 'shieldGranted':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: 'shield' }];
    case 'iceReflect':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: 'damage' }];
    case 'directDamage':
      return [{ unitId: nameToId[entry.target], amount: entry.amount, kind: 'damage' }];
    case 'overload':
      return entry.damages.map((d) => ({ unitId: nameToId[d.target], amount: d.amount, kind: 'damage' as const }));
    default:
      return [];
  }
}

/** Resolves an 'abilityUsed' entry into the ability-cast callout's data (caster identity + portrait) — null for every other entry kind. */
function abilityCastEventFor(entry: BattleLogEntry, session: BattleSession): Omit<AbilityCastEvent, 'id' | 'createdAt'> | null {
  if (entry.kind !== 'abilityUsed') return null;
  const unitId = session.nameToId[entry.unit];
  const combatant = session.allies.find((c) => c.id === unitId) ?? session.enemies.find((c) => c.id === unitId);
  if (!combatant) return null;
  return {
    unitId,
    unitName: entry.unit,
    isAlly: combatant.isAlly,
    abilityName: entry.abilityName,
    portraitUrl: DISPLAY_PORTRAIT_BY_TEMPLATE_ID[combatant.templateId],
  };
}

function buildInitialState(
  seed: number,
  position: WorldPosition,
  ownedCharacters: OwnedCharacter[],
  initialCredits: number,
  initialXp: number,
  bonusMultiplier: number,
  selectedAbilityByCharacterId: Record<string, string>,
): PlaybackState {
  const session = createSession(seed, position, ownedCharacters, bonusMultiplier, selectedAbilityByCharacterId);
  return {
    session,
    replay: createInitialReplayState(session.allies, session.enemies),
    index: 0,
    logFeed: [],
    floaters: [],
    activeAbility: null,
    finished: session.log.length === 0,
    winner: null,
    totalCredits: initialCredits,
    totalXp: initialXp,
    lastReward: null,
    frontier: position,
    recoveryWinsRemaining: null,
  };
}

function reducer(state: PlaybackState, action: Action): PlaybackState {
  if (action.type === 'reset') {
    return {
      session: action.session,
      replay: createInitialReplayState(action.session.allies, action.session.enemies),
      index: 0,
      // The Log tab and the wallet are history across battles, not just this one — carry them forward.
      logFeed: state.logFeed,
      totalCredits: state.totalCredits,
      totalXp: state.totalXp,
      floaters: [],
      activeAbility: null,
      finished: action.session.log.length === 0,
      winner: null,
      lastReward: null,
      frontier: action.frontier,
      recoveryWinsRemaining: action.recoveryWinsRemaining,
    };
  }

  if (action.type === 'pruneFloaters') {
    const now = Date.now();
    const floaters = state.floaters.filter((f) => now - f.createdAt < FLOATER_LIFETIME_MS);
    return floaters.length === state.floaters.length ? state : { ...state, floaters };
  }

  if (action.type === 'pruneActiveAbility') {
    if (!state.activeAbility || Date.now() - state.activeAbility.createdAt < ABILITY_CAST_LIFETIME_MS) return state;
    return { ...state, activeAbility: null };
  }

  if (action.type === 'adjustCredits') {
    return { ...state, totalCredits: Math.max(0, state.totalCredits + action.delta) };
  }

  if (action.type === 'setWallet') {
    return { ...state, totalCredits: action.credits, totalXp: action.xp };
  }

  if (state.finished || state.index >= state.session.log.length) {
    return state.finished ? state : { ...state, finished: true };
  }

  const entry = state.session.log[state.index];
  const replay = applyReplayEntry(state.replay, entry, state.session.nameToId);

  let logFeed = state.logFeed;
  let totalCredits = state.totalCredits;
  let totalXp = state.totalXp;
  let lastReward = state.lastReward;
  if (entry.kind === 'battleEnd') {
    const reward = rewardFor(entry.winner, state.session);
    logFeed = [...state.logFeed, buildBattleSummary(entry.winner, state.session, reward)];
    totalCredits += reward.credits;
    totalXp += reward.xp;
    lastReward = reward;
  }

  const now = Date.now();
  const newFloaters = floatersFor(entry, state.session.nameToId)
    .filter((f) => f.unitId)
    .map((f) => {
      floaterIdCounter += 1;
      return { ...f, id: `floater-${floaterIdCounter}`, createdAt: now };
    });
  const castEvent = abilityCastEventFor(entry, state.session);
  let activeAbility = state.activeAbility;
  if (castEvent) {
    abilityCastIdCounter += 1;
    activeAbility = { ...castEvent, id: `ability-cast-${abilityCastIdCounter}`, createdAt: now };
  }
  const winner = entry.kind === 'battleEnd' ? entry.winner : state.winner;
  const index = state.index + 1;

  return {
    ...state,
    replay,
    index,
    logFeed,
    totalCredits,
    totalXp,
    lastReward,
    floaters: [...state.floaters, ...newFloaters],
    activeAbility,
    winner,
    finished: index >= state.session.log.length,
  };
}

function toActiveStatuses(statuses: ReplayState['units'][string]['statuses']): ActiveStatus[] {
  return Object.entries(statuses)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([type, count]) => ({ type: type as ActiveStatus['type'], count: count ?? 0 }));
}

function toBattleUnits(templates: Combatant[], replay: ReplayState, order: string[]): BattleUnit[] {
  const byId = new Map(templates.map((t) => [t.id, t]));
  return order.map((id) => {
    const t = byId.get(id)!;
    const snapshot = replay.units[t.id];
    return {
      id: t.id,
      name: t.name,
      faction: t.faction ?? FALLBACK_FACTION,
      rarity: DISPLAY_RARITY_BY_TEMPLATE_ID[t.templateId] ?? FALLBACK_RARITY,
      // Allies carry a real level (derived from XP); enemies use a cosmetic per-templateId number.
      level: t.isAlly ? t.level : (ENEMY_LEVEL_BY_TEMPLATE_ID[t.templateId] ?? 1),
      hp: snapshot?.hp ?? t.maxHp,
      maxHp: t.maxHp,
      shield: snapshot?.shield ?? 0,
      statuses: snapshot ? toActiveStatuses(snapshot.statuses) : [],
      isAlly: t.isAlly,
      portraitUrl: DISPLAY_PORTRAIT_BY_TEMPLATE_ID[t.templateId],
    };
  });
}

export interface UseBattleSimulationOptions {
  /** The player's owned characters (id + xp) — who actually fights. Always required; there's no fallback team anymore. */
  initialOwnedCharacters: OwnedCharacter[];
  /** Keyed by characterId — the player's equipped active ability, from useCharacterProgression. Missing entries fall back to activeOptions[0] (see loader.ts's resolveCombatantAbilities). Read fresh on every new battle, same as bonusMultiplier. */
  selectedAbilityByCharacterId?: Record<string, string>;
  /** Milliseconds between revealed log entries while playing. */
  tickMs?: number;
  /** Pause after Vitória!/Derrota before auto-advancing to the next attempt. */
  autoAdvanceDelayMs?: number;
  /** Resume from a saved world position instead of starting at fase 1, estágio 1. */
  initialPosition?: WorldPosition;
  /** Resume from a saved wallet instead of starting at 0. */
  initialCredits?: number;
  initialXp?: number;
  /** Combined Root Access/Cluster reward multiplier (1 = no bonus) — read fresh on every new battle, not just at mount. */
  bonusMultiplier?: number;
}

export interface BattleSimulation {
  allies: BattleUnit[];
  enemies: BattleUnit[];
  stage: StageInfo;
  logFeed: ChatMessage[];
  floaters: FloatingText[];
  /** Non-null while the "ability cast" callout should be showing — see ABILITY_CAST_LIFETIME_MS. */
  activeAbility: AbilityCastEvent | null;
  /** Créditos/XP earned since `initialCredits`/`initialXp` — the caller is responsible for persisting these. */
  credits: number;
  xp: number;
  /** Créditos/XP earned from the battle that just finished, for the winner overlay — null until one ends. */
  lastReward: Reward | null;
  playing: boolean;
  finished: boolean;
  winner: 'allies' | 'enemies' | 'draw' | null;
  setPlaying: (playing: boolean) => void;
  /** Switches to advance mode ("Avançar") and immediately jumps to the next attempt, per resolveProgression. A no-op if already in advance mode — the auto-advance effect is already driving it. */
  startNewBattle: () => void;
  /** Switches to repeat mode ("Repetir estágio") and immediately retries the same estágio, per resolveProgression's repeat-mode rules. A no-op if already in repeat mode. Every subsequent finished battle keeps retrying until Avançar or the mini-map is used. */
  repeatBattle: () => void;
  /** 'advance' (Avançar) or 'repeat' (Repetir estágio) — the source of truth for which button should be highlighted as primary, and which resolveProgression rules apply on each finish. */
  mode: 'advance' | 'repeat';
  /** "Retirar-se ao perder" — when on, a loss that would otherwise just retry retreats one estágio instead (see progression.ts's resolveProgression). */
  retreatOnLoss: boolean;
  setRetreatOnLoss: (value: boolean) => void;
  /** Non-null while grinding back up after a retreat: how many more consecutive wins (at the current estágio) are needed before an advance is attempted again. */
  recoveryWinsRemaining: number | null;
  /** Spends (negative) or grants (positive) credits outside of battle rewards — the Loja's purchase/sale/claim primitive. Clamped at 0. */
  adjustCredits: (delta: number) => void;
  /** Overwrites credits/xp with server-authoritative values (an /api/** route's response) rather than
   * applying a delta — used to reconcile after an authoritative write instead of computing one locally. */
  setWallet: (credits: number, xp: number) => void;
  /** The player's real saved position (mini-map dots before this are completed) — distinct from `stage` while replaying an earlier estágio or mid-retreat. */
  frontierFase: number;
  frontierEstagio: number;
  /** Jumps to replay a specific estágio within the currently-viewed fase (the mini-map), leaving frontier untouched. */
  playStage: (estagio: number) => void;
}

export function useBattleSimulation(options: UseBattleSimulationOptions): BattleSimulation {
  const {
    initialOwnedCharacters,
    selectedAbilityByCharacterId = {},
    tickMs = 500,
    autoAdvanceDelayMs = 1600,
    initialPosition = { fase: 1, estagio: 1 },
    initialCredits = 0,
    initialXp = 0,
    bonusMultiplier = 1,
  } = options;
  const [playing, setPlaying] = useState(true);
  // 'advance' (Avançar) or 'repeat' (Repetir estágio) — which resolveProgression rules apply on
  // each finish. Kept outside the reducer since it's UI-driven mode, not battle state.
  const [mode, setMode] = useState<'advance' | 'repeat'>('advance');
  const [retreatOnLoss, setRetreatOnLoss] = useState(true);
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    buildInitialState(Date.now() >>> 0, initialPosition, initialOwnedCharacters, initialCredits, initialXp, bonusMultiplier, selectedAbilityByCharacterId),
  );

  useEffect(() => {
    if (!playing || state.finished) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), tickMs);
    return () => clearInterval(id);
  }, [playing, state.finished, state.session, tickMs]);

  useEffect(() => {
    if (state.floaters.length === 0) return;
    const id = setInterval(() => dispatch({ type: 'pruneFloaters' }), 250);
    return () => clearInterval(id);
  }, [state.floaters.length]);

  useEffect(() => {
    if (!state.activeAbility) return;
    const id = setTimeout(() => dispatch({ type: 'pruneActiveAbility' }), ABILITY_CAST_LIFETIME_MS);
    return () => clearTimeout(id);
  }, [state.activeAbility]);

  // World progression — see progression.ts's resolveProgression for the full Avançar/Repetir/
  // retirar-se-ao-perder rules this follows. Only while Auto is on.
  // Uses the *current* initialOwnedCharacters (not state.session.ownedCharacters, which is
  // frozen at whatever the previous battle started with) so XP earned since the last battle
  // is reflected in the next one's stats, not just in the Team page display.
  useEffect(() => {
    if (!state.finished || !playing) return;
    const position: WorldPosition = { fase: state.session.fase, estagio: state.session.estagio };
    const won = state.winner === 'allies';
    const result = resolveProgression(
      { position, frontier: state.frontier, recoveryWinsRemaining: state.recoveryWinsRemaining },
      { mode, retreatOnLoss, won },
    );
    const timer = setTimeout(() => {
      dispatch({
        type: 'reset',
        session: createSession(Date.now() >>> 0, result.position, initialOwnedCharacters, bonusMultiplier, selectedAbilityByCharacterId),
        frontier: result.frontier,
        recoveryWinsRemaining: result.recoveryWinsRemaining,
      });
    }, autoAdvanceDelayMs);
    return () => clearTimeout(timer);
  }, [
    state.finished,
    state.winner,
    state.session,
    state.frontier,
    state.recoveryWinsRemaining,
    playing,
    mode,
    retreatOnLoss,
    autoAdvanceDelayMs,
    initialOwnedCharacters,
    bonusMultiplier,
    selectedAbilityByCharacterId,
  ]);

  const startNewBattle = useCallback(() => {
    // Already advancing — the auto-advance effect is already driving this; a redundant click
    // shouldn't force an extra resolveProgression pass against whatever the battle's current
    // (possibly mid-fight) winner happens to be.
    if (mode === 'advance') return;
    setMode('advance');
    const position: WorldPosition = { fase: state.session.fase, estagio: state.session.estagio };
    const won = state.winner === 'allies';
    const result = resolveProgression(
      { position, frontier: state.frontier, recoveryWinsRemaining: state.recoveryWinsRemaining },
      { mode: 'advance', retreatOnLoss, won },
    );
    dispatch({
      type: 'reset',
      session: createSession(Date.now() >>> 0, result.position, initialOwnedCharacters, bonusMultiplier, selectedAbilityByCharacterId),
      frontier: result.frontier,
      recoveryWinsRemaining: result.recoveryWinsRemaining,
    });
    setPlaying(true);
  }, [
    mode,
    state.session.fase,
    state.session.estagio,
    state.winner,
    state.frontier,
    state.recoveryWinsRemaining,
    retreatOnLoss,
    initialOwnedCharacters,
    bonusMultiplier,
    selectedAbilityByCharacterId,
  ]);

  const repeatBattle = useCallback(() => {
    // Already repeating — nothing to change; avoids restarting the current battle mid-fight.
    if (mode === 'repeat') return;
    setMode('repeat');
    const position: WorldPosition = { fase: state.session.fase, estagio: state.session.estagio };
    const won = state.winner === 'allies';
    const result = resolveProgression(
      { position, frontier: state.frontier, recoveryWinsRemaining: state.recoveryWinsRemaining },
      { mode: 'repeat', retreatOnLoss, won },
    );
    // Reuse the exact same seed for a true instant-replay when nothing moved; a retreat lands on
    // a different estágio entirely, so a fresh seed makes more sense there.
    const seed = result.position.fase === position.fase && result.position.estagio === position.estagio ? state.session.seed : Date.now() >>> 0;
    dispatch({
      type: 'reset',
      session: createSession(seed, result.position, initialOwnedCharacters, bonusMultiplier, selectedAbilityByCharacterId),
      frontier: result.frontier,
      recoveryWinsRemaining: result.recoveryWinsRemaining,
    });
    setPlaying(true);
  }, [
    mode,
    state.session.fase,
    state.session.estagio,
    state.session.seed,
    state.winner,
    state.frontier,
    state.recoveryWinsRemaining,
    retreatOnLoss,
    initialOwnedCharacters,
    bonusMultiplier,
    selectedAbilityByCharacterId,
  ]);

  const playStage = useCallback(
    (estagio: number) => {
      dispatch({
        type: 'reset',
        session: createSession(Date.now() >>> 0, { fase: state.session.fase, estagio }, initialOwnedCharacters, bonusMultiplier, selectedAbilityByCharacterId),
        frontier: state.frontier,
        recoveryWinsRemaining: null,
      });
      setPlaying(true);
    },
    [state.session.fase, state.frontier, initialOwnedCharacters, bonusMultiplier, selectedAbilityByCharacterId],
  );

  const adjustCredits = useCallback((delta: number) => dispatch({ type: 'adjustCredits', delta }), []);
  const setWallet = useCallback((credits: number, xp: number) => dispatch({ type: 'setWallet', credits, xp }), []);

  const stageWorldId = worldIdForFase(state.session.fase);
  const stageWorldDisplay = WORLD_DISPLAY_BY_ID[stageWorldId];

  return {
    allies: toBattleUnits(state.session.allies, state.replay, state.replay.allyOrder),
    enemies: toBattleUnits(state.session.enemies, state.replay, state.replay.enemyOrder),
    stage: {
      worldId: stageWorldId,
      worldName: stageWorldDisplay.name,
      worldSubtitle: stageWorldDisplay.subtitle,
      phase: state.session.fase,
      stage: state.session.estagio,
      // Each world's own last fase has a 6th slot for its boss, one past its 5 regular estágios.
      totalStages: localFaseNumber(state.session.fase) === FASES_PER_WORLD ? ESTAGIOS_PER_FASE + 1 : ESTAGIOS_PER_FASE,
      isBoss: state.session.isBoss,
      round: Math.floor(state.replay.now),
    },
    logFeed: state.logFeed,
    floaters: state.floaters,
    activeAbility: state.activeAbility,
    credits: state.totalCredits,
    xp: state.totalXp,
    lastReward: state.lastReward,
    playing,
    finished: state.finished,
    winner: state.winner,
    setPlaying,
    startNewBattle,
    repeatBattle,
    mode,
    retreatOnLoss,
    setRetreatOnLoss,
    recoveryWinsRemaining: state.recoveryWinsRemaining,
    adjustCredits,
    setWallet,
    frontierFase: state.frontier.fase,
    frontierEstagio: state.frontier.estagio,
    playStage,
  };
}
