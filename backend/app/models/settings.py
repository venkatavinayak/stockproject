from beanie import Document
from typing import Optional

class StoreSettings(Document):
    store_name: str = "Smart Store Ai Store"
    logo_path: Optional[str] = None  # Uploaded store logo path
    gst_number: Optional[str] = None
    address: Optional[str] = None
    contact_info: Optional[str] = None
    currency_symbol: str = "₹"
    receipt_format: str = "Thermal"  # Thermal, Standard
    invoice_footer: str = "Thank you for shopping with us!"

    # SMTP Email Configuration
    email_enable: bool = True
    smtp_host: Optional[str] = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_user: Optional[str] = "mysmartstoreai@gmail.com"
    smtp_password: Optional[str] = "fbdzlzrxxqttbhdc"
    smtp_sender: Optional[str] = "mysmartstoreai@gmail.com"
    
    owner_username: str = "admin"
    shop_code: Optional[str] = None

    class Settings:
        name = "store_settings"
        indexes = [
            "owner_username",
            "shop_code"
        ]
