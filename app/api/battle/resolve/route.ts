import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { BattleResolveError, parseResolveRequest, resolveBattleForUser } from '../../../../lib/battle-resolve';

/**
 * Runs one PvE battle server-side and returns its log for the client to replay.
 *
 * The client sends only intent (advance/repeat, optionally which unlocked stage). Everything
 * that decides the outcome and the payout — roster, team, ability picks, position, VIP/Cluster
 * bonuses — is read from the player's own rows here. See lib/battle-resolve.ts for why.
 */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    try {
      const request = parseResolveRequest(await readJson(req));
      return NextResponse.json(await resolveBattleForUser(userId, request));
    } catch (err) {
      if (err instanceof BattleResolveError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  });
}
