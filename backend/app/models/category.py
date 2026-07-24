from beanie import Document
from typing import Optional

class Category(Document):
    name: str
    description: Optional[str] = None

    class Settings:
        name = "categories"
        indexes = [
            "name"
        ]
