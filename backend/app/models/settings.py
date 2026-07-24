from beanie import Document
from typing import Optional

class StoreSettings(Document):
    store_name: str = "SmartStock AI Store"
    logo_path: Optional[str] = None  # Uploaded store logo path
    gst_number: Optional[str] = None
    address: Optional[str] = None
    contact_info: Optional[str] = None
    currency_symbol: str = "₹"
    receipt_format: str = "Thermal"  # Thermal, Standard
    invoice_footer: str = "Thank you for shopping with us!"

    # SMTP Email Configuration
    email_enable: bool = False
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_sender: Optional[str] = None

    class Settings:
        name = "store_settings"
