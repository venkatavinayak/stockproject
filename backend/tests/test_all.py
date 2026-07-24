import unittest
import os
os.environ["TESTING"] = "true"

from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from httpx import AsyncClient
from httpx._transports.asgi import ASGITransport

# Apply monkey patch to prevent Beanie initialization crash in PyMongo 4.x
if not hasattr(AsyncIOMotorClient, "append_metadata"):
    def mock_append_metadata(self, *args, **kwargs):
        pass
    AsyncIOMotorClient.append_metadata = mock_append_metadata

from beanie import init_beanie
from backend.app.main import app
from backend.app.models import all_document_models
from backend.app.models.user import User
from backend.app.models.product import Product
from backend.app.models.category import Category
from backend.app.models.supplier import Supplier
from backend.app.models.transaction import Transaction
from backend.app.models.returns import Return
from backend.app.models.inventory_history import InventoryHistory
from backend.app.auth.security import get_password_hash

class SmartStockTestCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # Initialize Async Motor Client and point to test database
        self.motor_client = AsyncIOMotorClient("mongodb://127.0.0.1:27017")
        self.db = self.motor_client["smartstock_test"]
        
        # Initialize Beanie with document classes
        await init_beanie(database=self.db, document_models=all_document_models)
        
        # Clear collections to ensure a clean test state
        for model in all_document_models:
            await model.delete_all()
            
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        
    async def asyncTearDown(self):
        # Close AsyncClient and Motor connection
        await self.client.aclose()
        self.motor_client.close()
        
    async def test_auth_and_billing_pipeline(self):
        # 1. Test Login & Auth Functions
        hashed = get_password_hash("testpassword123")
        user = User(username="testadmin", hashed_password=hashed, is_active=True)
        await user.insert()
        
        # Success login (FastAPI OAuth2 expects form-data)
        response = await self.client.post(
            "/api/auth/login",
            data={"username": "testadmin", "password": "testpassword123"}
        )
        self.assertEqual(response.status_code, 200)
        token = response.json()["access_token"]
        auth_header = {"Authorization": f"Bearer {token}"}
        
        # Change password
        response = await self.client.post(
            "/api/auth/change-password",
            json={"old_password": "testpassword123", "new_password": "newsecurepassword456"},
            headers=auth_header
        )
        self.assertEqual(response.status_code, 200)
        
        # Login with new password
        response = await self.client.post(
            "/api/auth/login",
            data={"username": "testadmin", "password": "newsecurepassword456"}
        )
        self.assertEqual(response.status_code, 200)
        token = response.json()["access_token"]
        auth_header = {"Authorization": f"Bearer {token}"}
        
        # 2. Category, Supplier & Product setups
        cat = Category(name="Grocery", description="Food items")
        await cat.insert()
        sup = Supplier(name="Global Distributors")
        await sup.insert()
        
        prod = Product(
            barcode="8901234567890",
            name="Basmati Rice",
            brand="India Gate",
            category_id=cat.id,
            supplier_id=sup.id,
            buying_price=80.0,
            selling_price=100.0,
            gst=5.0,
            discount=10.0,
            current_stock=50,
            minimum_stock=10,
            status="Available"
        )
        await prod.insert()
        
        # 3. Checkout transaction
        checkout_payload = {
            "payment_method": "Cash",
            "items": [
                {
                    "product_id": str(prod.id),
                    "quantity": 2,
                    "discount_rate": 0.0,
                    "gst_rate": 0.0
                }
            ],
            "discount_amount": 0.0,
            "cash_received": 200.0,
            "change_given": 11.0
        }
        
        response = await self.client.post("/api/billing/checkout", json=checkout_payload, headers=auth_header)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify invoice arithmetic
        self.assertEqual(data["items_count"], 2)
        self.assertEqual(data["subtotal"], 200.0)
        self.assertEqual(data["discount_amount"], 20.0)
        self.assertEqual(data["gst_amount"], 9.0)
        self.assertEqual(data["grand_total"], 189.0)
        self.assertEqual(data["buying_cost"], 160.0)
        self.assertEqual(data["profit"], 29.0)
        
        # Verify product stock reduction
        updated_prod = await Product.get(prod.id)
        self.assertEqual(updated_prod.current_stock, 48)
        
        # Verify log entry in history
        hist = await InventoryHistory.find_one(
            InventoryHistory.product_id == prod.id
        )
        self.assertEqual(hist.event, "Sold")
        self.assertEqual(hist.quantity_change, -2)
        self.assertEqual(hist.stock_after, 48)
        
        # 4. Returns refund flow
        refund_response = await self.client.post(
            f"/api/transactions/{data['id']}/refund/{str(prod.id)}",
            params={"quantity": 1, "reason": "Defective item"},
            headers=auth_header
        )
        self.assertEqual(refund_response.status_code, 200)
        ret_data = refund_response.json()
        self.assertEqual(ret_data["quantity"], 1)
        self.assertEqual(ret_data["refund_amount"], 94.5)
        
        # Verify restocked item
        updated_prod2 = await Product.get(prod.id)
        self.assertEqual(updated_prod2.current_stock, 49)
        
        # Verify timeline history logs
        hist_list = await InventoryHistory.find(
            InventoryHistory.product_id == prod.id
        ).sort(-InventoryHistory.timestamp).to_list()
        self.assertEqual(hist_list[0].event, "Returned")
        self.assertEqual(hist_list[0].quantity_change, 1)
        self.assertEqual(hist_list[0].stock_after, 49)

if __name__ == "__main__":
    unittest.main()
