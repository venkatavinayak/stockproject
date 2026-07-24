import numpy as np
import pandas as pd
from datetime import datetime, timedelta, date
from beanie import PydanticObjectId

from backend.app.models.product import Product
from backend.app.models.transaction import Transaction
from backend.app.models.ai_recommendations import AIRecommendations
from backend.app.models.ai_prediction import AIPrediction

# Import Scikit-learn model
from sklearn.linear_model import LinearRegression

async def generate_ai_insights():
    # Clear old recommendations
    await AIRecommendations.delete_all()
    
    products = await Product.find_all().to_list()
    if not products:
        return
        
    recommendations = []
    
    # 30-day cutoff for sales analysis
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    for product in products:
        # In Beanie, Transaction has items: List[TransactionItem] inside the document!
        # Search Transaction documents containing an item with product_id == product.id
        txs = await Transaction.find({"items.product_id": product.id}).to_list()
        
        # Extract matching transaction items from all matching transactions
        items = []
        for tx in txs:
            for item in tx.items:
                if item.product_id == product.id:
                    item_data = {
                        "quantity": item.quantity,
                        "timestamp": tx.timestamp
                    }
                    items.append(item_data)
                    
        total_sold = sum(item["quantity"] for item in items)
        
        # 1. Dead Stock Identification
        # Product has stock but has not sold any unit in the last 30 days
        items_30d = [item for item in items if item["timestamp"] >= thirty_days_ago]
        
        if product.current_stock > 0 and not items_30d:
            rec = AIRecommendations(
                type="Dead Stock",
                product_id=product.id,
                suggestion=f"Product '{product.name}' (Stock: {product.current_stock}) has logged zero sales in the last 30 days. Recommend promotional discounting or bundle placement.",
                confidence=0.95,
                timestamp=datetime.utcnow()
            )
            await rec.insert()
            recommendations.append(rec)
            continue
            
        # Calculate daily sales rate
        if items:
            timestamps = [item["timestamp"] for item in items]
            min_date = min(timestamps)
            days_active = (datetime.utcnow() - min_date).days
            if days_active < 1:
                days_active = 1
            avg_daily_sales = total_sold / days_active
        else:
            avg_daily_sales = 0.0
            
        # 2. Stockout Warning / Order suggestion
        if avg_daily_sales > 0:
            days_until_out = product.current_stock / avg_daily_sales
            if days_until_out <= 3:
                # Suggest restock order: enough to cover 21 days of average sales
                suggested_qty = max(int(avg_daily_sales * 21), product.minimum_stock * 2)
                rec = AIRecommendations(
                    type="Stockout Warning",
                    product_id=product.id,
                    suggestion=f"Stock for '{product.name}' will deplete in {days_until_out:.1f} days at current rate ({avg_daily_sales:.2f}/day). Order {suggested_qty} units to cover next 3 weeks.",
                    confidence=0.88,
                    timestamp=datetime.utcnow()
                )
                await rec.insert()
                recommendations.append(rec)
                continue
                
        # 3. Scikit-learn Demand Forecast Regression
        # If we have at least 8 distinct days of sales history, train a Linear Regression model
        if len(items) >= 8:
            try:
                # Group sales by date
                sales_by_date = {}
                for item in items:
                    dt = item["timestamp"].date()
                    sales_by_date[dt] = sales_by_date.get(dt, 0) + item["quantity"]
                    
                # Build time series
                start_dt = min(sales_by_date.keys())
                curr_dt = start_dt
                dates = []
                sales = []
                
                while curr_dt <= date.today():
                    dates.append(curr_dt)
                    sales.append(sales_by_date.get(curr_dt, 0))
                    curr_dt += timedelta(days=1)
                    
                df = pd.DataFrame({
                    "date": pd.to_datetime(dates),
                    "sales": sales
                })
                
                # Feature engineering
                df["day_of_week"] = df["date"].dt.dayofweek
                df["day_of_month"] = df["date"].dt.day
                df["month"] = df["date"].dt.month
                df["lag_1"] = df["sales"].shift(1).fillna(0)
                df["lag_7"] = df["sales"].shift(7).fillna(0)
                
                X = df[["day_of_week", "day_of_month", "month", "lag_1", "lag_7"]]
                y = df["sales"]
                
                model = LinearRegression()
                model.fit(X, y)
                
                # Predict sales for tomorrow
                tomorrow = date.today() + timedelta(days=1)
                tomorrow_dt = pd.to_datetime(tomorrow)
                last_sales_1 = df["sales"].iloc[-1] if len(df) >= 1 else 0
                last_sales_7 = df["sales"].iloc[-7] if len(df) >= 7 else 0
                
                X_pred = pd.DataFrame([{
                    "day_of_week": tomorrow_dt.dayofweek,
                    "day_of_month": tomorrow_dt.day,
                    "month": tomorrow_dt.month,
                    "lag_1": last_sales_1,
                    "lag_7": last_sales_7
                }])
                
                tomorrow_pred = float(model.predict(X_pred)[0])
                if tomorrow_pred < 0:
                    tomorrow_pred = 0.0
                    
                # Update previous day's forecast accuracy
                today_dt = date.today()
                today_sales = sales_by_date.get(today_dt, 0.0)
                yesterday_pred = await AIPrediction.find_one(
                    AIPrediction.product_id == product.id,
                    AIPrediction.created_at >= datetime.combine(today_dt - timedelta(days=1), datetime.min.time()),
                    AIPrediction.created_at <= datetime.combine(today_dt - timedelta(days=1), datetime.max.time())
                )
                if yesterday_pred:
                    yesterday_pred.actual_sales = today_sales
                    if today_sales > 0:
                        err = abs(yesterday_pred.predicted_sales - today_sales) / today_sales
                        yesterday_pred.accuracy = max(0.0, 1.0 - err)
                    else:
                        yesterday_pred.accuracy = 1.0 if yesterday_pred.predicted_sales == 0 else 0.0
                    await yesterday_pred.save()
                
                # Save tomorrow's prediction
                new_prediction = AIPrediction(
                    product_id=product.id,
                    predicted_sales=round(tomorrow_pred, 1),
                    created_at=datetime.utcnow()
                )
                await new_prediction.insert()
                
                # If tomorrow's predicted demand exceeds minimum stock and we are low on stock
                if tomorrow_pred > product.current_stock:
                    suggest_order = int(tomorrow_pred * 7) or 10
                    rec = AIRecommendations(
                        type="Demand Spike",
                        product_id=product.id,
                        suggestion=f"AI predicts a demand surge for '{product.name}' tomorrow ({tomorrow_pred:.1f} expected sales). Suggest having at least {suggest_order} units ready.",
                        confidence=round(max(0.60, min(0.98, float(model.score(X, y)))), 2) if len(df) > 10 else 0.70,
                        timestamp=datetime.utcnow()
                    )
                    await rec.insert()
                    recommendations.append(rec)
            except Exception:
                pass
                
    # 4. Fallback Recommendations if none compiled
    if not recommendations:
        for p in products[:4]:
            if p.current_stock <= p.minimum_stock:
                rec = AIRecommendations(
                    type="Order Recommendation",
                    product_id=p.id,
                    suggestion=f"Refill Suggestion: '{p.name}' is near safety stock limit. Suggest reordering {p.minimum_stock * 3} units.",
                    confidence=0.80,
                    timestamp=datetime.utcnow()
                )
                await rec.insert()
                recommendations.append(rec)
