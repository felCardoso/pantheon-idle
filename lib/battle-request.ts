import type { WorldPosition } from '../src/engine';

/**
 * Parsing and validation for app/api/battle/resolve's request body.
 *
 * Deliberately free of any server dependency (no `server-only`, no Supabase client): this is the
 * boundary where untrusted input is turned into a typed request, and keeping it pure means it can
 * be tested directly instead of only through a route that needs a database and env vars.
 */

export interface ResolveBattleRequest {
  mode: 'advance' | 'repeat';
  retreatOnLoss: boolean;
  /** Fight a specific already-unlocked stage (the world map) instead of the saved position. */
  position?: WorldPosition;
}

export class BattleResolveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function isWorldPosition(value: unknown): value is WorldPosition {
  if (typeof value !== 'object' || value === null) return false;
  const { fase, estagio } = value as Partial<WorldPosition>;
  return Number.isSafeInteger(fase) && Number.isSafeInteger(estagio) && (fase as number) >= 1 && (estagio as number) >= 1;
}

export function parseResolveRequest(body: Record<string, unknown>): ResolveBattleRequest {
  const mode = body.mode;
  if (mode !== 'advance' && mode !== 'repeat') {
    throw new BattleResolveError("mode must be 'advance' or 'repeat'", 400);
  }
  const position = body.position;
  if (position !== undefined && !isWorldPosition(position)) {
    throw new BattleResolveError('position must be { fase, estagio } of positive integers', 400);
  }
  // Anything other than an explicit `true` means off — the flag only ever makes the run harder,
  // so defaulting a malformed value to false is the safe direction.
  return { mode, retreatOnLoss: body.retreatOnLoss === true, position };
}
