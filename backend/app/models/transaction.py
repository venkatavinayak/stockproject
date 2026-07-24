from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class TransactionItem(BaseModel):
    product_id: Optional[PydanticObjectId] = None
    product_name: Optional[str] = None
    product_barcode: Optional[str] = None
    quantity: int
    unit_buying_price: float
    unit_selling_price: float
    gst_rate: float = 0.0  # e.g. 18.0
    discount_rate: float = 0.0  # e.g. 5.0
    subtotal: float  # Qty * unit_selling_price
    gst_amount: float = 0.0
    discount_amount: float = 0.0
    total_amount: float  # subtotal - discount_amount + gst_amount
    profit: float  # total_amount - (quantity * unit_buying_price)
    product: Optional[dict] = Field(default=None, exclude=True)

class Transaction(Document):
    invoice_number: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payment_method: str  # Cash, UPI, Card, Mixed
    items_count: int = 0
    subtotal: float = 0.0
    gst_amount: float = 0.0
    discount_amount: float = 0.0
    grand_total: float = 0.0
    buying_cost: float = 0.0
    profit: float = 0.0
    pdf_path: Optional[str] = None
    cashier_username: Optional[str] = None
    
    # Nested embedded list of items
    items: List[TransactionItem] = []
    
    # Customer Info
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    total_savings: float = 0.0

    class Settings:
        name = "transactions"
        indexes = [
            "invoice_number",
            "timestamp",
            "payment_method"
        ]
