import pytest
from backend.app.models.user import User
from backend.app.models.product import Product
from backend.app.models.category import Category
from backend.app.models.supplier import Supplier
from backend.app.models.transaction import Transaction
from backend.app.models.inventory_history import InventoryHistory
from backend.app.models.return import Return
from backend.app.auth.security import get_password_hash

@pytest.fixture
def auth_header(client, db):
    # Setup default admin
    hashed = get_password_hash("admin123")
    user = User(username="admin", hashed_password=hashed, is_active=True)
    db.add(user)
    db.commit()
    
    # Login
    response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_pos_checkout_flow(client, db, auth_header):
    # 1. Setup category, supplier, and product
    cat = Category(name="Grocery", description="Food items")
    sup = Supplier(name="Global Distributors")
    db.add_all([cat, sup])
    db.commit()
    
    prod = Product(
        barcode="8901234567890",
        name="Basmati Rice",
        brand="India Gate",
        category_id=cat.id,
        supplier_id=sup.id,
        buying_price=80.0,
        selling_price=100.0,
        gst=5.0,  # 5%
        discount=10.0,  # 10%
        current_stock=50,
        minimum_stock=10,
        status="Available"
    )
    db.add(prod)
    db.commit()
    
    # 2. Trigger Checkout (Purchase 2 units of Rice)
    # Unit Calculations:
    # Subtotal: 2 * 100 = 200
    # Discount: 10% of 200 = 20
    # Taxable: 200 - 20 = 180
    # GST: 5% of 180 = 9.0
    # Grand Total: 180 + 9.0 = 189.0
    # Buying Cost: 2 * 80 = 160
    # Expected Profit: 189 - 160 = 29.0
    
    checkout_payload = {
        "payment_method": "Cash",
        "items": [
            {
                "product_id": prod.id,
                "quantity": 2,
                "discount_rate": 0.0,  # use product default
                "gst_rate": 0.0        # use product default
            }
        ],
        "discount_amount": 0.0,
        "cash_received": 200.0,
        "change_given": 11.0
    }
    
    response = client.post("/api/billing/checkout", json=checkout_payload, headers=auth_header)
    assert response.status_code == 200
    data = response.json()
    
    # Assert billing financials
    assert data["items_count"] == 2
    assert data["subtotal"] == 200.0
    assert data["discount_amount"] == 20.0
    assert data["gst_amount"] == 9.0
    assert data["grand_total"] == 189.0
    assert data["buying_cost"] == 160.0
    assert data["profit"] == 29.0
    
    # Verify stock reduction
    db.refresh(prod)
    assert prod.current_stock == 48
    
    # Verify inventory history entry
    hist = db.query(InventoryHistory).filter(InventoryHistory.product_id == prod.id).order_by(InventoryHistory.id.desc()).first()
    assert hist.event == "Sold"
    assert hist.quantity_change == -2
    assert hist.stock_after == 48
    
    # 3. Test Returns flow (Return 1 unit of Rice)
    # Proportional refund: 1 * (189.0 / 2) = 94.5
    refund_response = client.post(
        f"/api/transactions/{data['id']}/refund/{prod.id}",
        params={"quantity": 1, "reason": "Damaged packing"},
        headers=auth_header
    )
    assert refund_response.status_code == 200
    ret_data = refund_response.json()
    assert ret_data["quantity"] == 1
    assert ret_data["refund_amount"] == 94.5
    
    # Verify stock returned
    db.refresh(prod)
    assert prod.current_stock == 49
    
    # Verify timeline history
    hist2 = db.query(InventoryHistory).filter(InventoryHistory.product_id == prod.id).order_by(InventoryHistory.id.desc()).first()
    assert hist2.event == "Returned"
    assert hist2.quantity_change == 1
    assert hist2.stock_after == 49
