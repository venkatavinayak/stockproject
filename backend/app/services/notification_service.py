import re
from datetime import datetime, date, timedelta
from backend.app.models.product import Product
from backend.app.models.notification import Notification

async def run_low_stock_expiry_checks():
    try:
        today = date.today()
        # 1. Check Low Stock Items
        low_stock_products = await Product.find(Product.current_stock <= Product.minimum_stock).to_list()
        
        for p in low_stock_products:
            notif_type = "Out of Stock" if p.current_stock == 0 else "Low Stock"
            msg = f"Product '{p.name}' is out of stock!" if p.current_stock == 0 else f"Product '{p.name}' is low on stock ({p.current_stock} remaining)."
            
            # Avoid duplicate unread alerts
            name_regex = re.compile(re.escape(p.name), re.IGNORECASE)
            existing = await Notification.find_one({
                "type": notif_type,
                "message": name_regex,
                "is_read": False
            })
            
            if not existing:
                await Notification(
                    type=notif_type,
                    message=msg,
                    timestamp=datetime.utcnow()
                ).insert()
                
        # 2. Check Expiry
        seven_days_later = today + timedelta(days=7)
        expiring_products = await Product.find(
            Product.expiry_date != None,
            Product.expiry_date <= seven_days_later,
            Product.current_stock > 0
        ).to_list()
        
        for p in expiring_products:
            days_left = (p.expiry_date - today).days
            if days_left <= 0:
                msg = f"Product '{p.name}' (Batch: {p.batch_number or 'N/A'}) has EXPIRED on {p.expiry_date}!"
                notif_type = "Expiring"
            else:
                msg = f"Product '{p.name}' (Batch: {p.batch_number or 'N/A'}) is expiring soon in {days_left} days!"
                notif_type = "Expiring"
                
            name_regex = re.compile(re.escape(p.name), re.IGNORECASE)
            existing = await Notification.find_one({
                "type": notif_type,
                "message": name_regex,
                "is_read": False
            })
            
            if not existing:
                await Notification(
                    type=notif_type,
                    message=msg,
                    timestamp=datetime.utcnow()
                ).insert()
                
    except Exception as e:
        print("Scheduler checks failed:", str(e))
