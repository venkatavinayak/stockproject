from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime, date

class Expense(Document):
    category: str  # Rent, Electricity, Internet, Maintenance, Miscellaneous
    amount: float
    date: date
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "expenses"
        indexes = [
            "category",
            "date"
        ]
