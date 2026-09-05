from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import List
from datetime import datetime
from beanie import PydanticObjectId

from backend.app.models.product import Product
from backend.app.models.transaction import Transaction, TransactionItem
from backend.app.models.customer import Customer
from backend.app.models.settings import StoreSettings
from backend.app.models.audit_logs import AuditLog
from backend.app.schemas.transaction import TransactionCreate, TransactionResponse
from backend.app.utils.invoice import generate_invoice_number
from backend.app.reports.receipt import generate_thermal_receipt
from backend.app.services.inventory import log_inventory_change
from backend.app.services.email_service import send_invoice_email
from backend.app.routers.product import populate_product_relations
from backend.app.auth.deps import get_current_user
from backend.app.models.user import User

router = APIRouter(prefix="/billing", tags=["Billing POS"])

@router.post("/checkout", response_model=TransactionResponse)
async def checkout(
    tx_in: TransactionCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    if not tx_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot process checkout: Shopping cart is empty"
        )
        
    # Generate sequential invoice number asynchronously
    invoice_no = await generate_invoice_number()
    
    # Financial accumulators
    subtotal_total = 0.0
    gst_total = 0.0
    discount_total = 0.0
    buying_cost_total = 0.0
    
    items_to_save = []
    products_to_update = []
    
    # 1. Validation and calculations
    for item_in in tx_in.items:
        product = await Product.find_one(Product.id == item_in.product_id, Product.owner_username == current_user.owner)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {item_in.product_id} not found"
            )
            
        if product.current_stock < item_in.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{product.name}'. In stock: {product.current_stock}, Requested: {item_in.quantity}"
            )
            
        qty = item_in.quantity
        unit_buying = product.buying_price
        unit_selling = product.selling_price
        
        # Use provided rates or fall back to product defaults
        gst_rate = item_in.gst_rate if item_in.gst_rate > 0.0 else product.gst
        discount_rate = item_in.discount_rate if item_in.discount_rate > 0.0 else product.discount
        
        # Calculate item line totals
        item_subtotal = qty * unit_selling
        item_discount = item_subtotal * (discount_rate / 100.0)
        item_taxable = item_subtotal - item_discount
        item_gst = item_taxable * (gst_rate / 100.0)
        item_total = item_taxable + item_gst
        item_buying_cost = qty * unit_buying
        item_profit = item_total - item_buying_cost
        
        # Accumulate
        subtotal_total += item_subtotal
        gst_total += item_gst
        discount_total += item_discount
        buying_cost_total += item_buying_cost
        
        tx_item = TransactionItem(
            product_id=product.id,
            product_name=product.name,
            product_barcode=product.barcode,
            quantity=qty,
            unit_buying_price=unit_buying,
            unit_selling_price=unit_selling,
            gst_rate=gst_rate,
            discount_rate=discount_rate,
            subtotal=item_subtotal,
            gst_amount=item_gst,
            discount_amount=item_discount,
            total_amount=item_total,
            profit=item_profit
        )
        items_to_save.append(tx_item)
        products_to_update.append((product, qty))
        
    # Apply manual bill level discount
    manual_discount = tx_in.discount_amount or 0.0
    discount_total += manual_discount
    
    # Calculate final grand total
    final_grand_total = subtotal_total - discount_total + gst_total
    if final_grand_total < 0:
        final_grand_total = 0.0
        
    # Compute final transaction profit
    final_profit = final_grand_total - buying_cost_total
    
    # Total Customer Savings (item discounts + manual discount)
    total_savings = discount_total
    
    # 2. Persist customer loyalty points if phone number provided
    if tx_in.customer_phone:
        clean_phone = tx_in.customer_phone.strip()
        customer = await Customer.find_one(Customer.phone == clean_phone, Customer.owner_username == current_user.owner)
        points_earned = int(final_grand_total // 100) # 1 point per Rs.100
        
        if not customer:
            customer = Customer(
                name=tx_in.customer_name or "Retail Customer",
                phone=clean_phone,
                loyalty_points=points_earned,
                owner_username=current_user.owner
            )
            await customer.insert()
        else:
            customer.loyalty_points += points_earned
            if tx_in.customer_name:
                customer.name = tx_in.customer_name
            await customer.save()
            
    # 3. Create transaction document
    transaction = Transaction(
        invoice_number=invoice_no,
        timestamp=datetime.utcnow(),
        payment_method=tx_in.payment_method,
        items_count=sum(item.quantity for item in tx_in.items),
        subtotal=subtotal_total,
        gst_amount=gst_total,
        discount_amount=discount_total,
        grand_total=final_grand_total,
        buying_cost=buying_cost_total,
        profit=final_profit,
        items=items_to_save,
        customer_name=tx_in.customer_name,
        customer_phone=tx_in.customer_phone,
        customer_email=tx_in.customer_email,
        total_savings=total_savings,
        pdf_path="",
        cashier_username=current_user.username.split(":")[-1] if ":" in current_user.username else current_user.username,
        owner_username=current_user.owner
    )
    
    # Save transaction to database (to generate transaction.id)
    await transaction.insert()

    # Simulate immediate dispatch of PDF to customer
    if tx_in.customer_email:
        print(f"[Receipt Dispatch] Preparing Invoice {invoice_no} PDF email for customer: {tx_in.customer_email}")
    if tx_in.customer_phone:
        print(f"[Receipt Dispatch] Sending Invoice {invoice_no} SMS link successfully to customer phone: {tx_in.customer_phone}")
    
    # 4. Deduct stock levels & log history events
    for product, qty in products_to_update:
        await log_inventory_change(
            product_id=product.id,
            event="Sold",
            quantity_change=-qty,
            details=f"Sold via Invoice {invoice_no}",
            owner_username=current_user.owner
        )
        
    # Get store settings for PDF print
    settings = await StoreSettings.find_one(StoreSettings.owner_username == current_user.owner)
    if not settings:
        settings = StoreSettings(owner_username=current_user.owner, store_name="Smart Store Ai")
        await settings.insert()
        
    # 5. Generate receipt PDF & Dispatch Email
    try:
        pdf_path = generate_thermal_receipt(transaction, settings)
        transaction.pdf_path = pdf_path
        await transaction.save()
        
        if tx_in.customer_email:
            import os
            smtp_user = settings.smtp_user or os.getenv("SMTP_USER", "mysmartstoreai@gmail.com")
            smtp_pass = settings.smtp_password or os.getenv("SMTP_PASSWORD") or os.getenv("GMAIL_APP_PASS")
            smtp_host = settings.smtp_host or os.getenv("SMTP_HOST", "smtp.gmail.com")
            smtp_port = int(settings.smtp_port or os.getenv("SMTP_PORT", 465))
            
            settings.smtp_user = smtp_user
            settings.smtp_host = smtp_host
            settings.smtp_port = smtp_port
            if smtp_pass:
                settings.smtp_password = smtp_pass
            settings.email_enable = True

            if not smtp_user or not smtp_pass:
                from backend.app.models.notification import Notification
                notif = Notification(
                    type="System",
                    message=f"Invoice {invoice_no} email skipped: Gmail App Password is missing. Please configure your App Password in Store Settings.",
                    timestamp=datetime.utcnow(),
                    owner_username=current_user.owner
                )
                await notif.insert()
            else:
                background_tasks.add_task(
                    send_invoice_email,
                    email_to=tx_in.customer_email,
                    invoice_no=invoice_no,
                    pdf_path=pdf_path,
                    settings=settings
                )
    except Exception as e:
        import traceback
        traceback.print_exc()
        
    # Audit log
    audit = AuditLog(
        username=current_user.username,
        action="CHECKOUT",
        details=f"Issued invoice {invoice_no} totaling Rs.{final_grand_total:.2f}.",
        owner_username=current_user.owner
    )
    await audit.insert()
    
    # Populate nested product relations for response schema
    for item in transaction.items:
        if item.product_id:
            prod_obj = await Product.get(item.product_id)
            if prod_obj:
                item.product = await populate_product_relations(prod_obj)
                
    return transaction
