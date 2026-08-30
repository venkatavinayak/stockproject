from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Optional
from datetime import datetime

class AIRecommendations(Document):
    type: str  # Stockout Warning, Order Recommendation, Dead Stock, Demand Spike, Sales Drop
    product_id: Optional[PydanticObjectId] = None
    suggestion: str
    confidence: float = 1.0  # Confidence level of forecast
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    product: Optional[dict] = Field(default=None, exclude=True)
    owner_username: str = "admin"

    class Settings:
        name = "ai_recommendations"
        indexes = [
            "type",
            "product_id",
            "owner_username"
        ]
