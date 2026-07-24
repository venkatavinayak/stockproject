from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from beanie import PydanticObjectId
from backend.app.schemas.product import ProductResponse

class ReturnCreate(BaseModel):
    transaction_id: PydanticObjectId
    product_id: PydanticObjectId
    quantity: int
    refund_amount: float
    reason: str

class ReturnResponse(ReturnCreate):
    id: PydanticObjectId
    timestamp: datetime
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    id: PydanticObjectId
    type: str
    message: str
    is_read: bool
    timestamp: datetime

    class Config:
        from_attributes = True

class TopProductItemSchema(BaseModel):
    product_id: PydanticObjectId
    product_name: str
    quantity: int

class DailySummaryResponse(BaseModel):
    id: PydanticObjectId
    date: date
    opening_stock_value: float
    purchased_stock_value: float
    sold_stock_value: float
    returned_stock_value: float
    closing_stock_value: float
    revenue: float
    profit: float
    expenses: float
    net_profit: float
    cash_sales: float
    upi_sales: float
    card_sales: float
    bills_count: int
    top_products: List[TopProductItemSchema] = []

    class Config:
        from_attributes = True

class InventoryHistoryResponse(BaseModel):
    id: PydanticObjectId
    product_id: PydanticObjectId
    product_name: Optional[str] = None
    event: str
    quantity_change: int
    stock_after: int
    timestamp: datetime
    details: Optional[str] = None
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True

class BackupHistoryResponse(BaseModel):
    id: PydanticObjectId
    filename: str
    backup_type: str
    timestamp: datetime
    status: str

    class Config:
        from_attributes = True

class AIRecommendationResponse(BaseModel):
    id: PydanticObjectId
    type: str
    product_id: Optional[PydanticObjectId] = None
    suggestion: str
    confidence: float
    timestamp: datetime
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True

class StockAdjustmentCreate(BaseModel):
    product_id: PydanticObjectId
    quantity_change: int
    reason: str

class DashboardKPIs(BaseModel):
    today_revenue: float
    today_profit: float
    today_expenses: float
    net_profit: float
    inventory_value: float
    potential_profit: float
    current_stock_value: float
    bills_today: int
    items_sold: int
    average_bill: float
    average_profit: float
    best_seller: Optional[str] = None
    fast_moving: Optional[str] = None
    slow_moving: Optional[str] = None
    dead_stock_count: int

class ActivityLogItem(BaseModel):
    time: str
    type: str
    description: str
    amount: Optional[float] = None
