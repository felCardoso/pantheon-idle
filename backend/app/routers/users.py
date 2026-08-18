from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.user import CurrentUser

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=CurrentUser)
def read_current_user(user_id: str = Depends(get_current_user)) -> CurrentUser:
    """Reference route proving the auth dependency chain works end to end — every other
    protected route follows this exact same `user_id: str = Depends(get_current_user)` shape."""
    return CurrentUser(user_id=user_id)
