import { supabase } from './supabaseClient';

/** Thrown by postApi with the server's own error message, or a fallback if it sent none. */
export class ApiError extends Error {}

/**
 * POSTs to one of this app's own authoritative routes (app/api/**), attaching the current
 * Supabase session's access token as `Authorization: Bearer <token>` so the route's
 * getUserFromRequest can identify the caller — see lib/auth-helpers.ts on the server side.
 */
export async function postApi<T>(path: string, body?: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError('Not signed in');

  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(typeof json.error === 'string' ? json.error : `Request failed (${res.status})`);
  }
  return json as T;
}
