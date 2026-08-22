import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { BattleResolveError, parseResolveRequest } from '../../../../lib/battle-request';
import { startManualPveBattle } from '../../../../lib/pve-turn-battle';

/**
 * Starts a manually-controlled PvE battle — the opt-in alternative to app/api/battle/resolve's
 * auto-played default (see lib/pve-turn-battle.ts). Same request shape as /resolve (mode/
 * retreatOnLoss/position); the response is either an in-progress battle to drive with
 * app/api/battle/turn-act, or an already-finished one if a battle-opening passive decided it.
 */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    try {
      const request = parseResolveRequest(await readJson(req));
      return NextResponse.json(await startManualPveBattle(userId, request));
    } catch (err) {
      if (err instanceof BattleResolveError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  });
}
