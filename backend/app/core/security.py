from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from app.core.config import get_settings

# auto_error=True: FastAPI itself returns 401 when the Authorization header is missing
# or not a "Bearer <token>" — no route using get_current_user needs to check for that.
_bearer_scheme = HTTPBearer(auto_error=True)


@lru_cache
def get_supabase_client() -> Client:
    """Service-role Supabase client, shared across the app (auth verification here,
    privileged reads/writes in services/ once those land)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    supabase: Client = Depends(get_supabase_client),
) -> str:
    """Validates the bearer token against Supabase Auth and returns the caller's user id.

    Every protected route should depend on this rather than trusting anything the
    client sends about who it is — the id returned here is the only one any route
    handler or service should treat as authoritative.
    """
    token = credentials.credentials
    try:
        auth_response = supabase.auth.get_user(token)
    except Exception as exc:
        # supabase-py raises on an invalid/expired/malformed token — treat all of it as
        # "not authenticated" rather than leaking the underlying error to the client.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = auth_response.user if auth_response else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user.id
