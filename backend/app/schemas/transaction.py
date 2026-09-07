from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from beanie import PydanticObjectId
from backend.app.schemas.product import ProductResponse

class TransactionItemCreate(BaseModel):
    product_id: PydanticObjectId
    quantity: int
    discount_rate: Optional[float] = 0.0  # Optional item level override
    gst_rate: Optional[float] = 0.0       # Optional item level override

class TransactionCreate(BaseModel):
    payment_method: str  # Cash, UPI, Card, Mixed
    items: List[TransactionItemCreate]
    discount_amount: Optional[float] = 0.0  # Manual invoice level discount
    coupon_code: Optional[str] = None
    cash_received: Optional[float] = 0.0
    change_given: Optional[float] = 0.0
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None

class TransactionItemResponse(BaseModel):
    product_id: Optional[PydanticObjectId] = None
    product_name: Optional[str] = None
    product_barcode: Optional[str] = None
    quantity: int = 1
    unit_buying_price: float = 0.0
    unit_selling_price: float = 0.0
    gst_rate: float = 0.0
    discount_rate: float = 0.0
    subtotal: float = 0.0
    gst_amount: float = 0.0
    discount_amount: float = 0.0
    total_amount: float = 0.0
    profit: float = 0.0
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True

class TransactionResponse(BaseModel):
    id: PydanticObjectId
    invoice_number: str
    timestamp: datetime
    payment_method: Optional[str] = "Cash"
    items_count: int = 0
    subtotal: float = 0.0
    gst_amount: float = 0.0
    discount_amount: float = 0.0
    grand_total: float = 0.0
    buying_cost: float = 0.0
    profit: float = 0.0
    pdf_path: Optional[str] = None
    items: List[TransactionItemResponse] = []
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    total_savings: float = 0.0
    cashier_username: Optional[str] = None
    owner_username: Optional[str] = None

    class Config:
        from_attributes = True
