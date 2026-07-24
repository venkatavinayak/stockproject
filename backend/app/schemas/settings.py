from pydantic import BaseModel
from typing import Optional
from beanie import PydanticObjectId

class StoreSettingsBase(BaseModel):
    store_name: str
    logo_path: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
    contact_info: Optional[str] = None
    currency_symbol: str = "₹"
    receipt_format: str = "Thermal"  # Thermal, Standard
    invoice_footer: str = "Thank you for shopping with us!"
    email_enable: bool = False
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_sender: Optional[str] = None

class StoreSettingsUpdate(BaseModel):
    store_name: Optional[str] = None
    logo_path: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
    contact_info: Optional[str] = None
    currency_symbol: Optional[str] = None
    receipt_format: Optional[str] = None
    invoice_footer: Optional[str] = None
    email_enable: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_sender: Optional[str] = None

class StoreSettingsResponse(StoreSettingsBase):
    id: PydanticObjectId

    class Config:
        from_attributes = True
