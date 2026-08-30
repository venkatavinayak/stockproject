from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Optional
from datetime import datetime, date

class Product(Document):
    barcode: str
    name: str
    brand: Optional[str] = None
    category_id: Optional[PydanticObjectId] = None
    supplier_id: Optional[PydanticObjectId] = None
    buying_price: float = 0.0
    selling_price: float = 0.0
    gst: float = 0.0  # Percentage, e.g. 18.0
    discount: float = 0.0  # Percentage, e.g. 5.0
    current_stock: int = 0
    minimum_stock: int = 5
    expiry_date: Optional[date] = None
    manufacturing_date: Optional[date] = None
    batch_number: Optional[str] = None
    status: str = "Available"  # Available, Out of Stock
    image_path: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    owner_username: str = "admin"

    class Settings:
        name = "products"
        indexes = [
            "barcode",
            "name",
            "brand",
            "category_id",
            "owner_username"
        ]
