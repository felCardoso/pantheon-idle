from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven configuration, loaded from `backend/.env` (see .env.example)."""

    supabase_url: str
    # Service-role key — this backend is the sole writer of critical game data now, so it
    # talks to Supabase with elevated privileges (bypassing RLS) after validating the
    # caller's own JWT itself (see core/security.py's get_current_user).
    supabase_service_role_key: str
    # Comma-separated list of origins allowed to call this API (the Vite dev server by
    # default; add the deployed frontend's origin in production).
    cors_allowed_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
