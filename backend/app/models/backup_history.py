from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime

class BackupHistory(Document):
    filename: str
    backup_type: str  # Manual, Auto
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: str = "Success"  # Success, Failed

    class Settings:
        name = "backup_history"
        indexes = [
            "timestamp"
        ]
