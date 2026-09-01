from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime

class User(Document):
    username: str
    hashed_password: str
    last_login: Optional[datetime] = None
    is_active: bool = True
    role: str = "admin"  # "admin" or "worker"

    # Granular rights toggles for workers
    can_manage_stock: bool = False
    can_view_expenses: bool = False
    can_view_analytics: bool = False

    # Profile details
    full_name: Optional[str] = None
    email: Optional[str] = None

    # Shop owner scoping & Clerk binding
    owner_username: Optional[str] = None
    clerk_user_id: Optional[str] = None
    hashed_pin: Optional[str] = None

    @property
    def owner(self) -> str:
        return self.owner_username or self.username

    class Settings:
        name = "users"
        indexes = [
            "username",
            "owner_username",
            "clerk_user_id"
        ]
