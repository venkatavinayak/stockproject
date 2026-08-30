from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Optional
from datetime import datetime

class AIPrediction(Document):
    product_id: PydanticObjectId
    predicted_sales: float
    actual_sales: Optional[float] = None
    accuracy: Optional[float] = None  # Percentage accuracy (e.g. 0.85 for 85%)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    owner_username: str = "admin"

    class Settings:
        name = "ai_predictions"
        indexes = [
            "product_id",
            "created_at",
            "owner_username"
        ]
