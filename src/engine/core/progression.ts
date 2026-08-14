/**
 * World progression for Jurupari.iso. docs/mundos.md suggests 10 fases of 5
 * estágios each (50 total) as an unconfirmed starting point — adopted as-is.
 * Each fase resets to the same Estágio 1 baseline (no cross-fase difficulty
 * growth). The boss (Anhangá.exe) has its own fixed calibrated stats and
 * never scales — it's a distinct 6th checkpoint that comes after the last
 * fase's 5 regular estágios, not the 5th estágio itself.
 *
 * Estágio 1-5 within a fase is a progressive wave: more enemies and a
 * gentler stat bump each step (0/5/10/15/20%), deliberately easing off the
 * old +15%-compounding curve so a solo, appropriately-leveled character can
 * still realistically reach and beat the boss.
 */
export const TOTAL_FASES = 10;
export const ESTAGIOS_PER_FASE = 5;
/** The boss's own slot, one estágio past the last fase's 5 regular ones. */
const BOSS_ESTAGIO = ESTAGIOS_PER_FASE + 1;

/** +5% per estágio within a fase (0%, 5%, 10%, 15%, 20% across estágios 1-5). */
const PER_ESTAGIO_SCALING_STEP = 0.05;

export interface WorldPosition {
  fase: number;
  estagio: number;
}

export function isBossStage(position: WorldPosition): boolean {
  return position.fase === TOTAL_FASES && position.estagio === BOSS_ESTAGIO;
}

/** Multiplier applied to the comuns' Estágio 1 base stats for the given position. */
export function difficultyMultiplier(position: WorldPosition): number {
  return 1 + PER_ESTAGIO_SCALING_STEP * (position.estagio - 1);
}

/**
 * How many comuns enemies spawn for a given estágio position within its fase
 * (1-5), as an inclusive [min, max] to roll within — more enemies each step,
 * capping at 5 (the fase's hardest wave) rather than growing unbounded.
 */
export function enemyCountRange(estagio: number): [min: number, max: number] {
  switch (estagio) {
    case 1:
      return [2, 2];
    case 2:
      return [2, 3];
    case 3:
      return [3, 4];
    case 4:
      return [3, 5];
    default:
      return [5, 5];
  }
}

/**
 * Enemies are calibrated against the original 4-character team. Now that a
 * player's owned roster can be smaller (a solo starter, until Invocação
 * ships), scale enemies down proportionally so early game stays winnable.
 * First-pass number — easy to retune once there's real playtesting data.
 */
export function teamSizeMultiplier(teamSize: number): number {
  return teamSize / 4;
}

/**
 * Where progression goes after clearing `position`: next estágio, the boss
 * slot after the last fase's 5th estágio, or back to 1-1 after the boss
 * itself (no further worlds exist yet).
 */
export function nextStage(position: WorldPosition): WorldPosition {
  if (isBossStage(position)) return { fase: 1, estagio: 1 };
  if (position.fase === TOTAL_FASES && position.estagio === ESTAGIOS_PER_FASE) {
    return { fase: TOTAL_FASES, estagio: BOSS_ESTAGIO };
  }
  if (position.estagio < ESTAGIOS_PER_FASE) return { fase: position.fase, estagio: position.estagio + 1 };
  return { fase: position.fase + 1, estagio: 1 };
}

/** The inverse of nextStage — one estágio back, floored at 1-1 (never goes negative). */
export function prevStage(position: WorldPosition): WorldPosition {
  if (position.estagio > 1) return { fase: position.fase, estagio: position.estagio - 1 };
  if (position.fase > 1) return { fase: position.fase - 1, estagio: ESTAGIOS_PER_FASE };
  return { fase: 1, estagio: 1 };
}

/** <0 if a is before b, 0 if equal, >0 if a is after b. */
export function comparePositions(a: WorldPosition, b: WorldPosition): number {
  if (a.fase !== b.fase) return a.fase - b.fase;
  return a.estagio - b.estagio;
}

/** How many consecutive wins the "retirar-se ao perder" recovery grind requires before trying to advance again. */
export const RECOVERY_WINS_REQUIRED = 5;

export interface ProgressionState {
  /** The currently playing/viewed position — may be anywhere at or before `frontier`. */
  position: WorldPosition;
  /** The player's real saved progress — the highest position ever reached. Never regresses. */
  frontier: WorldPosition;
  /** Non-null while grinding back up after a retreat: this many more wins (at `position`) needed before advancing is attempted again. */
  recoveryWinsRemaining: number | null;
}

export interface ProgressionInput {
  mode: 'advance' | 'repeat';
  retreatOnLoss: boolean;
  won: boolean;
}

/**
 * Resolves where a just-finished battle leads next, per this exact spec:
 *
 * - Avançar: advances to the next estágio if the battle was won OR that next
 *   estágio was already reached before (replaying old, already-cleared
 *   content always moves forward regardless of this attempt's outcome);
 *   otherwise retries the same estágio.
 * - Repetir estágio: always retries the same estágio, win or lose — it never
 *   advances on its own, and isn't limited to the frontier estágio (you can
 *   pin repeat mode on any earlier stage via the mini-map).
 * - Retirar-se ao perder: when a loss would otherwise "retry the same
 *   estágio" (i.e., in Avançar mode, only on genuinely new/unwon content —
 *   the already-unlocked shortcut still applies; in Repetir mode, always),
 *   retreats one estágio instead. In Avançar mode this also starts a
 *   RECOVERY_WINS_REQUIRED-win streak requirement at the retreated estágio
 *   before another advance attempt is allowed (a further loss during that
 *   streak retreats again and restarts the streak); Repetir mode has no such
 *   streak — retreating just keeps repeating the new, lower estágio.
 *
 * `frontier` only ever moves forward, whenever `position` surpasses it.
 */
export function resolveProgression(state: ProgressionState, input: ProgressionInput): ProgressionState {
  const { position, frontier, recoveryWinsRemaining } = state;
  const { mode, retreatOnLoss, won } = input;

  const advanceTo = (next: WorldPosition): ProgressionState => ({
    position: next,
    frontier: comparePositions(next, frontier) > 0 ? next : frontier,
    recoveryWinsRemaining: null,
  });
  const retreat = (nextRecoveryWinsRemaining: number | null): ProgressionState => ({
    position: prevStage(position),
    frontier,
    recoveryWinsRemaining: nextRecoveryWinsRemaining,
  });

  if (mode === 'repeat') {
    if (!won && retreatOnLoss) return retreat(null);
    return { position, frontier, recoveryWinsRemaining: null };
  }

  // mode === 'advance'
  if (recoveryWinsRemaining !== null) {
    if (won) {
      if (recoveryWinsRemaining > 1) return { position, frontier, recoveryWinsRemaining: recoveryWinsRemaining - 1 };
      return advanceTo(nextStage(position));
    }
    return retreatOnLoss ? retreat(RECOVERY_WINS_REQUIRED) : { position, frontier, recoveryWinsRemaining };
  }

  const alreadyUnlocked = comparePositions(nextStage(position), frontier) <= 0;
  if (won || alreadyUnlocked) return advanceTo(nextStage(position));
  return retreatOnLoss ? retreat(RECOVERY_WINS_REQUIRED) : { position, frontier, recoveryWinsRemaining: null };
}
