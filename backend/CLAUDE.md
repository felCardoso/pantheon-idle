# Backend notes for Claude

Authoritative FastAPI service for Pantheon Idle. The frontend no longer writes
critical game data straight to Supabase — it calls this API with the player's
Supabase access token instead, and this backend writes with a service-role
Supabase client after validating that token itself.

## Layout

- `app/core/` — config (`config.py`) and auth (`security.py`). Cross-cutting stuff only.
- `app/routers/` — one file per resource/domain, thin: parse request, call a service, return.
- `app/services/` — the actual business logic (battle resolution, currency changes, etc).
- `app/models/` — Pydantic request/response schemas.

Every protected route depends on `get_current_user` from `app.core.security`
(`user_id: str = Depends(get_current_user)`) — never trust a user id the
client sends in a body/query param instead.

## Next steps

1. **`get_current_user` currently calls Supabase's Auth API on every request**
   (`supabase.auth.get_user(token)`) — correct, but a network round-trip per
   request. Once this is a hot path, switch to local verification: decode the
   JWT with `PyJWT` against the project's JWT secret (Supabase dashboard →
   Settings → API → JWT Secret), checking `exp`/`aud`/`iss` ourselves, no
   network call. Keep the Supabase-API path as a fallback only if we start
   needing to check `session.revoked`/instant sign-out.
2. **Port the first real write path.** Pick whichever frontend Supabase write
   is most critical/most abused (credits, XP, battle rewards are the obvious
   first target) and move it here: a router endpoint + a service function
   that does the write with the service-role client, then update the
   frontend hook to call this API instead of `supabase.from(...).update(...)`.
   Do this one write path at a time, not a big-bang migration.
3. **Add a test setup.** `pytest` + `httpx.AsyncClient`/`TestClient` against
   the FastAPI app, with a fixture that monkeypatches `get_current_user` to
   skip real Supabase calls in tests.
4. **Structured error responses.** Right now errors are FastAPI's default
   `{"detail": "..."}`. Once there's more than one router, standardize on a
   shared exception → JSON response shape so the frontend can rely on it.
5. **Deployment.** Decide where this runs (Railway/Fly/Render/etc.), wire
   `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`CORS_ALLOWED_ORIGINS` as real
   secrets there, and add the deployed URL to the frontend's own env config.
