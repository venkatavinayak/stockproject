from pydantic import BaseModel
from typing import Optional
from datetime import date
from beanie import PydanticObjectId

class ExpenseBase(BaseModel):
    category: str  # Rent, Electricity, Internet, Maintenance, Miscellaneous
    amount: float
    date: date
    description: Optional[str] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseResponse(ExpenseBase):
    id: PydanticObjectId

    class Config:
        from_attributes = True
