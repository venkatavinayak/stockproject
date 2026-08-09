from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import date, datetime, timedelta
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from beanie import PydanticObjectId

from backend.app.models.ai_recommendations import AIRecommendations
from backend.app.models.product import Product
from backend.app.models.transaction import Transaction
from backend.app.schemas.other import AIRecommendationResponse
from backend.app.ai.forecasting import generate_ai_insights
from backend.app.routers.product import populate_product_relations
from backend.app.auth.deps import get_current_user
from backend.app.models.user import User

router = APIRouter(prefix="/ai", tags=["AI Recommendations & Forecasts"])

@router.get("/recommendations", response_model=List[AIRecommendationResponse])
async def get_recommendations(
    current_user: User = Depends(get_current_user)
):
    recs = await AIRecommendations.find_all().to_list()
    if not recs:
        await generate_ai_insights()
        recs = await AIRecommendations.find_all().to_list()
        
    for r in recs:
        if r.product_id:
            p = await Product.get(r.product_id)
            if p:
                r.product = await populate_product_relations(p)
    return recs

@router.post("/trigger")
async def trigger_analysis(
    current_user: User = Depends(get_current_user)
):
    await generate_ai_insights()
    return {"message": "AI insights compiled successfully"}

@router.get("/forecast/{product_id}")
async def get_product_forecast(
    product_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    product = await Product.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Query transactions containing this product
    txs = await Transaction.find({"items.product_id": product.id}).to_list()
    
    items = []
    for tx in txs:
        for item in tx.items:
            if item.product_id == product.id:
                items.append({
                    "quantity": item.quantity,
                    "timestamp": tx.timestamp
                })
                
    today_dt = date.today()
    
    # If we don't have enough data, return a baseline average with weekday seasonality
    if len(items) < 8:
        total_qty = sum(item["quantity"] for item in items)
        if items:
            timestamps = [item["timestamp"] for item in items]
            days_span = (datetime.utcnow() - min(timestamps)).days or 1
            base_sales = total_qty / days_span
        else:
            base_sales = 0.0
            
        forecast_30 = []
        for i in range(1, 31):
            target_date = today_dt + timedelta(days=i)
            day_mult = 1.3 if target_date.weekday() in [5, 6] else 0.9
            if items:
                pred_qty = max(1, int(round(base_sales * day_mult)))
            else:
                pred_qty = 0
            forecast_30.append({
                "date": str(target_date),
                "day_name": target_date.strftime("%A"),
                "quantity": pred_qty
            })
            
        return {
            "product_id": str(product_id),
            "name": product.name,
            "forecast": forecast_30[:7],
            "next_week_prediction": sum(day["quantity"] for day in forecast_30[:7]),
            "next_month_prediction": sum(day["quantity"] for day in forecast_30),
            "method": "Baseline Moving Average"
        }
        
    # Random Forest Model prediction
    try:
        sales_by_date = {}
        for item in items:
            dt = item["timestamp"].date()
            sales_by_date[dt] = sales_by_date.get(dt, 0) + item["quantity"]
            
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
        
        df["day_of_week"] = df["date"].dt.dayofweek
        df["day_of_month"] = df["date"].dt.day
        df["month"] = df["date"].dt.month
        df["lag_1"] = df["sales"].shift(1).fillna(0)
        df["lag_7"] = df["sales"].shift(7).fillna(0)
        
        X = df[["day_of_week", "day_of_month", "month", "lag_1", "lag_7"]]
        y = df["sales"]
        
        # Initialize and fit Random Forest
        model = RandomForestRegressor(n_estimators=50, random_state=42)
        model.fit(X, y)
        
        # Roll forward for 30 days
        current_history = list(df["sales"])
        forecast_30 = []
        for i in range(1, 31):
            target_date = today_dt + timedelta(days=i)
            target_dt = pd.to_datetime(target_date)
            
            # Extract features dynamically using rolling history
            lag_1_val = current_history[-1] if len(current_history) >= 1 else 0
            lag_7_val = current_history[-7] if len(current_history) >= 7 else 0
            
            pred_row = pd.DataFrame([{
                "day_of_week": target_dt.dayofweek,
                "day_of_month": target_dt.day,
                "month": target_dt.month,
                "lag_1": lag_1_val,
                "lag_7": lag_7_val
            }])
            
            pred_val = float(model.predict(pred_row)[0])
            pred_qty = max(0, int(round(pred_val)))
            
            forecast_30.append({
                "date": str(target_date),
                "day_name": target_date.strftime("%A"),
                "quantity": pred_qty
            })
            current_history.append(pred_val)
            
        return {
            "product_id": str(product_id),
            "name": product.name,
            "forecast": forecast_30[:7],
            "next_week_prediction": sum(day["quantity"] for day in forecast_30[:7]),
            "next_month_prediction": sum(day["quantity"] for day in forecast_30),
            "method": "Random Forest Forecast"
        }
    except Exception as e:
        base_sales = 1 if items else 0
        forecast_30 = []
        for i in range(1, 31):
            target_date = today_dt + timedelta(days=i)
            forecast_30.append({
                "date": str(target_date),
                "day_name": target_date.strftime("%A"),
                "quantity": base_sales
            })
        return {
            "product_id": str(product_id),
            "name": product.name,
            "forecast": forecast_30[:7],
            "next_week_prediction": sum(day["quantity"] for day in forecast_30[:7]),
            "next_month_prediction": sum(day["quantity"] for day in forecast_30),
            "method": f"Fallback ({str(e)})"
        }
