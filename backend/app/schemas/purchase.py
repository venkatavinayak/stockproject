from pydantic import BaseModel
from typing import Optional
from datetime import date
from beanie import PydanticObjectId
from backend.app.schemas.product import ProductResponse
from backend.app.schemas.supplier import SupplierResponse

class PurchaseBase(BaseModel):
    supplier_id: PydanticObjectId
    product_id: PydanticObjectId
    invoice_number: str
    purchase_date: date
    quantity_purchased: int
    purchase_price: float  # Unit buying cost
    gst_rate: float = 0.0
    total_cost: float
    status: str = "Received"  # Received, Pending

class PurchaseCreate(PurchaseBase):
    pass

class PurchaseResponse(PurchaseBase):
    id: PydanticObjectId
    product: Optional[ProductResponse] = None
    supplier: Optional[SupplierResponse] = None

    class Config:
        from_attributes = True
