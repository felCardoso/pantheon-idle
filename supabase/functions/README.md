# Supabase Edge Functions

## Deploy

Edge Functions are **not** deployed by the Vercel build — Vercel only ships the Next.js app. They
have to be pushed to the Supabase project separately, or the browser sees a 404 on the CORS
preflight and reports it as an opaque "CORS request did not succeed" (a 404 from the functions
gateway carries no CORS headers, so the browser can't show the real status).

```bash
supabase login
supabase link --project-ref <project-ref>
npm run deploy:functions
```

**Apply pending migrations before deploying.** `pvp-attack` calls
`resolve_pvp_attack`, whose signature changed in migration 0020; the deployed
function and the database schema have to move together.

`deploy:functions` regenerates `_shared/engine/` from `src/engine/` first (see
`scripts/sync-pvp-engine.mjs`), so a deploy can never ship a stale copy of the combat engine.

## Functions

| Function | Purpose |
| --- | --- |
| `pvp-attack` | Resolves one PvP attack server-side and applies the rating change. Must be deployed for the Atacar button to work at all. |

`_shared/` is not a function — it holds the CORS helper and the generated engine mirror that
`pvp-attack` imports.

## Why the engine is duplicated

Deno Edge Functions deploy as a self-contained tree and can't import from `src/` at deploy time, so
`_shared/engine/` is a generated copy. Never edit it by hand: change `src/engine/` and re-run
`npm run sync:pvp-engine`. `npm run lint` fails if the two drift apart.
