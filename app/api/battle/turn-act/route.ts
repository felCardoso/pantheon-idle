import { NextResponse } from 'next/server';
import { withUser, readJson } from '../../../../lib/route-helpers';
import { BattleResolveError, parseTurnActRequest } from '../../../../lib/battle-request';
import { actOnManualPveBattle } from '../../../../lib/pve-turn-battle';

/** Applies one player action to a manual PvE battle started by app/api/battle/turn-start. See lib/pve-turn-battle.ts. */
export async function POST(req: Request) {
  return withUser(req, async (userId) => {
    try {
      const request = parseTurnActRequest(await readJson(req));
      return NextResponse.json(await actOnManualPveBattle(userId, request));
    } catch (err) {
      if (err instanceof BattleResolveError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  });
}
