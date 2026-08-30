from beanie import Document
from typing import Optional

class Supplier(Document):
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    owner_username: str = "admin"

    class Settings:
        name = "suppliers"
        indexes = [
            "name",
            "owner_username"
        ]
