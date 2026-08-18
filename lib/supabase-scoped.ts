import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * A Supabase client authenticated as the calling player (their own access token, not the
 * service role) — for calling existing security-definer RPCs (publish/cancel/purchase_
 * diagram_listing, see supabase/migrations 0013/0015) whose internal `auth.uid()` needs to
 * resolve to the real caller. supabaseAdmin (service role) carries no JWT context, so
 * auth.uid() would read null there — this is the one place a route should use the caller's
 * own token instead of the admin client, precisely because the RPC already re-derives and
 * enforces the caller's identity itself.
 */
export function getScopedSupabaseClient(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
