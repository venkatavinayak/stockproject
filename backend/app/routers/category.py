from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from beanie import PydanticObjectId

from backend.app.models.category import Category
from backend.app.schemas.category import CategoryCreate, CategoryResponse
from backend.app.auth.deps import get_current_user
from backend.app.models.user import User

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("", response_model=List[CategoryResponse])
async def get_categories(
    current_user: User = Depends(get_current_user)
):
    return await Category.find(Category.owner_username == current_user.owner).to_list()

@router.post("", response_model=CategoryResponse)
async def create_category(
    category_in: CategoryCreate,
    current_user: User = Depends(get_current_user)
):
    existing = await Category.find_one(Category.name == category_in.name, Category.owner_username == current_user.owner)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists"
        )
    
    category = Category(
        name=category_in.name,
        description=category_in.description,
        owner_username=current_user.owner
    )
    await category.insert()
    return category

@router.delete("/{category_id}")
async def delete_category(
    category_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    category = await Category.find_one(Category.id == category_id, Category.owner_username == current_user.owner)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    await category.delete()
    return {"message": "Category deleted successfully"}
