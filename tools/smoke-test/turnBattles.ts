/**
 * End-to-end smoke test for the turn-based engine against a REAL Supabase project + a locally
 * running `npm run dev` — the thing that can't be verified from inside an agent sandbox with no
 * network route to Supabase (see the PR discussion). Exercises, with two throwaway accounts:
 *
 *   1. Auto-played PvE (POST /api/battle/resolve) — the default path.
 *   2. Manual PvE (POST /api/battle/turn-start + turn-act, lib/pve-turn-battle.ts) — the opt-in
 *      "Jogar manualmente" path, including the pve_turn_battles round trip.
 *   3. Turn-based PvP (the pvp-turn-start/pvp-turn-act Edge Functions) — attacker vs. a defender
 *      with a saved defense team, including the Elo/XP commit at the end.
 *
 * Usage:
 *   1. Fill in .env.local (see .env.example) with a REAL project's credentials.
 *   2. Apply the migrations and deploy the two turn functions: `npm run deploy:functions`
 *      (or apply supabase/migrations/*.sql by hand first if you're not using `supabase db push`).
 *   3. In one terminal: `npm run dev`.
 *   4. In another: `npx tsx tools/smoke-test/turnBattles.ts` (add `--keep` to skip deleting the
 *      two throwaway accounts afterwards, e.g. to inspect them in the Supabase dashboard).
 *
 * Exits non-zero on the first failed assertion, with the response body that failed it.
 */
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ALL_CHARACTER_IDS } from '../../src/engine';

function loadEnvLocal(): void {
  let text: string;
  try {
    text = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
  } catch {
    throw new Error('.env.local not found — copy .env.example to .env.local and fill in a real Supabase project\'s credentials first.');
  }
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';
const KEEP_ACCOUNTS = process.argv.includes('--keep');

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local.');
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let stepCount = 0;
function step(label: string) {
  stepCount += 1;
  console.log(`\n[${stepCount}] ${label}`);
}

function assert(condition: unknown, message: string, context?: unknown): asserts condition {
  if (!condition) {
    if (context !== undefined) console.error('  ↳ response:', JSON.stringify(context, null, 2));
    throw new Error(`FAILED: ${message}`);
  }
  console.log(`  ok — ${message}`);
}

async function postApi(path: string, token: string, body: unknown): Promise<any> {
  const res = await fetch(`${APP_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

interface TestAccount {
  userId: string;
  email: string;
  password: string;
  client: SupabaseClient;
  token: string;
}

async function createTestAccount(label: string): Promise<TestAccount> {
  const email = `smoke-test-${label}-${Date.now()}@example.com`;
  const password = crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Failed to create test account ${label}: ${error?.message}`);

  const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) throw new Error(`Failed to sign in test account ${label}: ${signInError?.message}`);

  return { userId: data.user.id, email, password, client, token: signIn.session.access_token };
}

/** Front row alive units, else back row alive — mirrors src/components/battle/TurnBattleStage.tsx's legalRow, duplicated here since this script talks to the API only, never the engine directly. */
function legalTarget(units: { id: string; hp: number; row: 'front' | 'back' }[]): { id: string } {
  const alive = units.filter((u) => u.hp > 0);
  const front = alive.filter((u) => u.row === 'front');
  const pool = front.length > 0 ? front : alive.filter((u) => u.row === 'back');
  if (pool.length === 0) throw new Error('No legal target — the battle should already be over.');
  return pool[0];
}

/** Drives a turn-start/turn-act pair of endpoints to completion via basic attacks only — enough to prove the round trip and reward/progression commit work, without needing to know each character's kit. */
async function playToCompletion(
  startResponse: any,
  act: (unitId: string, action: { type: 'basicAttack'; targetId: string }) => Promise<any>,
): Promise<any> {
  let response = startResponse;
  let guard = 0;
  while (!response.finished) {
    guard += 1;
    if (guard > 300) throw new Error('Battle did not finish within 300 actions — something is stuck.');
    const target = legalTarget(response.enemies);
    response = await act(response.pendingAllyUnitId, { type: 'basicAttack', targetId: target.id });
  }
  return response;
}

async function main() {
  console.log(`Target app: ${APP_BASE_URL}`);
  console.log(`Target Supabase project: ${SUPABASE_URL}`);

  const [charA, charB] = ALL_CHARACTER_IDS;
  assert(charA && charB, 'ALL_CHARACTER_IDS has at least two entries to hand out as starters');

  step('Create two throwaway accounts (attacker + defender)');
  const attacker = await createTestAccount('attacker');
  const defender = await createTestAccount('defender');
  console.log(`  attacker: ${attacker.email} (${attacker.userId})`);
  console.log(`  defender: ${defender.email} (${defender.userId})`);

  try {
    step('Claim starter characters');
    const attackerStarter = await postApi('/api/characters/claim-starter', attacker.token, { characterId: charA });
    assert(attackerStarter.characterId === charA, 'attacker claimed the requested starter', attackerStarter);
    const defenderStarter = await postApi('/api/characters/claim-starter', defender.token, { characterId: charB });
    assert(defenderStarter.characterId === charB, 'defender claimed the requested starter', defenderStarter);

    step('Auto-played PvE battle (POST /api/battle/resolve)');
    const auto = await postApi('/api/battle/resolve', attacker.token, { mode: 'advance', retreatOnLoss: false });
    assert(Array.isArray(auto.log) && auto.log.length > 0, 'response has a non-empty turn-mode log', auto);
    assert(auto.winner === 'allies' || auto.winner === 'enemies' || auto.winner === 'draw', 'response has a decided winner', auto);
    assert(typeof auto.credits === 'number' && typeof auto.xp === 'number', 'response has authoritative credits/xp', auto);
    console.log(`  winner: ${auto.winner}, credits: ${auto.credits}, xp: ${auto.xp}`);

    step('Manual PvE battle (POST /api/battle/turn-start + turn-act)');
    const manualStart = await postApi('/api/battle/turn-start', attacker.token, { mode: 'advance', retreatOnLoss: false });
    assert(manualStart.finished === true || typeof manualStart.battleId === 'string', 'turn-start returns either a finished result or a battleId', manualStart);
    const manualResult = manualStart.finished
      ? manualStart
      : await playToCompletion(manualStart, (unitId, action) => postApi('/api/battle/turn-act', attacker.token, { battleId: manualStart.battleId, unitId, action }));
    assert(manualResult.finished === true, 'manual battle reaches a finished state', manualResult);
    assert(typeof manualResult.credits === 'number' && typeof manualResult.xp === 'number', 'finished manual battle has authoritative credits/xp', manualResult);
    console.log(`  winner: ${manualResult.winner}, credits: ${manualResult.credits}, xp: ${manualResult.xp}`);

    step('Set defender\'s PvP defense team');
    const defenseTeam = await postApi('/api/pvp/defense-team', defender.token, {
      characterIds: [charB],
      formation: { [charB]: 'front' },
    });
    assert(defenseTeam.ok === true, 'defense team saved', defenseTeam);

    step('Turn-based PvP battle (pvp-turn-start / pvp-turn-act Edge Functions)');
    const { data: pvpStart, error: pvpStartError } = await attacker.client.functions.invoke('pvp-turn-start', {
      body: { defenderId: defender.userId },
    });
    assert(!pvpStartError && pvpStart, 'pvp-turn-start succeeded', pvpStartError ?? pvpStart);
    const pvpResult = pvpStart.finished
      ? pvpStart
      : await playToCompletion(pvpStart, async (unitId, action) => {
          const { data, error } = await attacker.client.functions.invoke('pvp-turn-act', { body: { battleId: pvpStart.battleId, unitId, action } });
          assert(!error && data, 'pvp-turn-act succeeded', error ?? data);
          return data;
        });
    assert(pvpResult.finished === true, 'PvP battle reaches a finished state', pvpResult);
    assert(typeof pvpResult.newRating === 'number', 'finished PvP battle reports the attacker\'s new rating', pvpResult);
    console.log(`  winner: ${pvpResult.winner}, ratingDelta: ${pvpResult.ratingDelta}, newRating: ${pvpResult.newRating}`);

    console.log('\nAll checks passed.');
  } finally {
    if (KEEP_ACCOUNTS) {
      console.log('\n--keep passed — leaving both throwaway accounts in place for inspection.');
    } else {
      step('Cleaning up throwaway accounts');
      await admin.auth.admin.deleteUser(attacker.userId).catch((err) => console.warn('  could not delete attacker account:', err));
      await admin.auth.admin.deleteUser(defender.userId).catch((err) => console.warn('  could not delete defender account:', err));
    }
  }
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
