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
    limit: Optional[int] = 100,
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
        
    query = Transaction.find(filters).sort(-Transaction.timestamp)
    if limit:
        query = query.limit(limit)
    txs = await query.to_list()
    
    # Batch query all unique product IDs to optimize DB hits
    product_ids = set()
    for tx in txs:
        for item in tx.items:
            if item.product_id:
                product_ids.add(item.product_id)
                
    products_map = {}
    if product_ids:
        from backend.app.models.category import Category
        from backend.app.models.supplier import Supplier
        from backend.app.schemas.product import ProductResponse
        
        products = await Product.find({"_id": {"$in": list(product_ids)}}).to_list()
        
        # Batch query related categories and suppliers
        category_ids = {p.category_id for p in products if p.category_id}
        supplier_ids = {p.supplier_id for p in products if p.supplier_id}
        
        categories_map = {}
        if category_ids:
            categories = await Category.find({"_id": {"$in": list(category_ids)}}).to_list()
            categories_map = {c.id: c for c in categories}
            
        suppliers_map = {}
        if supplier_ids:
            suppliers = await Supplier.find({"_id": {"$in": list(supplier_ids)}}).to_list()
            suppliers_map = {s.id: s for s in suppliers}
            
        for p in products:
            products_map[p.id] = ProductResponse(
                id=p.id,
                barcode=p.barcode,
                name=p.name,
                brand=p.brand,
                category_id=p.category_id,
                supplier_id=p.supplier_id,
                buying_price=p.buying_price,
                selling_price=p.selling_price,
                gst=p.gst,
                discount=p.discount,
                current_stock=p.current_stock,
                minimum_stock=p.minimum_stock,
                expiry_date=p.expiry_date,
                manufacturing_date=p.manufacturing_date,
                batch_number=p.batch_number,
                status=p.status,
                image_path=p.image_path,
                category=categories_map.get(p.category_id),
                supplier=suppliers_map.get(p.supplier_id)
            )
            
    # Assign populated products to transactions in-memory
    for tx in txs:
        for item in tx.items:
            if item.product_id and item.product_id in products_map:
                item.product = products_map[item.product_id]
                
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

@router.get("/{transaction_id}/pdf")
async def get_transaction_pdf(
    transaction_id: PydanticObjectId,
    token: Optional[str] = None
):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing"
        )
        
    from jose import JWTError, jwt
    from backend.app.auth.security import SECRET_KEY, ALGORITHM
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    current_user = await User.find_one(User.username == username)
    if not current_user:
        raise HTTPException(status_code=401, detail="User not found")
        
    tx = await Transaction.get(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    # Check permissions
    if getattr(current_user, "role", "admin") != "admin" and tx.cashier_username != current_user.username:
        raise HTTPException(status_code=403, detail="Access denied to this transaction receipt")
        
    import os
    from fastapi.responses import FileResponse
    from backend.app.models.settings import StoreSettings
    from backend.app.reports.receipt import generate_thermal_receipt
    
    settings = await StoreSettings.find_one()
    if not settings:
        settings = StoreSettings()
        await settings.insert()
        
    if not tx.pdf_path or not os.path.exists(tx.pdf_path):
        try:
            tx.pdf_path = generate_thermal_receipt(tx, settings)
            await tx.save()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate PDF invoice: {str(e)}")
            
    # Ensure correct absolute path
    abs_path = os.path.abspath(tx.pdf_path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="PDF invoice file not found on disk")
        
    return FileResponse(
        path=abs_path,
        filename=os.path.basename(tx.pdf_path),
        media_type="application/pdf"
    )
