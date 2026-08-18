import { NextResponse } from 'next/server';
import { getUserFromRequest, UnauthorizedError } from '../../../../lib/auth-helpers';

/** Reference route proving the auth dependency chain works end to end — every other
 * authoritative route follows this exact same getUserFromRequest(req) shape. */
export async function GET(req: Request) {
  try {
    const userId = await getUserFromRequest(req);
    return NextResponse.json({ userId });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}
