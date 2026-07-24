from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from beanie import PydanticObjectId

from backend.app.models.supplier import Supplier
from backend.app.schemas.supplier import SupplierCreate, SupplierResponse
from backend.app.auth.deps import get_current_user
from backend.app.models.user import User

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])

@router.get("", response_model=List[SupplierResponse])
async def get_suppliers(
    current_user: User = Depends(get_current_user)
):
    return await Supplier.find_all().to_list()

@router.post("", response_model=SupplierResponse)
async def create_supplier(
    supplier_in: SupplierCreate,
    current_user: User = Depends(get_current_user)
):
    supplier = Supplier(**supplier_in.model_dump())
    await supplier.insert()
    return supplier

@router.delete("/{supplier_id}")
async def delete_supplier(
    supplier_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    supplier = await Supplier.get(supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    await supplier.delete()
    return {"message": "Supplier deleted successfully"}
