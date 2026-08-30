from beanie import Document
from typing import Optional

class Category(Document):
    name: str
    description: Optional[str] = None
    owner_username: str = "admin"

    class Settings:
        name = "categories"
        indexes = [
            "name",
            "owner_username"
        ]
