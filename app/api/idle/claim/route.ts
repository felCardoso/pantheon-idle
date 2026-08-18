import { NextResponse } from 'next/server';
import { getUserFromRequest, UnauthorizedError } from '../../../../lib/auth-helpers';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

// First-pass idle economy — docs/gdd.md section 9 "Sistema offline" specifies 75% of a
// stage's average credits/xp while offline, but reward-per-stage scaling isn't implemented
// yet (useBattleSimulation.ts's REWARDS table is flat per battle, not per fase/estagio). Until
// that lands, this approximates "75% of the average common-stage battle, once a minute" —
// easy to retune once real per-stage scaling exists.
const OFFLINE_CREDIT_SHARE = 0.75;
const ASSUMED_BATTLE_INTERVAL_MS = 60_000;
const BASE_BATTLE_CREDITS = 20; // REWARDS.comuns.win.credits, useBattleSimulation.ts
const BASE_BATTLE_XP = 15; // REWARDS.comuns.win.xp, useBattleSimulation.ts
const IDLE_CREDITS_PER_MS = (BASE_BATTLE_CREDITS * OFFLINE_CREDIT_SHARE) / ASSUMED_BATTLE_INTERVAL_MS;
const IDLE_XP_PER_MS = (BASE_BATTLE_XP * OFFLINE_CREDIT_SHARE) / ASSUMED_BATTLE_INTERVAL_MS;
// Caps a single claim's payout regardless of how long it's actually been — protects against
// a very stale last_claim_at (e.g. a long-dormant account) producing an outsized grant.
const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await getUserFromRequest(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const { data: progress, error: selectError } = await supabaseAdmin
    .from('player_progress')
    .select('credits, xp, last_claim_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }
  if (!progress) {
    return NextResponse.json({ error: 'player_progress row not found — log into the game at least once first' }, { status: 404 });
  }

  const now = new Date();
  const elapsedMs = Math.min(Math.max(now.getTime() - new Date(progress.last_claim_at).getTime(), 0), MAX_OFFLINE_MS);
  const grantedCredits = Math.floor(elapsedMs * IDLE_CREDITS_PER_MS);
  const grantedXp = Math.floor(elapsedMs * IDLE_XP_PER_MS);

  const nextCredits = progress.credits + grantedCredits;
  const nextXp = progress.xp + grantedXp;

  const { error: updateError } = await supabaseAdmin
    .from('player_progress')
    .update({ credits: nextCredits, xp: nextXp, last_claim_at: now.toISOString() })
    .eq('user_id', userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    grantedCredits,
    grantedXp,
    credits: nextCredits,
    xp: nextXp,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
  });
}
