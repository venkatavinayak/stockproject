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
    quantity: int
    unit_buying_price: float
    unit_selling_price: float
    gst_rate: float
    discount_rate: float
    subtotal: float
    gst_amount: float
    discount_amount: float
    total_amount: float
    profit: float
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True

class TransactionResponse(BaseModel):
    id: PydanticObjectId
    invoice_number: str
    timestamp: datetime
    payment_method: str
    items_count: int
    subtotal: float
    gst_amount: float
    discount_amount: float
    grand_total: float
    buying_cost: float
    profit: float
    pdf_path: Optional[str] = None
    items: List[TransactionItemResponse]
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    total_savings: float = 0.0

    class Config:
        from_attributes = True
