from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Optional
from datetime import datetime

class Return(Document):
    transaction_id: PydanticObjectId
    product_id: Optional[PydanticObjectId] = None
    quantity: int
    refund_amount: float
    reason: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    product: Optional[dict] = Field(default=None, exclude=True)

    class Settings:
        name = "returns"
        indexes = [
            "transaction_id",
            "product_id"
        ]
