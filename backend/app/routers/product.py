from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Optional
import io
import re
import pandas as pd
from datetime import datetime
from beanie import PydanticObjectId

from backend.app.models.product import Product
from backend.app.models.category import Category
from backend.app.models.supplier import Supplier
from backend.app.models.inventory_history import InventoryHistory
from backend.app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from backend.app.schemas.other import StockAdjustmentCreate, InventoryHistoryResponse
from backend.app.auth.deps import get_current_user, get_current_stock_manager, get_current_admin
from backend.app.models.user import User
from backend.app.models.audit_logs import AuditLog
from backend.app.services.inventory import log_inventory_change

router = APIRouter(prefix="/products", tags=["Products"])

async def populate_product_relations(p: Product) -> ProductResponse:
    category = None
    if p.category_id:
        category = await Category.get(p.category_id)
    supplier = None
    if p.supplier_id:
        supplier = await Supplier.get(p.supplier_id)
        
    return ProductResponse(
        id=p.id,
        barcode=p.barcode,
        name=p.name,
        brand=p.brand,
        category_id=p.category_id,
        supplier_id=p.supplier_id,
        buying_price=p.buying_price,
        selling_price=p.selling_price,
        gst=p.gst,
        discount=p.discount,
        current_stock=p.current_stock,
        minimum_stock=p.minimum_stock,
        expiry_date=p.expiry_date,
        manufacturing_date=p.manufacturing_date,
        batch_number=p.batch_number,
        status=p.status,
        image_path=p.image_path,
        category=category,
        supplier=supplier
    )

@router.get("", response_model=List[ProductResponse])
async def get_products(
    category_id: Optional[PydanticObjectId] = None,
    query: Optional[str] = None,
    barcode: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    filters = {}
    if category_id is not None:
        filters["category_id"] = category_id
    if barcode:
        filters["barcode"] = barcode
    if status:
        filters["status"] = status
    if query:
        # Regex search on name or brand
        reg = re.compile(re.escape(query), re.IGNORECASE)
        filters["$or"] = [
            {"name": reg},
            {"brand": reg},
            {"barcode": query}
        ]
        
    products = await Product.find(filters).to_list()
    
    resp_list = []
    for p in products:
        populated = await populate_product_relations(p)
        resp_list.append(populated)
    return resp_list

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    product = await Product.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return await populate_product_relations(product)

@router.post("", response_model=ProductResponse)
async def create_product(
    product_in: ProductCreate,
    current_user: User = Depends(get_current_stock_manager)
):
    existing = await Product.find_one(Product.barcode == product_in.barcode)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with barcode '{product_in.barcode}' already exists"
        )
    
    product = Product(**product_in.model_dump())
    await product.insert()
    
    # Log Created Event
    try:
        await log_inventory_change(
            product_id=product.id,
            event="Created",
            quantity_change=product.current_stock,
            details="Product initialized in system"
        )
    except Exception:
        pass
        
    return await populate_product_relations(product)

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: PydanticObjectId,
    product_in: ProductUpdate,
    current_user: User = Depends(get_current_stock_manager)
):
    product = await Product.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    update_data = product_in.model_dump(exclude_unset=True)
    
    old_stock = product.current_stock
    new_stock = update_data.get("current_stock")
    
    for field, value in update_data.items():
        setattr(product, field, value)
        
    # Recalculate status based on stock
    if product.current_stock <= 0:
        product.status = "Out of Stock"
    else:
        product.status = "Available"
        
    await product.save()
    
    # If stock was directly updated in form, log an adjustment
    if new_stock is not None and new_stock != old_stock:
        await log_inventory_change(
            product_id=product.id,
            event="Adjusted",
            quantity_change=(new_stock - old_stock),
            details="Direct stock value update"
        )
        
    return await populate_product_relations(product)

@router.delete("/{product_id}")
async def delete_product(
    product_id: PydanticObjectId,
    current_user: User = Depends(get_current_stock_manager)
):
    product = await Product.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Log 'Deleted' event prior to deletion
    history_entry = InventoryHistory(
        product_id=product.id,
        product_name=product.name,
        event="Deleted",
        quantity_change=-product.current_stock,
        stock_after=0,
        timestamp=datetime.utcnow(),
        details=f"Product '{product.name}' removed from store catalog"
    )
    await history_entry.insert()
    
    await product.delete()
    return {"message": "Product deleted successfully"}

@router.post("/adjust")
async def adjust_stock(
    adj: StockAdjustmentCreate,
    current_user: User = Depends(get_current_stock_manager)
):
    try:
        # Pydantic schema might send product_id as int or string, let's coerce it to PydanticObjectId
        p_id = PydanticObjectId(adj.product_id)
        log_entry = await log_inventory_change(
            product_id=p_id,
            event="Adjusted",
            quantity_change=adj.quantity_change,
            details=f"Manual Stock Correction: {adj.reason}"
        )
        return {"message": "Stock adjusted successfully", "new_stock": log_entry.stock_after}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{product_id}/history", response_model=List[InventoryHistoryResponse])
async def get_product_history(
    product_id: PydanticObjectId,
    current_user: User = Depends(get_current_stock_manager)
):
    return await InventoryHistory.find(
        InventoryHistory.product_id == product_id
    ).sort(-InventoryHistory.timestamp).to_list()

@router.post("/import")
async def import_products_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_stock_manager)
):
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read excel file: {str(e)}")
        
    required_cols = ["barcode", "name", "buying_price", "selling_price", "current_stock"]
    for col in required_cols:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Missing required column: {col}")
            
    success_count = 0
    for _, row in df.iterrows():
        barcode = str(row["barcode"]).strip().split(".")[0]
        name = str(row["name"]).strip()
        buying_price = float(row.get("buying_price", 0.0))
        selling_price = float(row.get("selling_price", 0.0))
        current_stock = int(row.get("current_stock", 0))
        brand = str(row.get("brand", "")) if not pd.isna(row.get("brand")) else None
        gst = float(row.get("gst", 0.0)) if not pd.isna(row.get("gst")) else 0.0
        discount = float(row.get("discount", 0.0)) if not pd.isna(row.get("discount")) else 0.0
        minimum_stock = int(row.get("minimum_stock", 5)) if not pd.isna(row.get("minimum_stock")) else 5
        batch_number = str(row.get("batch_number", "")) if not pd.isna(row.get("batch_number")) else None
        
        # Check if product with barcode exists
        product = await Product.find_one(Product.barcode == barcode)
        if product:
            product.current_stock += current_stock
            product.buying_price = buying_price
            product.selling_price = selling_price
            if product.current_stock > 0:
                product.status = "Available"
            await product.save()
            
            await log_inventory_change(
                product_id=product.id,
                event="Purchased",
                quantity_change=current_stock,
                details="Bulk import restock adjustment"
            )
        else:
            product = Product(
                barcode=barcode,
                name=name,
                brand=brand,
                buying_price=buying_price,
                selling_price=selling_price,
                current_stock=current_stock,
                minimum_stock=minimum_stock,
                gst=gst,
                discount=discount,
                batch_number=batch_number,
                status="Available" if current_stock > 0 else "Out of Stock"
            )
            await product.insert()
            
            await log_inventory_change(
                product_id=product.id,
                event="Created",
                quantity_change=current_stock,
                details="Bulk import creation"
            )
        success_count += 1
        
    return {"message": f"Successfully imported {success_count} products"}

@router.get("/export/excel")
async def export_products_excel(
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
        
    user = await User.find_one(User.username == username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    if getattr(user, "role", "admin") != "admin" and not getattr(user, "can_manage_stock", False):
        raise HTTPException(status_code=403, detail="Permission denied. Stock management rights required.")
    products = await Product.find_all().to_list()
    
    data = []
    for p in products:
        data.append({
            "barcode": p.barcode,
            "name": p.name,
            "brand": p.brand or "",
            "buying_price": p.buying_price,
            "selling_price": p.selling_price,
            "gst_percent": p.gst,
            "discount_percent": p.discount,
            "current_stock": p.current_stock,
            "minimum_stock": p.minimum_stock,
            "expiry_date": str(p.expiry_date) if p.expiry_date else "",
            "manufacturing_date": str(p.manufacturing_date) if p.manufacturing_date else "",
            "batch_number": p.batch_number or "",
            "status": p.status
        })
        
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Products Catalog")
    output.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="products_export.xlsx"'
    }
    return StreamingResponse(
        output,
        headers=headers,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

@router.delete("/clear")
async def clear_inventory(
    current_user: User = Depends(get_current_admin)
):
    await Product.delete_all()
    
    # Audit log
    audit = AuditLog(
        username=current_user.username,
        action="CLEAR_INVENTORY",
        details="Admin permanently cleared all products from the departmental store catalog."
    )
    await audit.insert()
    
    return {"message": "Inventory successfully cleared. All product records have been deleted."}
