from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date

class TopProductItem(BaseModel):
    product_id: PydanticObjectId
    product_name: str
    quantity: int

class DailySummary(Document):
    date: date
    opening_stock_value: float = 0.0
    purchased_stock_value: float = 0.0
    sold_stock_value: float = 0.0
    returned_stock_value: float = 0.0
    closing_stock_value: float = 0.0
    revenue: float = 0.0
    profit: float = 0.0
    expenses: float = 0.0
    net_profit: float = 0.0
    cash_sales: float = 0.0
    upi_sales: float = 0.0
    card_sales: float = 0.0
    bills_count: int = 0
    top_products: List[TopProductItem] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    owner_username: str = "admin"

    class Settings:
        name = "daily_summaries"
        indexes = [
            "date",
            "owner_username"
        ]
