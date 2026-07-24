from pydantic import BaseModel
from typing import Optional
from datetime import date
from beanie import PydanticObjectId
from backend.app.schemas.category import CategoryResponse
from backend.app.schemas.supplier import SupplierResponse

class ProductBase(BaseModel):
    barcode: str
    name: str
    brand: Optional[str] = None
    category_id: Optional[PydanticObjectId] = None
    supplier_id: Optional[PydanticObjectId] = None
    buying_price: float = 0.0
    selling_price: float = 0.0
    gst: float = 0.0  # e.g., 18.0
    discount: float = 0.0  # e.g., 5.0
    current_stock: int = 0
    minimum_stock: int = 5
    expiry_date: Optional[date] = None
    manufacturing_date: Optional[date] = None
    batch_number: Optional[str] = None
    status: str = "Available"
    image_path: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    barcode: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    category_id: Optional[PydanticObjectId] = None
    supplier_id: Optional[PydanticObjectId] = None
    buying_price: Optional[float] = None
    selling_price: Optional[float] = None
    gst: Optional[float] = None
    discount: Optional[float] = None
    current_stock: Optional[int] = None
    minimum_stock: Optional[int] = None
    expiry_date: Optional[date] = None
    manufacturing_date: Optional[date] = None
    batch_number: Optional[str] = None
    status: Optional[str] = None
    image_path: Optional[str] = None

class ProductResponse(ProductBase):
    id: PydanticObjectId
    category: Optional[CategoryResponse] = None
    supplier: Optional[SupplierResponse] = None

    class Config:
        from_attributes = True
