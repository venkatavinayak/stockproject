from datetime import datetime
from typing import Optional
import re
from beanie import PydanticObjectId
from backend.app.models.product import Product
from backend.app.models.inventory_history import InventoryHistory
from backend.app.models.notification import Notification

async def log_inventory_change(
    product_id: PydanticObjectId,
    event: str,
    quantity_change: int,
    details: str,
    owner_username: Optional[str] = None
) -> InventoryHistory:
    # Fetch product to update and compute new stock
    product = await Product.get(product_id)
    if not product:
        raise ValueError("Product not found")
        
    resolved_owner = owner_username or getattr(product, "owner_username", "admin")
    previous_stock = product.current_stock
    new_stock = previous_stock + quantity_change
    if new_stock < 0:
        new_stock = 0
        
    # Update product stock and status
    product.current_stock = new_stock
    if new_stock <= 0:
        product.status = "Out of Stock"
    else:
        product.status = "Available"
    await product.save()
        
    # Add audit log
    history_entry = InventoryHistory(
        product_id=product_id,
        product_name=product.name,
        event=event,
        quantity_change=quantity_change,
        stock_after=new_stock,
        timestamp=datetime.utcnow(),
        details=details,
        owner_username=resolved_owner
    )
    await history_entry.insert()
    
    # Check for Low Stock / Out of Stock alerts
    name_regex = re.compile(re.escape(product.name), re.IGNORECASE)
    
    if new_stock == 0:
        existing = await Notification.find_one({
            "type": "Out of Stock",
            "message": name_regex,
            "is_read": False,
            "owner_username": resolved_owner
        })
        if not existing:
            notif = Notification(
                type="Out of Stock",
                message=f"Product '{product.name}' is out of stock!",
                timestamp=datetime.utcnow(),
                owner_username=resolved_owner
            )
            await notif.insert()
    elif new_stock <= product.minimum_stock:
        existing = await Notification.find_one({
            "type": "Low Stock",
            "message": name_regex,
            "is_read": False,
            "owner_username": resolved_owner
        })
        if not existing:
            notif = Notification(
                type="Low Stock",
                message=f"Product '{product.name}' is low on stock ({new_stock} remaining). Minimum limit is {product.minimum_stock}.",
                timestamp=datetime.utcnow(),
                owner_username=resolved_owner
            )
            await notif.insert()
            
    return history_entry
