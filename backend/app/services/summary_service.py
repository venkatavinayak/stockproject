from datetime import datetime, date, timedelta
from beanie import PydanticObjectId
from backend.app.models.daily_summary import DailySummary, TopProductItem
from backend.app.models.transaction import Transaction
from backend.app.models.expense import Expense
from backend.app.models.returns import Return
from backend.app.models.product import Product
from backend.app.models.purchase import Purchase

async def compile_daily_closing_summary(summary_date: date = None):
    try:
        if summary_date is None:
            summary_date = date.today()
            
        # Avoid duplicate: delete existing summary for the same date
        existing = await DailySummary.find_one(DailySummary.date == summary_date)
        if existing:
            await existing.delete()
            
        start_dt = datetime.combine(summary_date, datetime.min.time())
        end_dt = datetime.combine(summary_date, datetime.max.time())
        
        # 1. Sales aggregates for today
        txs_today = await Transaction.find(
            Transaction.timestamp >= start_dt,
            Transaction.timestamp <= end_dt
        ).to_list()
        
        rev = sum(tx.grand_total for tx in txs_today)
        cost = sum(tx.buying_cost for tx in txs_today)
        profit = sum(tx.profit for tx in txs_today)
        bills = len(txs_today)
        
        # Payment breakdown
        cash = sum(tx.grand_total for tx in txs_today if tx.payment_method == "Cash")
        upi = sum(tx.grand_total for tx in txs_today if tx.payment_method == "UPI")
        card = sum(tx.grand_total for tx in txs_today if tx.payment_method == "Card")
        mixed = sum(tx.grand_total for tx in txs_today if tx.payment_method == "Mixed")
        
        # Split mixed sales proportionally
        cash += mixed * 0.4
        upi += mixed * 0.4
        card += mixed * 0.2
        
        # Expenses today
        exps_today = await Expense.find(Expense.date == summary_date).to_list()
        expenses = sum(e.amount for e in exps_today)
        
        # Returns today
        returns_today = await Return.find(
            Return.timestamp >= start_dt,
            Return.timestamp <= end_dt
        ).to_list()
        returned = sum(r.refund_amount for r in returns_today)
        
        # Current inventory value using Aggregation
        inv_stats_pipeline = [
            {
                "$group": {
                    "_id": None,
                    "buying_val": {"$sum": {"$multiply": ["$current_stock", "$buying_price"]}}
                }
            }
        ]
        inv_stats = await Product.get_pymongo_collection().aggregate(inv_stats_pipeline).to_list(length=None)
        closing_val = float(inv_stats[0].get("buying_val", 0.0)) if inv_stats else 0.0
        
        # Restocks purchased today
        purchases_today = await Purchase.find(
            Purchase.purchase_date == summary_date,
            Purchase.status == "Received"
        ).to_list()
        purchased = sum(p.total_cost for p in purchases_today)
        
        # Calculate opening value estimate
        opening_val = closing_val - purchased + cost - returned
        if opening_val < 0:
            opening_val = 0.0
            
        # Top products today using Mongo aggregation
        top_items_pipeline = [
            {"$match": {"timestamp": {"$gte": start_dt, "$lte": end_dt}}},
            {"$unwind": "$items"},
            {
                "$group": {
                    "_id": "$items.product_id",
                    "name": {"$first": "$items.product_name"},
                    "qty": {"$sum": "$items.quantity"}
                }
            },
            {"$sort": {"qty": -1}},
            {"$limit": 5}
        ]
        top_items = await Transaction.get_pymongo_collection().aggregate(top_items_pipeline).to_list(length=None)
        
        top_list = []
        for item in top_items:
            if item["_id"] is not None:
                top_list.append(TopProductItem(
                    product_id=PydanticObjectId(item["_id"]),
                    product_name=item["name"] or "Unknown",
                    quantity=int(item["qty"])
                ))
                
        summary = DailySummary(
            date=summary_date,
            opening_stock_value=opening_val,
            purchased_stock_value=purchased,
            sold_stock_value=cost,
            returned_stock_value=returned,
            closing_stock_value=closing_val,
            revenue=rev,
            profit=profit,
            expenses=expenses,
            net_profit=profit - expenses,
            cash_sales=cash,
            upi_sales=upi,
            card_sales=card,
            bills_count=bills,
            top_products=top_list
        )
        await summary.insert()
        print(f"Daily closing summary compiled for {summary_date}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print("Daily closing summary compilation failed:", str(e))
