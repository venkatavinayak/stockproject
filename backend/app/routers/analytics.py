from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from beanie import PydanticObjectId

from backend.app.models.product import Product
from backend.app.models.transaction import Transaction
from backend.app.models.expense import Expense
from backend.app.models.inventory_history import InventoryHistory
from backend.app.models.backup_history import BackupHistory
from backend.app.models.category import Category
from backend.app.schemas.other import DashboardKPIs, ActivityLogItem
from backend.app.auth.deps import get_current_analytics_viewer
from backend.app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Advanced Analytics"])

async def get_top_products_qty(days: int, owner_username: str, limit: int = 1, reverse: bool = False):
    cutoff = datetime.utcnow() - timedelta(days=days)
    pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff}, "owner_username": owner_username}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_name", "total_qty": {"$sum": "$items.quantity"}}},
        {"$sort": {"total_qty": 1 if reverse else -1}},
        {"$limit": limit}
    ]
    res = await Transaction.get_pymongo_collection().aggregate(pipeline).to_list(length=None)
    return res

async def get_top_products_qty_sorted(days: int, owner_username: str):
    cutoff = datetime.utcnow() - timedelta(days=days)
    pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff}, "owner_username": owner_username}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_name", "total_qty": {"$sum": "$items.quantity"}}},
        {"$sort": {"total_qty": -1}}
    ]
    res = await Transaction.get_pymongo_collection().aggregate(pipeline).to_list(length=None)
    return res

@router.get("/dashboard/kpis", response_model=DashboardKPIs)
async def get_dashboard_kpis(
    period: str = "today",  # today, week, month, all, custom
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_analytics_viewer)
):
    today = date.today()
    
    if start_date and end_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())
    else:
        end_dt = datetime.combine(today, datetime.max.time())
        if period == "week":
            start_dt = datetime.combine(today - timedelta(days=6), datetime.min.time())
        elif period == "month":
            start_dt = datetime.combine(today - timedelta(days=29), datetime.min.time())
        elif period == "all":
            start_dt = datetime(2000, 1, 1)
        else:  # today
            start_dt = datetime.combine(today, datetime.min.time())
        
    owner_username = current_user.owner
    # 1. Sales and Profit in range
    txs = await Transaction.find(
        Transaction.timestamp >= start_dt,
        Transaction.timestamp <= end_dt,
        Transaction.owner_username == owner_username
    ).to_list()
    
    revenue = sum(tx.grand_total for tx in txs)
    profit = sum(tx.profit for tx in txs)
    bills = len(txs)
    
    # 2. Items sold in range
    items_sold_pipeline = [
        {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}, "owner_username": owner_username}},
        {"$unwind": "$items"},
        {"$group": {"_id": None, "total_qty": {"$sum": "$items.quantity"}}}
    ]
    items_sold_res = await Transaction.get_pymongo_collection().aggregate(items_sold_pipeline).to_list(length=None)
    items_sold = items_sold_res[0].get("total_qty", 0) if items_sold_res else 0
    
    # 3. Expenses in range
    if period == "all" and not (start_date and end_date):
        exps = await Expense.find(Expense.owner_username == owner_username).to_list()
    else:
        exps = await Expense.find(
            Expense.date >= start_dt.date(),
            Expense.date <= end_dt.date(),
            Expense.owner_username == owner_username
        ).to_list()
    expenses = sum(e.amount for e in exps)
    
    # 4. Inventory Values using Aggregation
    inv_val_pipeline = [
        {"$match": {"owner_username": owner_username}},
        {
            "$group": {
                "_id": None,
                "buying_val": {"$sum": {"$multiply": ["$current_stock", "$buying_price"]}},
                "selling_val": {"$sum": {"$multiply": ["$current_stock", "$selling_price"]}}
            }
        }
    ]
    inv_stats = await Product.get_pymongo_collection().aggregate(inv_val_pipeline).to_list(length=None)
    if inv_stats:
        current_stock_value = float(inv_stats[0].get("buying_val", 0.0))
        inventory_value = float(inv_stats[0].get("selling_val", 0.0))
    else:
        current_stock_value = 0.0
        inventory_value = 0.0
        
    potential_profit = inventory_value - current_stock_value
    
    # 5. Averages
    average_bill = revenue / bills if bills > 0 else 0.0
    average_profit = profit / bills if bills > 0 else 0.0
    
    # 6. Top product counts based on period
    days_range = 1 if period == "today" else 7 if period == "week" else 30 if period == "month" else 365
    
    prod_sales = await get_top_products_qty_sorted(days_range, owner_username)
    best_seller = prod_sales[0]["_id"] if prod_sales else "N/A"
    slow_moving = prod_sales[-1]["_id"] if prod_sales and len(prod_sales) > 1 else "N/A"
    
    if period == "today" or period == "week":
        fast_moving = best_seller
    else:
        fast_sales = await get_top_products_qty_sorted(7, owner_username)
        fast_moving = fast_sales[0]["_id"] if fast_sales else "N/A"
        
    # 9. Dead Stock Count
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    sold_pipeline = [
        {"$match": {"timestamp": {"$gte": thirty_days_ago}, "owner_username": owner_username}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id"}}
    ]
    sold_res = await Transaction.get_pymongo_collection().aggregate(sold_pipeline).to_list(length=None)
    sold_ids = [r["_id"] for r in sold_res if r["_id"] is not None]
    
    dead_stock_count = await Product.find({
        "current_stock": {"$gt": 0},
        "owner_username": owner_username,
        "_id": {"$nin": sold_ids}
    }).count()
    
    return DashboardKPIs(
        today_revenue=revenue,
        today_profit=profit,
        today_expenses=expenses,
        net_profit=profit - expenses,
        inventory_value=inventory_value,
        potential_profit=potential_profit,
        current_stock_value=current_stock_value,
        bills_today=bills,
        items_sold=items_sold,
        average_bill=average_bill,
        average_profit=average_profit,
        best_seller=best_seller,
        fast_moving=fast_moving,
        slow_moving=slow_moving,
        dead_stock_count=dead_stock_count
    )
 
@router.get("/dashboard/recent-activity", response_model=List[ActivityLogItem])
async def get_recent_activity(
    current_user: User = Depends(get_current_analytics_viewer)
):
    recent_txs = await Transaction.find(Transaction.owner_username == current_user.owner).sort(-Transaction.timestamp).limit(5).to_list()
    recent_inv = await InventoryHistory.find(InventoryHistory.event != "Created", InventoryHistory.owner_username == current_user.owner).sort(-InventoryHistory.timestamp).limit(5).to_list()
    recent_exp = await Expense.find(Expense.owner_username == current_user.owner).sort(-Expense.date).limit(5).to_list()
    recent_bk = await BackupHistory.find(BackupHistory.owner_username == current_user.owner).sort(-BackupHistory.timestamp).limit(3).to_list() if hasattr(BackupHistory, "owner_username") else await BackupHistory.find_all().sort(-BackupHistory.timestamp).limit(3).to_list()
    
    sortable_items = []
    
    for tx in recent_txs:
        sortable_items.append((tx.timestamp, "invoice", f"Invoice #{tx.invoice_number} generated ({tx.items_count} items)", tx.grand_total))
    for inv in recent_inv:
        action_verb = {"Sold": "Sold", "Purchased": "Restocked", "Returned": "Returned", "Adjusted": "Adjusted", "Expired": "Expired"}.get(inv.event, "Updated")
        sortable_items.append((inv.timestamp, "stock", f"{inv.product_name or 'Product'} {action_verb} (Qty: {inv.quantity_change:+} | stock: {inv.stock_after})", None))
    for exp in recent_exp:
        exp_dt = datetime.combine(exp.date, datetime.min.time())
        sortable_items.append((exp_dt, "expense", f"Expense added: {exp.category} ({exp.description or ''})", exp.amount))
    for bk in recent_bk:
        sortable_items.append((bk.timestamp, "backup", f"Database backup completed ({bk.filename})", None))
        
    sortable_items.sort(key=lambda x: x[0], reverse=True)
    
    result = []
    for dt, item_type, desc, amt in sortable_items[:10]:
        if dt.date() == date.today():
            time_str = dt.strftime("%H:%M")
        else:
            time_str = dt.strftime("%d %b")
        result.append(ActivityLogItem(
            time=time_str,
            type=item_type,
            description=desc,
            amount=amt
        ))
        
    return result

@router.get("/sales/trends")
async def get_sales_trends(
    period: str = "month",  # week, month, year
    current_user: User = Depends(get_current_analytics_viewer)
):
    trends = []
    owner_username = current_user.owner
    
    if period == "week" or period == "month":
        num_days = 7 if period == "week" else 30
        cutoff = datetime.combine(date.today() - timedelta(days=num_days - 1), datetime.min.time())
        
        pipeline = [
            {"$match": {"timestamp": {"$gte": cutoff}, "owner_username": owner_username}},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}
                    },
                    "revenue": {"$sum": "$grand_total"},
                    "profit": {"$sum": "$profit"}
                }
            }
        ]
        res = await Transaction.get_pymongo_collection().aggregate(pipeline).to_list(length=None)
        res_dict = {r["_id"]: r for r in res}
        
        for i in range(num_days - 1, -1, -1):
            day = date.today() - timedelta(days=i)
            day_str = day.strftime("%Y-%m-%d")
            stats = res_dict.get(day_str, {})
            trends.append({
                "label": day.strftime("%a (%d %b)" if period == "week" else "%d %b"),
                "revenue": float(stats.get("revenue", 0.0)),
                "profit": float(stats.get("profit", 0.0))
            })
            
    elif period == "year":
        cutoff = datetime.combine(date.today() - timedelta(days=365), datetime.min.time())
        pipeline = [
            {"$match": {"timestamp": {"$gte": cutoff}, "owner_username": owner_username}},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {"format": "%Y-%m", "date": "$timestamp"}
                    },
                    "revenue": {"$sum": "$grand_total"},
                    "profit": {"$sum": "$profit"}
                }
            }
        ]
        res = await Transaction.get_pymongo_collection().aggregate(pipeline).to_list(length=None)
        res_dict = {r["_id"]: r for r in res}
        
        for i in range(11, -1, -1):
            first_of_current_month = date.today().replace(day=1)
            target_month_date = first_of_current_month - timedelta(days=i*30)
            target_month_date = target_month_date.replace(day=1)
            month_str = target_month_date.strftime("%Y-%m")
            
            stats = res_dict.get(month_str, {})
            trends.append({
                "label": target_month_date.strftime("%B %Y"),
                "revenue": float(stats.get("revenue", 0.0)),
                "profit": float(stats.get("profit", 0.0))
            })
            
    return trends

@router.get("/category-share")
async def get_category_share(
    current_user: User = Depends(get_current_analytics_viewer)
):
    owner_username = current_user.owner
    pipeline = [
        {"$match": {"owner_username": owner_username}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "revenue": {"$sum": "$items.total_amount"}}}
    ]
    prod_revs = await Transaction.get_pymongo_collection().aggregate(pipeline).to_list(length=None)
    
    category_rev = {}
    for item in prod_revs:
        prod_id = item["_id"]
        rev = item["revenue"]
        if prod_id:
            prod = await Product.find_one(Product.id == prod_id, Product.owner_username == owner_username)
            if prod and prod.category_id:
                cat = await Category.find_one(Category.id == prod.category_id, Category.owner_username == owner_username)
                cat_name = cat.name if cat else "Uncategorized"
            else:
                cat_name = "Uncategorized"
        else:
            cat_name = "Uncategorized"
        category_rev[cat_name] = category_rev.get(cat_name, 0.0) + rev
        
    data = []
    total_rev = sum(category_rev.values())
    for cat_name, rev in category_rev.items():
        percentage = round((rev / total_rev) * 100, 2) if total_rev > 0 else 0.0
        data.append({
            "name": cat_name,
            "value": float(rev),
            "percentage": percentage
        })
        
    return data

@router.get("/payment-methods")
async def get_payment_methods(
    current_user: User = Depends(get_current_analytics_viewer)
):
    owner_username = current_user.owner
    pipeline = [
        {"$match": {"owner_username": owner_username}},
        {"$group": {"_id": "$payment_method", "total": {"$sum": "$grand_total"}}}
    ]
    res = await Transaction.get_pymongo_collection().aggregate(pipeline).to_list(length=None)
    return [{"name": r["_id"], "value": float(r["total"])} for r in res]

@router.get("/hourly-heatmap")
async def get_hourly_heatmap(
    current_user: User = Depends(get_current_analytics_viewer)
):
    # Groups transactions by hour of day (0-23) scoped to owner
    owner_username = current_user.owner
    pipeline = [
        {"$match": {"owner_username": owner_username}},
        {
            "$group": {
                "_id": {"$hour": "$timestamp"},
                "bills_count": {"$sum": 1},
                "revenue": {"$sum": "$grand_total"}
            }
        }
    ]
    results = await Transaction.get_pymongo_collection().aggregate(pipeline).to_list(length=None)
    
    heatmap = {f"{h:02d}": {"hour": f"{h:02d}:00", "bills": 0, "revenue": 0.0} for h in range(24)}
    
    for r in results:
        h = r["_id"]
        if h is not None:
            h_str = f"{int(h):02d}"
            heatmap[h_str]["bills"] = int(r["bills_count"])
            heatmap[h_str]["revenue"] = float(r["revenue"])
            
    return list(heatmap.values())

from fastapi.responses import FileResponse
from backend.app.models.returns import Return
from backend.app.models.settings import StoreSettings
from backend.app.reports.full_report import generate_full_report_pdf
import os

@router.get("/report/pdf")
async def export_pdf_report(
    period: str = "today",
    cashier_username: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
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
        
    role = getattr(current_user, "role", "admin")
    if role != "admin" and not getattr(current_user, "can_view_analytics", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Analytics access required."
        )

    if start_date and end_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())
    else:
        today = date.today()
        end_dt = datetime.combine(today, datetime.max.time())
        if period == "week":
            start_dt = datetime.combine(today - timedelta(days=6), datetime.min.time())
        elif period == "month":
            start_dt = datetime.combine(today - timedelta(days=29), datetime.min.time())
        elif period == "all":
            start_dt = datetime(2000, 1, 1)
        else:  # today
            start_dt = datetime.combine(today, datetime.min.time())
            
    # Enforce cashier limits for non-admin accounts
    owner_username = current_user.owner
    if role != "admin":
        cashier_username = current_user.username
        
    # 1. Fetch Transactions
    tx_filters = {
        "timestamp": {"$gte": start_dt, "$lte": end_dt},
        "owner_username": owner_username
    }
    if cashier_username:
        tx_filters["cashier_username"] = cashier_username
        
    transactions = await Transaction.find(tx_filters).sort(Transaction.timestamp).to_list()
    
    # 2. Fetch Returns
    if cashier_username:
        txs = await Transaction.find({"cashier_username": cashier_username, "owner_username": owner_username}).to_list()
        tx_ids = [str(tx.id) for tx in txs]
        returns_raw = await Return.find(
            Return.timestamp >= start_dt,
            Return.timestamp <= end_dt,
            Return.owner_username == owner_username,
            {"transaction_id": {"$in": tx_ids}}
        ).to_list()
    else:
        returns_raw = await Return.find(
            Return.timestamp >= start_dt,
            Return.timestamp <= end_dt,
            Return.owner_username == owner_username
        ).to_list()
        
    returns = []
    for r in returns_raw:
        p = await Product.find_one(Product.id == r.product_id, Product.owner_username == owner_username)
        prod_info = {"name": p.name} if p else {"name": "Product"}
        tx_obj = await Transaction.find_one(Transaction.id == r.transaction_id, Transaction.owner_username == owner_username)
        invoice_ref = tx_obj.invoice_number if tx_obj else "INV-REF"
        returns.append({
            "details": invoice_ref,
            "product": prod_info,
            "quantity": r.quantity,
            "refund_amount": r.refund_amount,
            "reason": r.reason,
            "timestamp": r.timestamp,
            "customer_name": tx_obj.customer_name if tx_obj else None,
            "customer_phone": tx_obj.customer_phone if tx_obj else None,
            "customer_email": tx_obj.customer_email if tx_obj else None,
            "cashier_username": tx_obj.cashier_username if tx_obj else "Admin"
        })
            
    # 3. Fetch Expenses
    if period == "all" and not (start_date and end_date):
        expenses = await Expense.find(Expense.owner_username == owner_username).to_list()
    else:
        expenses = await Expense.find(
            Expense.date >= start_dt.date(),
            Expense.date <= end_dt.date(),
            Expense.owner_username == owner_username
        ).to_list()
        
    # 4. Fetch Inventory movements
    inv_history = await InventoryHistory.find(
        InventoryHistory.timestamp >= start_dt,
        InventoryHistory.timestamp <= end_dt,
        InventoryHistory.event != "Created",
        InventoryHistory.owner_username == owner_username
    ).sort(InventoryHistory.timestamp).to_list()
    
    # 5. Calculate KPIs dynamically based on actual query range and cashier filtering
    today_revenue = sum(tx.grand_total for tx in transactions)
    today_profit = sum(tx.profit for tx in transactions)
    today_expenses = sum(exp.amount for exp in expenses)
    net_profit = today_profit - today_expenses
    bills_today = len(transactions)
    items_sold = sum(tx.items_count for tx in transactions)
    average_bill = today_revenue / bills_today if bills_today > 0 else 0.0
    
    products_list = await Product.find(Product.owner_username == owner_username).to_list()
    inventory_value = sum((p.current_stock or 0) * (p.selling_price or 0.0) for p in products_list)
    current_stock_value = sum((p.current_stock or 0) * (p.buying_price or 0.0) for p in products_list)
    potential_profit = inventory_value - current_stock_value
    
    kpis_dict = {
        "today_revenue": today_revenue,
        "today_profit": today_profit,
        "today_expenses": today_expenses,
        "net_profit": net_profit,
        "inventory_value": inventory_value,
        "current_stock_value": current_stock_value,
        "potential_profit": potential_profit,
        "bills_today": bills_today,
        "items_sold": items_sold,
        "average_bill": average_bill
    }
    
    # 6. Fetch all products for stock valuation catalog
    products = await Product.find(Product.owner_username == owner_username).to_list()
    
    # 7. Store Settings
    settings = await StoreSettings.find_one(StoreSettings.owner_username == owner_username)
    if not settings:
        settings = StoreSettings(owner_username=owner_username)
        await settings.insert()
        
    # 8. Generate PDF
    pdf_path = generate_full_report_pdf(
        period=period,
        start_date=start_dt.date(),
        end_date=end_dt.date(),
        kpis=kpis_dict,
        transactions=transactions,
        returns=returns,
        expenses=expenses,
        inv_history=inv_history,
        products=products,
        settings=settings
    )
    
    abs_path = os.path.abspath(pdf_path)
    return FileResponse(
        path=abs_path,
        media_type="application/pdf",
        filename=os.path.basename(pdf_path)
    )
