from pydantic import BaseModel
from typing import Optional
from beanie import PydanticObjectId

class SupplierBase(BaseModel):
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierResponse(SupplierBase):
    id: PydanticObjectId

    class Config:
        from_attributes = True
