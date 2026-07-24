from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime

class AuditLog(Document):
    username: str  # Who performed the action (e.g. admin)
    action: str  # LOGIN, CHECKOUT, REFUND, ADJUST_STOCK, BACKUP
    details: str  # Descriptive summary of parameters
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "audit_logs"
        indexes = [
            "action",
            "timestamp"
        ]
