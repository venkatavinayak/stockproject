import os
import random
from datetime import datetime
from reportlab.lib.pagesizes import portrait
from reportlab.pdfgen import canvas
from backend.app.models.transaction import Transaction
from backend.app.models.settings import StoreSettings

def draw_vector_barcode(c, x, y, width, height, invoice_number):
    """Draws a high-fidelity mock vector barcode with varying black line widths."""
    # Seed by invoice hash for deterministic unique barcodes
    random.seed(hash(invoice_number))
    c.setFillColorRGB(0, 0, 0)
    curr_x = x
    while curr_x < x + width - 5:
        line_w = random.choice([0.75, 1.5, 2.25])
        c.rect(curr_x, y, line_w, height, fill=True, stroke=False)
        curr_x += line_w + random.choice([0.75, 1.5])

def draw_vector_qr_code(c, x, y, size):
    """Draws a vector QR Code mockup including the three large corner position finder patterns."""
    random.seed(42)  # Static mock layout
    c.setFillColorRGB(0, 0, 0)
    
    # 1. Top-Left Finder
    c.rect(x, y + size - 12, 12, 12, fill=True, stroke=False)
    c.setFillColorRGB(1, 1, 1)
    c.rect(x + 2, y + size - 10, 8, 8, fill=True, stroke=False)
    c.setFillColorRGB(0, 0, 0)
    c.rect(x + 4, y + size - 8, 4, 4, fill=True, stroke=False)
    
    # 2. Top-Right Finder
    c.rect(x + size - 12, y + size - 12, 12, 12, fill=True, stroke=False)
    c.setFillColorRGB(1, 1, 1)
    c.rect(x + size - 10, y + size - 10, 8, 8, fill=True, stroke=False)
    c.setFillColorRGB(0, 0, 0)
    c.rect(x + size - 8, y + size - 8, 4, 4, fill=True, stroke=False)
    
    # 3. Bottom-Left Finder
    c.rect(x, y, 12, 12, fill=True, stroke=False)
    c.setFillColorRGB(1, 1, 1)
    c.rect(x + 2, y + 2, 8, 8, fill=True, stroke=False)
    c.setFillColorRGB(0, 0, 0)
    c.rect(x + 4, y + 4, 4, 4, fill=True, stroke=False)
    
    # 4. Random data pixels
    for col in range(3, int(size/2) - 3):
        for row in range(3, int(size/2) - 3):
            if random.choice([True, False]):
                c.rect(x + col*2, y + row*2, 2, 2, fill=True, stroke=False)

import unicodedata

def clean_text(text: str) -> str:
    if not text:
        return ""
    # Convert Indian Rupee symbol to standard Latin Rs.
    text = text.replace("₹", "Rs. ")
    # Decompose unicode accents/scripts into Latin-1 compatibility
    normalized = unicodedata.normalize('NFKD', text)
    cleaned = []
    for char in normalized:
        if ord(char) <= 255:
            cleaned.append(char)
        else:
            cleaned.append(" ")
    return "".join(cleaned)

def generate_thermal_receipt(transaction: Transaction, settings: StoreSettings, output_dir: str = "reports") -> str:
    # Ensure directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    filename = f"{transaction.invoice_number}.pdf"
    file_path = os.path.join(output_dir, filename)
    
    # 80mm thermal receipt width in points
    width = 226
    
    # Calculate dynamic height
    header_height = 145
    item_height = len(transaction.items) * 26
    
    # Calculate unique GST rates for tax split breakdown table
    unique_rates = set(item.gst_rate for item in transaction.items)
    gst_breakdown_height = 32 + (len(unique_rates) * 12)
    
    totals_height = 85
    barcode_height = 65
    footer_height = 55
    
    height = header_height + item_height + gst_breakdown_height + totals_height + barcode_height + footer_height
    
    # Create canvas
    c = canvas.Canvas(file_path, pagesize=(width, height))
    c.setTitle(transaction.invoice_number)
    
    y = height - 12
    margin = 10
    printable_width = width - (2 * margin)
    
    # 1. Store Logo & Header
    if settings.logo_path and os.path.exists(settings.logo_path):
        try:
            # Draw logo at center
            c.drawImage(settings.logo_path, (width / 2) - 20, y - 25, width=40, height=25, preserveAspectRatio=True)
            y -= 30
        except Exception:
            pass
            
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width / 2, y, clean_text(settings.store_name))
    y -= 13
    
    c.setFont("Helvetica", 7)
    if settings.address:
        addr_lines = settings.address.split("\n")
        for line in addr_lines[:2]:
            c.drawCentredString(width / 2, y, clean_text(line.strip()))
            y -= 8
            
    if settings.contact_info:
        c.drawCentredString(width / 2, y, clean_text(f"Ph: {settings.contact_info}"))
        y -= 8
        
    if settings.gst_number:
        c.drawCentredString(width / 2, y, clean_text(f"GSTIN: {settings.gst_number}"))
        y -= 8
        
    # Divider
    c.setLineWidth(0.5)
    c.setStrokeColorRGB(0.3, 0.3, 0.3)
    y -= 2
    c.line(margin, y, width - margin, y)
    y -= 9
    
    # 2. Invoice & Customer Details
    c.setFont("Helvetica-Bold", 7)
    c.drawString(margin, y, clean_text(f"Invoice: {transaction.invoice_number}"))
    
    from datetime import timezone as dt_timezone
    utc_ts = transaction.timestamp.replace(tzinfo=dt_timezone.utc) if transaction.timestamp.tzinfo is None else transaction.timestamp
    local_ts = utc_ts.astimezone()
    c.drawRightString(width - margin, y, local_ts.strftime("%d-%m-%Y %I:%M %p"))
    y -= 9
    
    if transaction.customer_phone:
        c.setFont("Helvetica", 7)
        c.drawString(margin, y, clean_text(f"Customer: {transaction.customer_name or 'Valued Customer'}"))
        c.drawRightString(width - margin, y, clean_text(f"Phone: {transaction.customer_phone}"))
        y -= 8
        
        # Calculate points
        points_earned = int(transaction.grand_total // 100)
        c.drawString(margin, y, clean_text(f"Loyalty Points Gained: +{points_earned}"))
        y -= 8
        
    # Table headers
    y -= 3
    c.line(margin, y, width - margin, y)
    y -= 9
    c.setFont("Helvetica-Bold", 7)
    c.drawString(margin, y, "Item Details")
    y -= 7
    c.drawString(margin, y, "Qty x Price")
    c.drawString(margin + 75, y, "Disc%")
    c.drawString(margin + 120, y, "GST")
    c.drawRightString(width - margin, y, "Total")
    y -= 3
    c.line(margin, y, width - margin, y)
    y -= 9
    
    # 3. Item List
    c.setFont("Helvetica", 7)
    for item in transaction.items:
        product_name = item.product_name or "Retail Product"
        if len(product_name) > 26:
            product_name = product_name[:24] + ".."
            
        c.setFont("Helvetica-Bold", 7)
        c.drawString(margin, y, clean_text(product_name))
        y -= 8
        
        c.setFont("Helvetica", 7)
        c.drawString(margin, y, clean_text(f"{item.quantity} x {settings.currency_symbol}{item.unit_selling_price:.2f}"))
        c.drawString(margin + 75, y, f"{item.discount_rate:.0f}%")
        c.drawString(margin + 120, y, f"{item.gst_rate:.0f}%")
        c.drawRightString(width - margin, y, clean_text(f"{settings.currency_symbol}{item.total_amount:.2f}"))
        y -= 10
        
    c.line(margin, y, width - margin, y)
    y -= 9
    
    # 4. Indian GST splits (CGST & SGST 50/50 breakdown)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(margin, y, "Tax Split Summary:")
    y -= 8
    
    c.setFont("Helvetica", 6)
    c.drawString(margin, y, "Rate% | Taxable Amt | CGST Amt | SGST Amt")
    y -= 6
    
    # Group items by GST rate
    for rate in sorted(list(unique_rates)):
        rate_items = [item for item in transaction.items if item.gst_rate == rate]
        taxable_sum = sum(item.subtotal - item.discount_amount for item in rate_items)
        gst_sum = sum(item.gst_amount for item in rate_items)
        cgst_amt = gst_sum / 2.0
        sgst_amt = gst_sum / 2.0
        
        c.drawString(margin, y, clean_text(f"{rate:4.1f}% | {settings.currency_symbol}{taxable_sum:10.2f} | {settings.currency_symbol}{cgst_amt:7.2f} | {settings.currency_symbol}{sgst_amt:7.2f}"))
        y -= 8
        
    y -= 2
    c.line(margin, y, width - margin, y)
    y -= 9
    
    # 5. Financial Summary Block
    c.setFont("Helvetica", 7)
    c.drawString(margin, y, "Cart Subtotal:")
    c.drawRightString(width - margin, y, clean_text(f"{settings.currency_symbol}{transaction.subtotal:.2f}"))
    y -= 8
    
    c.drawString(margin, y, "Total GST tax:")
    c.drawRightString(width - margin, y, clean_text(f"{settings.currency_symbol}{transaction.gst_amount:.2f}"))
    y -= 8
    
    if transaction.discount_amount > 0:
        c.drawString(margin, y, "Total Discount:")
        c.drawRightString(width - margin, y, clean_text(f"-{settings.currency_symbol}{transaction.discount_amount:.2f}"))
        y -= 8
        
    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin, y, "GRAND TOTAL:")
    c.drawRightString(width - margin, y, clean_text(f"{settings.currency_symbol}{transaction.grand_total:.2f}"))
    y -= 10
    
    # 6. Savings Box (If customer saved money)
    if transaction.total_savings > 0:
        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(0.75)
        # Draw savings rectangle
        c.rect(margin, y - 11, printable_width, 10, fill=False, stroke=True)
        c.setFont("Helvetica-Bold", 6.5)
        c.drawCentredString(width / 2, y - 8, clean_text(f"*** TOTAL SAVINGS TODAY: {settings.currency_symbol}{transaction.total_savings:.2f} ***"))
        y -= 17
    else:
        y -= 3
        
    c.setFont("Helvetica", 7)
    c.drawString(margin, y, clean_text(f"Payment Mode: {transaction.payment_method}"))
    c.drawRightString(width - margin, y, clean_text(f"Cashier: {transaction.cashier_username or 'Admin'}"))
    y -= 11
    
    # 7. Mock Barcode & QR Code
    draw_vector_barcode(c, margin + 10, y - 16, printable_width - 20, 15, transaction.invoice_number)
    y -= 22
    
    c.setFont("Helvetica", 6)
    c.drawCentredString(width / 2, y, clean_text(f"*{transaction.invoice_number}*"))
    y -= 14
    
    # QR Code for lookup
    draw_vector_qr_code(c, (width / 2) - 15, y - 30, 30)
    y -= 36
    
    # 8. Receipt Footer
    c.setFont("Helvetica-Oblique", 7)
    c.drawCentredString(width / 2, y, clean_text(settings.invoice_footer))
    y -= 8
    c.drawCentredString(width / 2, y, "Thank you! Powered by SmartStock AI")
    
    c.showPage()
    c.save()
    
    return f"reports/{filename}"
