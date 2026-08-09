import asyncio
import os
import random
from datetime import datetime, timedelta, date, time
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

# Monkey-patch AsyncIOMotorClient to bypass Beanie initialization crash in PyMongo 4.x
if not hasattr(AsyncIOMotorClient, "append_metadata"):
    def mock_append_metadata(self, *args, **kwargs):
        pass
    AsyncIOMotorClient.append_metadata = mock_append_metadata

from backend.app.models.product import Product
from backend.app.models.transaction import Transaction, TransactionItem
from backend.app.models.returns import Return
from backend.app.models.ai_recommendations import AIRecommendations
from backend.app.models.ai_prediction import AIPrediction
from backend.app.models.settings import StoreSettings
from backend.app.models.user import User
from backend.app.ai.forecasting import generate_ai_insights

# MongoDB URI setup
MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/smartstock")
DB_NAME = "smartstock"

if "mongodb+srv://" in MONGO_URI:
    # Extract DB name from atlas connection string if present
    # e.g., mongodb+srv://...net/smartstock?authSource=...
    parts = MONGO_URI.split("/")
    if len(parts) > 3:
        db_part = parts[3].split("?")[0]
        if db_part:
            DB_NAME = db_part

async def seed_data():
    print(f"Connecting to MongoDB at: {MONGO_URI} (DB: {DB_NAME})")
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Initialize Beanie
    models = [Product, Transaction, Return, AIRecommendations, AIPrediction, StoreSettings, User]
    await init_beanie(database=db, document_models=models)
    
    print("Fetching active products...")
    products = await Product.find_all().to_list()
    if not products:
        print("No active products found! Please import or add products first before seeding transactions.")
        return
        
    print(f"Found {len(products)} active products. Cleaning old transaction & AI logs...")
    await Transaction.delete_all()
    await Return.delete_all()
    await AIRecommendations.delete_all()
    await AIPrediction.delete_all()
    print("Cleanup complete.")
    
    # Setup seeding time range: past 90 days up to today
    today_dt = date.today()
    start_date = today_dt - timedelta(days=90)
    
    total_bills = 0
    current_date = start_date
    
    # Define payment methods and weights
    pay_methods = ["UPI", "Cash", "Card"]
    pay_weights = [0.55, 0.30, 0.15] # UPI is most popular, then Cash, then Card
    
    print("Generating transactions...")
    while current_date <= today_dt:
        # Determine number of bills for this day
        # Weekend has higher traffic
        is_weekend = current_date.weekday() in [5, 6]
        base_bills = random.randint(22, 35) if is_weekend else random.randint(14, 25)
        
        # We will create consecutive invoice indices for each day
        for i in range(1, base_bills + 1):
            # Select random cashier
            cashier = "admin" if random.random() > 0.4 else "worker1"
            
            # Select payment method
            pay_method = random.choices(pay_methods, weights=pay_weights, k=1)[0]
            
            # Generate realistic shopping hour using weighted slots
            # Peak times: Lunch (12:00 - 14:00) and Evening (18:00 - 21:00)
            hours_pool = list(range(9, 22)) # 09:00 AM to 09:59 PM
            hours_weights = [
                0.05, # 9:00
                0.06, # 10:00
                0.08, # 11:00
                0.12, # 12:00 (Lunch peak starts)
                0.11, # 13:00
                0.09, # 14:00
                0.06, # 15:00
                0.06, # 16:00
                0.08, # 17:00
                0.11, # 18:00 (Evening peak starts)
                0.12, # 19:00
                0.12, # 20:00
                0.04  # 21:00
            ]
            hour = random.choices(hours_pool, weights=hours_weights, k=1)[0]
            minute = random.randint(0, 59)
            second = random.randint(0, 59)
            
            # Create timestamp datetime
            bill_time = time(hour, minute, second)
            timestamp = datetime.combine(current_date, bill_time)
            
            # Generate invoice number: INV-YYYYMMDD-XXXX
            invoice_num = f"INV-{current_date.strftime('%Y%m%d')}-{i:04d}"
            
            # Determine items in cart (1 to 6 items)
            cart_size = random.randint(1, 6)
            selected_products = random.sample(products, min(cart_size, len(products)))
            
            items = []
            subtotal = 0.0
            gst_amount = 0.0
            discount_amount = 0.0
            buying_cost = 0.0
            
            for p in selected_products:
                qty = random.randint(1, 4)
                
                # Check pricing and default values
                b_price = p.buying_price or 10.0
                s_price = p.selling_price or 15.0
                gst_rate = p.gst or 18.0
                disc_rate = p.discount or 0.0
                
                # Item subtotal (gross)
                item_subtotal = qty * s_price
                
                # Calculations
                item_disc = item_subtotal * (disc_rate / 100.0)
                discounted_sub = item_subtotal - item_disc
                
                # GST is calculated on discounted value
                item_gst = discounted_sub * (gst_rate / 100.0)
                item_total = discounted_sub + item_gst
                item_profit = item_total - (qty * b_price)
                
                item = TransactionItem(
                    product_id=p.id,
                    product_name=p.name,
                    product_barcode=p.barcode,
                    quantity=qty,
                    unit_buying_price=b_price,
                    unit_selling_price=s_price,
                    gst_rate=gst_rate,
                    discount_rate=disc_rate,
                    subtotal=item_subtotal,
                    gst_amount=item_gst,
                    discount_amount=item_disc,
                    total_amount=item_total,
                    profit=item_profit
                )
                items.append(item)
                
                subtotal += item_subtotal
                gst_amount += item_gst
                discount_amount += item_disc
                buying_cost += qty * b_price
                
            grand_total = subtotal - discount_amount + gst_amount
            profit = grand_total - buying_cost
            
            # Optional customer info for ~25% of transactions
            cust_name, cust_phone, cust_email = None, None, None
            if random.random() < 0.25:
                cust_names = ["Rajesh Kumar", "Amit Sharma", "Priya Patel", "Sunita Rao", "Vijay Singh", "Deepak Gupta"]
                cust_name = random.choice(cust_names)
                cust_phone = f"98765{random.randint(10000, 99999)}"
                cust_email = f"{cust_name.lower().replace(' ', '')}@example.com"
                
            # Create transaction
            tx = Transaction(
                invoice_number=invoice_num,
                timestamp=timestamp,
                payment_method=pay_method,
                items_count=len(items),
                subtotal=subtotal,
                gst_amount=gst_amount,
                discount_amount=discount_amount,
                grand_total=grand_total,
                buying_cost=buying_cost,
                profit=profit,
                cashier_username=cashier,
                items=items,
                customer_name=cust_name,
                customer_phone=cust_phone,
                customer_email=cust_email,
                total_savings=discount_amount,
                pdf_path=f"reports/{invoice_num}.pdf" # Mock reports file path
            )
            await tx.insert()
            total_bills += 1
            
        current_date += timedelta(days=1)
        
    print(f"Generated and saved {total_bills} historical transactions successfully.")
    
    print("Triggering AI models to forecast demand and extract recommendations...")
    await generate_ai_insights()
    print("AI insight calculations and forecasting complete!")

if __name__ == "__main__":
    asyncio.run(seed_data())
