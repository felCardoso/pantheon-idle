import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/database.types';

// Service-role Supabase client — bypasses RLS. The `server-only` import above makes
// any accidental import of this file from a Client Component fail the build instead
// of silently bundling (and leaking) SUPABASE_SERVICE_ROLE_KEY into browser JS. Only
// import this from app/api/** route handlers (or other server-only code).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill in your Supabase project credentials.',
  );
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
