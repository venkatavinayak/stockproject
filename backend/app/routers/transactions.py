from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
import re
from datetime import datetime, date
from beanie import PydanticObjectId

from backend.app.models.transaction import Transaction
from backend.app.models.returns import Return
from backend.app.models.product import Product
from backend.app.schemas.transaction import TransactionResponse
from backend.app.schemas.other import ReturnResponse
from backend.app.routers.product import populate_product_relations
from backend.app.auth.deps import get_current_user
from backend.app.models.user import User
from backend.app.services.inventory import log_inventory_change

router = APIRouter(prefix="/transactions", tags=["Sales History & Returns"])

@router.get("", response_model=List[TransactionResponse])
async def get_transactions(
    invoice_number: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    payment_method: Optional[str] = None,
    min_profit: Optional[float] = None,
    max_profit: Optional[float] = None,
    cashier_username: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    filters = {}
    if invoice_number:
        # Case-insensitive substring match
        filters["invoice_number"] = re.compile(re.escape(invoice_number), re.IGNORECASE)
    if start_date:
        filters["timestamp"] = {"$gte": datetime.combine(start_date, datetime.min.time())}
    if end_date:
        if "timestamp" not in filters:
            filters["timestamp"] = {}
        filters["timestamp"]["$lte"] = datetime.combine(end_date, datetime.max.time())
    if payment_method:
        filters["payment_method"] = payment_method
    if min_profit is not None:
        filters["profit"] = {"$gte": min_profit}
    if max_profit is not None:
        if "profit" not in filters:
            filters["profit"] = {}
        filters["profit"]["$lte"] = max_profit
    if getattr(current_user, "role", "admin") != "admin":
        filters["cashier_username"] = current_user.username
    elif cashier_username:
        filters["cashier_username"] = cashier_username
        
    import os
    from backend.app.models.settings import StoreSettings
    from backend.app.reports.receipt import generate_thermal_receipt
    
    settings = await StoreSettings.find_one()
    if not settings:
        settings = StoreSettings()
        await settings.insert()
        
    txs = await Transaction.find(filters).sort(-Transaction.timestamp).to_list()
    
    # Populate items products and check PDF paths
    for tx in txs:
        if not tx.pdf_path or not os.path.exists(tx.pdf_path):
            try:
                tx.pdf_path = generate_thermal_receipt(tx, settings)
                await tx.save()
            except Exception as e:
                print(f"Failed to auto-generate PDF for invoice {tx.invoice_number}: {e}")
                
        for item in tx.items:
            if item.product_id:
                p = await Product.get(item.product_id)
                if p:
                    item.product = await populate_product_relations(p)
                    
    return txs

@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    tx = await Transaction.get(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    import os
    if not tx.pdf_path or not os.path.exists(tx.pdf_path):
        try:
            from backend.app.models.settings import StoreSettings
            from backend.app.reports.receipt import generate_thermal_receipt
            settings = await StoreSettings.find_one()
            if not settings:
                settings = StoreSettings()
                await settings.insert()
            tx.pdf_path = generate_thermal_receipt(tx, settings)
            await tx.save()
        except Exception as e:
            print(f"Failed to auto-generate PDF for invoice {tx.invoice_number}: {e}")
            
    # Populate items products
    for item in tx.items:
        if item.product_id:
            p = await Product.get(item.product_id)
            if p:
                item.product = await populate_product_relations(p)
                
    return tx

@router.post("/{transaction_id}/refund/{product_id}", response_model=ReturnResponse)
async def refund_item(
    transaction_id: PydanticObjectId,
    product_id: PydanticObjectId,
    quantity: int,
    reason: str,
    current_user: User = Depends(get_current_user)
):
    # Fetch invoice
    tx = await Transaction.get(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction invoice not found")
        
    # Find matching line item
    target_idx = -1
    for idx, item in enumerate(tx.items):
        if item.product_id == product_id:
            target_idx = idx
            break
            
    if target_idx == -1:
        raise HTTPException(status_code=404, detail="Product not found in this transaction")
        
    target_item = tx.items[target_idx]
    
    # Check returned quantity does not exceed original quantity
    already_returned = await Return.find(
        Return.transaction_id == transaction_id,
        Return.product_id == product_id
    ).to_list()
    total_returned = sum(r.quantity for r in already_returned)
    
    if total_returned + quantity > target_item.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot refund {quantity} items. Already returned: {total_returned}, Original: {target_item.quantity}"
        )
        
    # Calculate proportional refund values
    unit_subtotal = target_item.subtotal / target_item.quantity
    unit_gst = target_item.gst_amount / target_item.quantity
    unit_discount = target_item.discount_amount / target_item.quantity
    unit_total = target_item.total_amount / target_item.quantity
    unit_profit = target_item.profit / target_item.quantity
    
    deduct_subtotal = quantity * unit_subtotal
    deduct_gst = quantity * unit_gst
    deduct_discount = quantity * unit_discount
    deduct_total = quantity * unit_total
    deduct_profit = quantity * unit_profit
    deduct_buying_cost = quantity * target_item.unit_buying_price
    
    # Save return record
    ret = Return(
        transaction_id=transaction_id,
        product_id=product_id,
        quantity=quantity,
        refund_amount=deduct_total,
        reason=reason
    )
    await ret.insert()
    
    # Update item values
    target_item.quantity -= quantity
    target_item.subtotal -= deduct_subtotal
    target_item.gst_amount -= deduct_gst
    target_item.discount_amount -= deduct_discount
    target_item.total_amount -= deduct_total
    target_item.profit -= deduct_profit
    
    # Update transaction level values
    tx.items_count -= quantity
    tx.subtotal -= deduct_subtotal
    tx.gst_amount -= deduct_gst
    tx.discount_amount -= deduct_discount
    tx.grand_total -= deduct_total
    tx.buying_cost -= deduct_buying_cost
    tx.profit -= deduct_profit
    tx.total_savings -= deduct_discount
    
    # Remove item if quantity is 0
    if target_item.quantity <= 0:
        tx.items.pop(target_idx)
        
    # Save updated transaction
    await tx.save()
    
    # Regenerate receipt PDF on disk
    try:
        from backend.app.models.settings import StoreSettings
        from backend.app.reports.receipt import generate_thermal_receipt
        settings = await StoreSettings.find_one()
        if not settings:
            settings = StoreSettings()
            await settings.insert()
            
        new_pdf_path = generate_thermal_receipt(tx, settings)
        tx.pdf_path = new_pdf_path
        await tx.save()
    except Exception as e:
        print(f"Failed to regenerate PDF on refund: {e}")
        
    # Restock product and log 'Returned' event
    await log_inventory_change(
        product_id=product_id,
        event="Returned",
        quantity_change=quantity,
        details=f"Returned {quantity} units from Invoice {tx.invoice_number} (Reason: {reason})"
    )
    
    # Populate product details for response schema
    prod_obj = await Product.get(product_id)
    if prod_obj:
        ret.product = await populate_product_relations(prod_obj)
        
    return ret

@router.get("/returns/list", response_model=List[ReturnResponse])
async def list_returns(
    current_user: User = Depends(get_current_user)
):
    if getattr(current_user, "role", "admin") != "admin":
        txs = await Transaction.find(Transaction.cashier_username == current_user.username).to_list()
        tx_ids = [str(tx.id) for tx in txs]
        returns_list = await Return.find({"transaction_id": {"$in": tx_ids}}).sort(-Return.timestamp).to_list()
    else:
        returns_list = await Return.find_all().sort(-Return.timestamp).to_list()
        
    for r in returns_list:
        if r.product_id:
            p = await Product.get(r.product_id)
            if p:
                r.product = await populate_product_relations(p)
    return returns_list

@router.get("/my-summary")
async def get_my_summary(current_user: User = Depends(get_current_user)):
    today = date.today()
    start_date = datetime.combine(today, datetime.min.time())
    end_date = datetime.combine(today, datetime.max.time())
    
    # Query transactions processed by this user today
    txs = await Transaction.find(
        Transaction.cashier_username == current_user.username,
        Transaction.timestamp >= start_date,
        Transaction.timestamp <= end_date
    ).to_list()
    
    total_sales = sum(tx.grand_total for tx in txs)
    total_items = sum(tx.items_count for tx in txs)
    invoice_count = len(txs)
    
    return {
        "total_sales": total_sales,
        "invoice_count": invoice_count,
        "total_items": total_items
    }
