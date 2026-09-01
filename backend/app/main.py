from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from datetime import datetime

from backend.app.database.mongodb import init_db, close_db
from backend.app.models import all_document_models, User, StoreSettings
from backend.app.auth.security import get_password_hash
from backend.app.services.scheduler import start_scheduler, scheduler

# Import routers
from backend.app.routers.auth import router as auth_router
from backend.app.routers.product import router as product_router
from backend.app.routers.category import router as category_router
from backend.app.routers.supplier import router as supplier_router
from backend.app.routers.billing import router as billing_router
from backend.app.routers.transactions import router as transactions_router
from backend.app.routers.purchases import router as purchases_router
from backend.app.routers.expenses import router as expenses_router
from backend.app.routers.settings import router as settings_router
from backend.app.routers.backup import router as backup_router
from backend.app.routers.ai import router as ai_router
from backend.app.routers.notifications import router as notifications_router
from backend.app.routers.analytics import router as analytics_router

# Beanie document collections are initialized asynchronously in the startup event

app = FastAPI(
    title="Smart Store Ai - Retail ERP & POS API",
    description="Backend API for Smart Departmental Store Inventory, Billing, and Business Analytics",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure local asset directories exist
os.makedirs("reports", exist_ok=True)
os.makedirs("backups", exist_ok=True)
os.makedirs("uploads", exist_ok=True)

# Mount reports directory as static files to allow direct PDF downloads
app.mount("/reports", StaticFiles(directory="reports"), name="reports")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers under /api
app.include_router(auth_router, prefix="/api")
app.include_router(product_router, prefix="/api")
app.include_router(category_router, prefix="/api")
app.include_router(supplier_router, prefix="/api")
app.include_router(billing_router, prefix="/api")
app.include_router(transactions_router, prefix="/api")
app.include_router(purchases_router, prefix="/api")
app.include_router(expenses_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(backup_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")

@app.on_event("startup")
async def on_startup():
    try:
        # 1. Initialize MongoDB and Beanie
        await init_db(all_document_models)
        
        # 2. Create default admin if not present
        admin_user = await User.find_one(User.username == "admin")
        if not admin_user:
            admin_user = User(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                is_active=True
            )
            await admin_user.insert()
            print("Default admin user created: admin / admin123")

        # Migration: Ensure all store owners have a unique 6-character shop_code assigned
        from backend.app.routers.auth import generate_unique_shop_code
        all_users = await User.find_all().to_list()
        for u in all_users:
            if u.role == "admin" and not u.shop_code:
                u.shop_code = await generate_unique_shop_code()
                await u.save()
                print(f"Assigned shop_code '{u.shop_code}' to store owner '{u.username}'")
            
        # 3. Create default store settings if not present
        store_settings = await StoreSettings.find_one()
        if not store_settings:
            store_settings = StoreSettings(
                store_name="Smart Store Ai Store",
                gst_number="27AAAAA1111A1Z1",
                address="123 Shopping Arcade, Central Market Road, Sector 5",
                contact_info="+91 98765 43210",
                currency_symbol="₹",
                receipt_format="Thermal",
                invoice_footer="Thank you for shopping with us! Visit again."
            )
            await store_settings.insert()
            print("Default store settings initialized")
            
        # 4. Start Background Scheduler tasks
        if os.getenv("TESTING") != "true":
            start_scheduler()
            print("APScheduler background tasks running successfully")
        else:
            print("Bypassing background scheduler in test environment")
    except Exception as e:
        print("Startup initialization error:", str(e))

@app.on_event("shutdown")
async def on_shutdown():
    await close_db()
    scheduler.shutdown()
    print("Background scheduler shutdown")

@app.get("/")
def read_root():
    return {"status": "running", "system": "Smart Store Ai Retail ERP", "timestamp": str(datetime.now())}
