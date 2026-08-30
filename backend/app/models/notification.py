from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime

class Notification(Document):
    type: str  # Low Stock, Out of Stock, Expiring, Backup, System
    message: str
    is_read: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    owner_username: str = "admin"

    class Settings:
        name = "notifications"
        indexes = [
            "is_read",
            "timestamp",
            "owner_username"
        ]
