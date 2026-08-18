import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/** Thrown by getUserFromRequest when the request has no valid Supabase session. Route
 * handlers should catch this and respond 401 — see the try/catch shape in
 * app/api/users/me/route.ts. */
export class UnauthorizedError extends Error {}

/** Reads the `Authorization: Bearer <token>` header, or null if missing/malformed. Most
 * routes want getUserFromRequest instead — this is for the rare case (see
 * lib/supabase-scoped.ts's callers) that needs the raw token itself, not just the id it
 * resolves to. */
export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  return authHeader?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

/**
 * Reads the `Authorization: Bearer <supabase-access-token>` header from an incoming
 * API route request, validates it against Supabase Auth, and returns the caller's
 * user id. Every authoritative write in app/api/** should call this first — never
 * trust a user id the client sends in a body/query param instead.
 */
export async function getUserFromRequest(req: Request): Promise<string> {
  const token = getBearerToken(req);
  if (!token) {
    throw new UnauthorizedError('Missing Authorization: Bearer <token> header');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  return data.user.id;
}
