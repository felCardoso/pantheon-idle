from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    """Unauthenticated liveness check — for load balancers/uptime monitors, not for the frontend."""
    return {"status": "ok"}
