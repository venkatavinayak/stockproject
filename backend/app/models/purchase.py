from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Optional
from datetime import datetime, date

class Purchase(Document):
    supplier_id: Optional[PydanticObjectId] = None
    product_id: Optional[PydanticObjectId] = None
    invoice_number: str
    purchase_date: date
    quantity_purchased: int
    purchase_price: float  # Unit buying cost
    gst_rate: float = 0.0  # GST rate paid to supplier
    total_cost: float  # Total cost including GST
    status: str = "Received"  # Received, Pending
    created_at: datetime = Field(default_factory=datetime.utcnow)
    owner_username: str = "admin"

    class Settings:
        name = "purchases"
        indexes = [
            "invoice_number",
            "supplier_id",
            "product_id",
            "owner_username"
        ]
