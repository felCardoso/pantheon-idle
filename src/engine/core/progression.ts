/**
 * World progression for Jurupari.iso. docs/mundos.md suggests 10 fases of 5
 * estágios each (50 total) as an unconfirmed starting point — adopted as-is.
 * docs/mvp.md only defines difficulty scaling *within* a fase (+15% per
 * estágio); there's no documented rule for scaling *across* fases, so each
 * fase resets to the original Estágio 1 baseline rather than inventing a
 * cross-fase multiplier. The boss (Anhangá.exe) has its own fixed calibrated
 * stats and never scales — it only ever appears once, at the final estágio.
 */
export const TOTAL_FASES = 10;
export const ESTAGIOS_PER_FASE = 5;

/** +15% compounding per estágio within a fase; estagio is the 1-indexed position inside its fase (1-5). */
const PER_ESTAGIO_SCALING = 1.15;

export interface WorldPosition {
  fase: number;
  estagio: number;
}

export function isBossStage(position: WorldPosition): boolean {
  return position.fase === TOTAL_FASES && position.estagio === ESTAGIOS_PER_FASE;
}

/** Multiplier applied to the comuns' Estágio 1 base stats for the given position. */
export function difficultyMultiplier(position: WorldPosition): number {
  return Math.pow(PER_ESTAGIO_SCALING, position.estagio - 1);
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
