import re
from datetime import datetime, date, timedelta
from backend.app.models.product import Product
from backend.app.models.notification import Notification

async def run_low_stock_expiry_checks(owner_username: str = None):
    if owner_username is None:
        from backend.app.models.user import User
        try:
            admins = await User.find(User.role == "admin").to_list()
            for admin in admins:
                await run_low_stock_expiry_checks(owner_username=admin.username)
        except Exception as e:
            print("Failed to loop admins for stock checks:", str(e))
        return

    try:
        today = date.today()
        # 1. Check Low Stock Items scoped to owner
        low_stock_products = await Product.find(Product.current_stock <= Product.minimum_stock, Product.owner_username == owner_username).to_list()
        
        for p in low_stock_products:
            notif_type = "Out of Stock" if p.current_stock == 0 else "Low Stock"
            msg = f"Product '{p.name}' is out of stock!" if p.current_stock == 0 else f"Product '{p.name}' is low on stock ({p.current_stock} remaining)."
            
            # Avoid duplicate unread alerts for this owner
            name_regex = re.compile(re.escape(p.name), re.IGNORECASE)
            existing = await Notification.find_one({
                "type": notif_type,
                "message": name_regex,
                "is_read": False,
                "owner_username": owner_username
            })
            
            if not existing:
                await Notification(
                    type=notif_type,
                    message=msg,
                    timestamp=datetime.utcnow(),
                    owner_username=owner_username
                ).insert()
                
        # 2. Check Expiry scoped to owner
        seven_days_later = today + timedelta(days=7)
        expiring_products = await Product.find(
            Product.expiry_date != None,
            Product.expiry_date <= seven_days_later,
            Product.current_stock > 0,
            Product.owner_username == owner_username
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
                "is_read": False,
                "owner_username": owner_username
            })
            
            if not existing:
                await Notification(
                    type=notif_type,
                    message=msg,
                    timestamp=datetime.utcnow(),
                    owner_username=owner_username
                ).insert()
                
    except Exception as e:
        print(f"Scheduler checks failed for owner={owner_username}:", str(e))
