from pydantic import BaseModel
from typing import Optional
from beanie import PydanticObjectId

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: PydanticObjectId

    class Config:
        from_attributes = True
