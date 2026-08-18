# Pantheon Idle API

Authoritative FastAPI backend for critical game writes — the frontend no longer writes
directly to Supabase for anything this API covers; it calls this service with the
player's Supabase access token instead.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Docs at `http://localhost:8000/docs`.

## Auth

Every protected route depends on `app.core.security.get_current_user`, which expects
`Authorization: Bearer <supabase-access-token>` and validates it against Supabase Auth.
`GET /users/me` is the reference implementation.
