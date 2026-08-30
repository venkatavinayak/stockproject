from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Optional
from datetime import datetime

class InventoryHistory(Document):
    product_id: PydanticObjectId
    product_name: Optional[str] = None  # Denormalize product name for easy history reading
    event: str  # Created, Purchased, Sold, Returned, Adjusted, Expired, Deleted
    quantity_change: int  # e.g., -5, +10
    stock_after: int  # stock count after change
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    details: Optional[str] = None  # e.g., "Sold via Invoice INV-..."
    owner_username: str = "admin"

    class Settings:
        name = "inventory_history"
        indexes = [
            "product_id",
            "event",
            "timestamp",
            "owner_username"
        ]
