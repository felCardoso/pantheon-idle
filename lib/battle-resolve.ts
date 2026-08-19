import 'server-only';
import { randomInt } from 'node:crypto';
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
import {
  CLUSTER_CREDIT_XP_BONUS_PERCENT,
  isVipActive,
  PVP_ENCOUNTER_CHANCE,
  PVP_ENCOUNTER_MIN_BATTLES,
  VIP_CREDIT_XP_BONUS_PERCENT,
} from '../src/data/playerEconomy';
import { supabaseAdmin } from './supabase-admin';
import { BattleResolveError, type ResolveBattleRequest } from './battle-request';

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

/** An opponent the run just ran into — the client attacks them through the usual pvp-attack path. */
export interface PvpEncounter {
  userId: string;
  username: string;
  rating: number;
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
  /** Non-null when this battle rolled a random PvP encounter — see rollPvpEncounter. */
  pvpEncounter: PvpEncounter | null;
}

/**
 * Rolls whether the run bumps into another player, and picks who.
 *
 * PvP used to happen only when someone opened the opponent list and clicked Atacar, so most of
 * the ladder never moved. Now a run has to go PVP_ENCOUNTER_MIN_BATTLES battles without an
 * encounter before one becomes possible at all, and each battle after that rolls
 * PVP_ENCOUNTER_CHANCE.
 *
 * Rolled here rather than in the browser because the counter has to be tamper-proof in both
 * directions: a client that owned it could farm encounters, or simply never trigger one.
 * Returns null (no encounter) when nobody has a defense team saved yet.
 */
async function rollPvpEncounter(userId: string, battlesSinceLast: number): Promise<PvpEncounter | null> {
  if (battlesSinceLast < PVP_ENCOUNTER_MIN_BATTLES) return null;
  if (randomInt(0, 10_000) >= Math.round(PVP_ENCOUNTER_CHANCE * 10_000)) return null;

  const { data: defenses } = await supabaseAdmin.from('pvp_defense_teams').select('user_id').neq('user_id', userId).limit(50);
  const candidates = (defenses ?? []).map((d) => d.user_id);
  if (candidates.length === 0) return null;

  const opponentId = candidates[randomInt(0, candidates.length)];
  const [{ data: profile }, { data: opponentProgress }] = await Promise.all([
    supabaseAdmin.from('profiles').select('username').eq('user_id', opponentId).maybeSingle(),
    supabaseAdmin.from('player_progress').select('pvp_rating').eq('user_id', opponentId).maybeSingle(),
  ]);

  return { userId: opponentId, username: profile?.username ?? 'Node', rating: opponentProgress?.pvp_rating ?? 1000 };
}

export async function resolveBattleForUser(userId: string, request: ResolveBattleRequest): Promise<ResolveBattleResult> {
  // All five reads go out together. The team used to be fetched afterwards because picking the
  // slot needs pve_team_slot — but a player has at most five team rows, so reading them all and
  // picking in memory turns a second round trip into part of the first. Battles are the game's
  // hottest path now that each one is a request.
  const [{ data: progress, error: progressError }, { data: owned }, { data: abilityProgress }, { data: membership }, { data: teamRows }] =
    await Promise.all([
    supabaseAdmin
      .from('player_progress')
      .select(
        'fase, estagio, credits, xp, pve_team_slot, vip_expires_at, recovery_wins_remaining, pve_battles_since_pvp, current_fase, current_estagio',
      )
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin.from('player_characters').select('character_id, xp, rarity').eq('user_id', userId),
    supabaseAdmin.from('character_ability_progress').select('character_id, selected_ability_id').eq('user_id', userId),
    supabaseAdmin.from('cluster_members').select('cluster_id').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('player_teams').select('slot, characters').eq('user_id', userId),
  ]);

  if (progressError) throw new BattleResolveError(progressError.message, 500);
  if (!progress) throw new BattleResolveError('player_progress row not found — log into the game at least once first', 404);

  const teamRow = (teamRows ?? []).find((t) => t.slot === (progress.pve_team_slot ?? 1));

  // The saved fase/estagio is the *frontier* — the furthest point ever reached. A requested
  // position is only honoured if it is at or before it, so the map can replay an earlier stage
  // but nobody can skip ahead to the boss's larger payout.
  const frontier: WorldPosition = { fase: progress.fase, estagio: progress.estagio };
  // Where the player actually is, which can sit behind the frontier after a retreat or a map
  // jump. Falls back to the frontier for rows written before migration 0024.
  const savedPosition: WorldPosition =
    progress.current_fase && progress.current_estagio ? { fase: progress.current_fase, estagio: progress.current_estagio } : frontier;
  const position = request.position ?? savedPosition;
  if (comparePositions(position, frontier) > 0) {
    throw new BattleResolveError('Position not unlocked yet.', 403);
  }

  const ownedById = new Map((owned ?? []).map((c) => [c.character_id, c]));
  const selectedAbilityByCharacterId = Object.fromEntries(
    (abilityProgress ?? []).filter((p) => p.selected_ability_id).map((p) => [p.character_id, p.selected_ability_id as string]),
  );

  // The PvE team the player selected, falling back to whatever they own — mirrors GameShell's
  // own fallback for the window before a fresh account's teams finish initializing.
  // Deduped on read as well as on write (app/api/teams/save): rows saved before that guard
  // existed can still carry a repeated id, which would build two Combatants sharing an id and
  // double-count the mythology synergy.
  const teamIds = [...new Set(((teamRow?.characters as unknown as string[] | null) ?? []).filter((id) => ownedById.has(id)))];
  const roster = (teamIds.length > 0 ? teamIds : [...new Set((owned ?? []).map((c) => c.character_id))].slice(0, 5))
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

  // The encounter counter advances on every PvE battle and resets only when one actually fires,
  // so a run that never finds an opponent keeps rolling rather than stalling.
  const battlesSinceLastPvp = (progress.pve_battles_since_pvp ?? 0) + 1;
  const pvpEncounter = await rollPvpEncounter(userId, battlesSinceLastPvp);

  const { error: updateError } = await supabaseAdmin
    .from('player_progress')
    .update({
      credits,
      xp,
      fase: next.frontier.fase,
      estagio: next.frontier.estagio,
      recovery_wins_remaining: next.recoveryWinsRemaining,
      current_fase: next.position.fase,
      current_estagio: next.position.estagio,
      pve_battles_since_pvp: pvpEncounter ? 0 : battlesSinceLastPvp,
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
    pvpEncounter,
  };
}
