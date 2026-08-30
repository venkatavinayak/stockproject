from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from beanie import PydanticObjectId

from backend.app.models.purchase import Purchase
from backend.app.models.product import Product
from backend.app.models.supplier import Supplier
from backend.app.schemas.purchase import PurchaseCreate, PurchaseResponse
from backend.app.schemas.supplier import SupplierResponse
from backend.app.routers.product import populate_product_relations
from backend.app.auth.deps import get_current_user
from backend.app.models.user import User
from backend.app.services.inventory import log_inventory_change

router = APIRouter(prefix="/purchases", tags=["Purchase Management"])

async def populate_purchase_relations(p: Purchase, owner_username: str) -> PurchaseResponse:
    product = await Product.find_one(Product.id == p.product_id, Product.owner_username == owner_username)
    supplier = await Supplier.find_one(Supplier.id == p.supplier_id, Supplier.owner_username == owner_username)
    
    prod_resp = None
    if product:
        prod_resp = await populate_product_relations(product)
        
    sup_resp = None
    if supplier:
        sup_resp = SupplierResponse(
            id=supplier.id,
            name=supplier.name,
            contact_name=supplier.contact_name,
            phone=supplier.phone,
            email=supplier.email,
            address=supplier.address,
            gst_number=supplier.gst_number
        )
        
    return PurchaseResponse(
        id=p.id,
        supplier_id=p.supplier_id,
        product_id=p.product_id,
        invoice_number=p.invoice_number,
        purchase_date=p.purchase_date,
        quantity_purchased=p.quantity_purchased,
        purchase_price=p.purchase_price,
        gst_rate=p.gst_rate,
        total_cost=p.total_cost,
        status=p.status,
        product=prod_resp,
        supplier=sup_resp
    )

@router.get("", response_model=List[PurchaseResponse])
async def get_purchases(
    current_user: User = Depends(get_current_user)
):
    owner_username = current_user.owner
    purchases = await Purchase.find(Purchase.owner_username == owner_username).sort(-Purchase.purchase_date).to_list()
    resp = []
    for p in purchases:
        populated = await populate_purchase_relations(p, owner_username)
        resp.append(populated)
    return resp

@router.post("", response_model=PurchaseResponse)
async def create_purchase(
    purchase_in: PurchaseCreate,
    current_user: User = Depends(get_current_user)
):
    owner_username = current_user.owner
    product = await Product.find_one(Product.id == purchase_in.product_id, Product.owner_username == owner_username)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product ID {purchase_in.product_id} not found"
        )
        
    supplier = await Supplier.find_one(Supplier.id == purchase_in.supplier_id, Supplier.owner_username == owner_username)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier ID {purchase_in.supplier_id} not found"
        )
        
    purchase = Purchase(**purchase_in.model_dump(), owner_username=owner_username)
    await purchase.insert()
    
    # If received immediately, update product stock and log Purchased event
    if purchase.status == "Received":
        await log_inventory_change(
            product_id=purchase.product_id,
            event="Purchased",
            quantity_change=purchase.quantity_purchased,
            details=f"Restocked from Supplier Invoice {purchase.invoice_number}",
            owner_username=owner_username
        )
        
    return await populate_purchase_relations(purchase, owner_username)

@router.put("/{purchase_id}/status", response_model=PurchaseResponse)
async def update_purchase_status(
    purchase_id: PydanticObjectId,
    status_str: str,  # Received, Pending
    current_user: User = Depends(get_current_user)
):
    owner_username = current_user.owner
    purchase = await Purchase.find_one(Purchase.id == purchase_id, Purchase.owner_username == owner_username)
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase record not found")
        
    if purchase.status == status_str:
        return await populate_purchase_relations(purchase, owner_username)
        
    old_status = purchase.status
    purchase.status = status_str
    await purchase.save()
    
    # If transitioning to Received, update stock
    if old_status == "Pending" and status_str == "Received":
        await log_inventory_change(
            product_id=purchase.product_id,
            event="Purchased",
            quantity_change=purchase.quantity_purchased,
            details=f"Restocked from Supplier Invoice {purchase.invoice_number} (status updated)",
            owner_username=owner_username
        )
        
    return await populate_purchase_relations(purchase, owner_username)
