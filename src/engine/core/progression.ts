/**
 * World progression for Jurupari.iso. docs/mundos.md suggests 10 fases of 5
 * estágios each (50 total) as an unconfirmed starting point — adopted as-is.
 * Each fase resets to the same Estágio 1 baseline (no cross-fase difficulty
 * growth). The boss (Anhangá.exe) has its own fixed calibrated stats and
 * never scales — it only ever appears once, at the final estágio.
 *
 * Estágio 1-5 within a fase is a progressive wave: more enemies and a
 * gentler stat bump each step (0/5/10/15/20%), deliberately easing off the
 * old +15%-compounding curve so a solo, appropriately-leveled character can
 * still realistically reach and beat the boss.
 */
export const TOTAL_FASES = 10;
export const ESTAGIOS_PER_FASE = 5;

/** +5% per estágio within a fase (0%, 5%, 10%, 15%, 20% across estágios 1-5). */
const PER_ESTAGIO_SCALING_STEP = 0.05;

export interface WorldPosition {
  fase: number;
  estagio: number;
}

export function isBossStage(position: WorldPosition): boolean {
  return position.fase === TOTAL_FASES && position.estagio === ESTAGIOS_PER_FASE;
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
 * Where progression goes after finishing `position` with a win: next estágio,
 * or the next fase's estágio 1 if that was the last one, or back to 1-1 if
 * the boss was just defeated (no further worlds exist yet).
 */
export function nextStage(position: WorldPosition): WorldPosition {
  if (isBossStage(position)) return { fase: 1, estagio: 1 };
  if (position.estagio < ESTAGIOS_PER_FASE) return { fase: position.fase, estagio: position.estagio + 1 };
  return { fase: position.fase + 1, estagio: 1 };
}
