import 'server-only';
import {
  comparePositions,
  difficultyMultiplier,
  enemyCountRange,
  isBossStage,
  loadCharactersByIds,
  loadWorldBoss,
  loadWorldComuns,
  resolveProgression,
  Rng,
  runBattle,
  teamSizeMultiplier,
  worldIdForFase,
  type BattleLogEntry,
  type Combatant,
  type WorldPosition,
} from '../src/engine';
import { CLUSTER_CREDIT_XP_BONUS_PERCENT, isVipActive, VIP_CREDIT_XP_BONUS_PERCENT } from '../src/data/playerEconomy';
import { supabaseAdmin } from './supabase-admin';

/**
 * Server-side PvE battle resolution.
 *
 * PvE used to run entirely in the browser: the client simulated the fight, decided what it had
 * earned, and wrote credits/xp/fase/estagio straight into player_progress. Every reward in the
 * game was therefore self-reported, and because player_characters.xp feeds the attacker's stats
 * in PvP, inflated XP leaked into other players' matches too.
 *
 * The fix is the same shape PvP already uses (supabase/functions/pvp-attack): the server owns
 * the whole thing. It reads the roster, the team, the ability picks and the position from the
 * player's own rows, runs the same deterministic engine, decides the reward from its own table,
 * applies progression, and writes the result. The client supplies only *intent* — advance or
 * repeat, and optionally which already-unlocked stage to fight — and gets back a log to replay.
 */

/** Payouts per battle type. Server-owned: the client never says what it earned. */
const REWARDS: Record<'comuns' | 'boss', { win: { credits: number; xp: number }; lossOrDraw: { credits: number } }> = {
  comuns: { win: { credits: 20, xp: 15 }, lossOrDraw: { credits: 5 } },
  boss: { win: { credits: 80, xp: 40 }, lossOrDraw: { credits: 10 } },
};

export interface ResolveBattleRequest {
  mode: 'advance' | 'repeat';
  retreatOnLoss: boolean;
  /** Fight a specific already-unlocked stage (the world map) instead of the saved position. */
  position?: WorldPosition;
}

export interface ResolveBattleResult {
  seed: number;
  position: WorldPosition;
  isBoss: boolean;
  winner: 'allies' | 'enemies' | 'draw';
  log: BattleLogEntry[];
  allies: Combatant[];
  enemies: Combatant[];
  reward: { credits: number; xp: number };
  /** Authoritative wallet and progress after this battle. */
  credits: number;
  xp: number;
  nextPosition: WorldPosition;
  frontier: WorldPosition;
  recoveryWinsRemaining: number | null;
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
  const p = value as WorldPosition | undefined;
  return !!p && Number.isInteger(p.fase) && Number.isInteger(p.estagio) && p.fase >= 1 && p.estagio >= 1;
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
  return { mode, retreatOnLoss: body.retreatOnLoss === true, position: position as WorldPosition | undefined };
}

export async function resolveBattleForUser(userId: string, request: ResolveBattleRequest): Promise<ResolveBattleResult> {
  const [{ data: progress, error: progressError }, { data: owned }, { data: abilityProgress }, { data: membership }] = await Promise.all([
    supabaseAdmin
      .from('player_progress')
      .select('fase, estagio, credits, xp, pve_team_slot, vip_expires_at, recovery_wins_remaining')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin.from('player_characters').select('character_id, xp, rarity').eq('user_id', userId),
    supabaseAdmin.from('character_ability_progress').select('character_id, selected_ability_id').eq('user_id', userId),
    supabaseAdmin.from('cluster_members').select('cluster_id').eq('user_id', userId).maybeSingle(),
  ]);

  if (progressError) throw new BattleResolveError(progressError.message, 500);
  if (!progress) throw new BattleResolveError('player_progress row not found — log into the game at least once first', 404);

  const { data: teamRow } = await supabaseAdmin
    .from('player_teams')
    .select('characters')
    .eq('user_id', userId)
    .eq('slot', progress.pve_team_slot ?? 1)
    .maybeSingle();

  // The saved fase/estagio is the *frontier* — the furthest point ever reached. A requested
  // position is only honoured if it is at or before it, so the map can replay an earlier stage
  // but nobody can skip ahead to the boss's larger payout.
  const frontier: WorldPosition = { fase: progress.fase, estagio: progress.estagio };
  const position = request.position ?? frontier;
  if (comparePositions(position, frontier) > 0) {
    throw new BattleResolveError('Position not unlocked yet.', 403);
  }

  const ownedById = new Map((owned ?? []).map((c) => [c.character_id, c]));
  const selectedAbilityByCharacterId = Object.fromEntries(
    (abilityProgress ?? []).filter((p) => p.selected_ability_id).map((p) => [p.character_id, p.selected_ability_id as string]),
  );

  // The PvE team the player selected, falling back to whatever they own — mirrors GameShell's
  // own fallback for the window before a fresh account's teams finish initializing.
  const teamIds = ((teamRow?.characters as unknown as string[] | null) ?? []).filter((id) => ownedById.has(id));
  const roster = (teamIds.length > 0 ? teamIds : (owned ?? []).map((c) => c.character_id).slice(0, 5))
    .map((id) => ownedById.get(id)!)
    .filter(Boolean);
  if (roster.length === 0) {
    throw new BattleResolveError('No characters to fight with.', 400);
  }

  const allies = loadCharactersByIds(
    roster.map((c) => ({
      id: c.character_id,
      xp: c.xp,
      rarity: c.rarity as Parameters<typeof loadCharactersByIds>[0][number]['rarity'],
      selectedAbilityId: selectedAbilityByCharacterId[c.character_id],
    })),
  );

  const seed = Date.now() >>> 0;
  const boss = isBossStage(position);
  const worldId = worldIdForFase(position.fase);
  const sizeFactor = teamSizeMultiplier(allies.length);
  let enemies: Combatant[];
  if (boss) {
    enemies = loadWorldBoss(worldId, sizeFactor * difficultyMultiplier({ fase: position.fase, estagio: 1 }));
  } else {
    const [min, max] = enemyCountRange(position.estagio);
    const compositionRng = new Rng(seed);
    const count = min + Math.floor(compositionRng.next() * (max - min + 1));
    enemies = loadWorldComuns(worldId, count, difficultyMultiplier(position) * sizeFactor);
  }

  const result = runBattle(allies, enemies, { seed });
  const won = result.winner === 'allies';

  // Bonuses are read from the player's own rows, never sent by the client.
  const bonusMultiplier =
    1 + (isVipActive(progress.vip_expires_at) ? VIP_CREDIT_XP_BONUS_PERCENT : 0) + (membership ? CLUSTER_CREDIT_XP_BONUS_PERCENT : 0);
  const table = REWARDS[boss ? 'boss' : 'comuns'];
  const base = won ? table.win : { credits: table.lossOrDraw.credits, xp: 0 };
  const reward = { credits: Math.round(base.credits * bonusMultiplier), xp: Math.round(base.xp * bonusMultiplier) };

  const next = resolveProgression(
    { position, frontier, recoveryWinsRemaining: progress.recovery_wins_remaining ?? null },
    { mode: request.mode, retreatOnLoss: request.retreatOnLoss, won },
  );

  const credits = progress.credits + reward.credits;
  const xp = progress.xp + reward.xp;

  const { error: updateError } = await supabaseAdmin
    .from('player_progress')
    .update({
      credits,
      xp,
      fase: next.frontier.fase,
      estagio: next.frontier.estagio,
      recovery_wins_remaining: next.recoveryWinsRemaining,
    })
    .eq('user_id', userId);
  if (updateError) throw new BattleResolveError(updateError.message, 500);

  // Every owned character fights together, so a win levels the whole roster — same rule the
  // client used to apply, now applied where it can't be forged.
  if (reward.xp > 0 && (owned ?? []).length > 0) {
    const { error: xpError } = await supabaseAdmin.from('player_characters').upsert(
      (owned ?? []).map((c) => ({ user_id: userId, character_id: c.character_id, xp: c.xp + reward.xp, rarity: c.rarity })),
      { onConflict: 'user_id,character_id' },
    );
    if (xpError) throw new BattleResolveError(xpError.message, 500);
  }

  return {
    seed,
    position,
    isBoss: boss,
    winner: result.winner,
    log: result.log,
    allies,
    enemies,
    reward,
    credits,
    xp,
    nextPosition: next.position,
    frontier: next.frontier,
    recoveryWinsRemaining: next.recoveryWinsRemaining,
  };
}
