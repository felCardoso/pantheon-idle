from pydantic import BaseModel


class CurrentUser(BaseModel):
    """What a protected route gets back once get_current_user has validated the caller."""

    user_id: str
