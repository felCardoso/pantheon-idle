import 'server-only';
import { NextResponse } from 'next/server';
import { getUserFromRequest, UnauthorizedError } from './auth-helpers';

/**
 * Wraps an app/api/** route handler: resolves the caller's user id via
 * getUserFromRequest (401 on a missing/invalid token), then runs `handler`, converting
 * any thrown Error into a 500 JSON response so individual routes don't need their own
 * try/catch boilerplate for that. A handler that wants a specific status code (400 for a
 * bad request, 404 for a missing row, etc.) should still return its own NextResponse
 * directly instead of throwing.
 */
export async function withUser(req: Request, handler: (userId: string) => Promise<Response>): Promise<Response> {
  let userId: string;
  try {
    userId = await getUserFromRequest(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  try {
    return await handler(userId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}

/** Parses the request body as JSON, defaulting to `{}` if empty/invalid — the same
 * lenient shape every route's body-parsing already used. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
