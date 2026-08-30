from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime

class Customer(Document):
    name: str
    phone: str  # Primary index search key
    email: Optional[str] = None
    loyalty_points: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    owner_username: str = "admin"

    class Settings:
        name = "customers"
        indexes = [
            "phone",
            "name",
            "owner_username"
        ]
