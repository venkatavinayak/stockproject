from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import date
from beanie import PydanticObjectId

from backend.app.models.expense import Expense
from backend.app.schemas.expense import ExpenseCreate, ExpenseResponse
from backend.app.auth.deps import get_current_expenses_manager
from backend.app.models.user import User

router = APIRouter(prefix="/expenses", tags=["Expense Management"])

@router.get("", response_model=List[ExpenseResponse])
async def get_expenses(
    category: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_expenses_manager)
):
    filters = {"owner_username": current_user.owner}
    if category:
        filters["category"] = category
        
    if start_date or end_date:
        filters["date"] = {}
        if start_date:
            filters["date"]["$gte"] = start_date
        if end_date:
            filters["date"]["$lte"] = end_date
            
    return await Expense.find(filters).sort(-Expense.date).to_list()

@router.post("", response_model=ExpenseResponse)
async def create_expense(
    expense_in: ExpenseCreate,
    current_user: User = Depends(get_current_expenses_manager)
):
    expense = Expense(**expense_in.model_dump(), owner_username=current_user.owner)
    await expense.insert()
    return expense

@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: PydanticObjectId,
    current_user: User = Depends(get_current_expenses_manager)
):
    expense = await Expense.find_one(Expense.id == expense_id, Expense.owner_username == current_user.owner)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense record not found"
        )
    await expense.delete()
    return {"message": "Expense deleted successfully"}
