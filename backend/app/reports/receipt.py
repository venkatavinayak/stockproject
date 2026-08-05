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
    
    # 80mm thermal receipt width in points (around 226 points)
    width = 226
    
    # Group items by their GST rate
    unique_rates = sorted(list(set(item.gst_rate for item in transaction.items)))
    grouped_items = {rate: [item for item in transaction.items if item.gst_rate == rate] for rate in unique_rates}
    
    # Calculate heights dynamically
    header_height = 135
    if settings.address:
        header_height += 16
    if settings.gst_number:
        header_height += 8
        
    item_rows_height = (len(unique_rates) * 12) + (len(transaction.items) * 9)
    summary_height = 20
    gst_breakdown_height = 38 + (len(unique_rates) * 9) + 15
    payment_height = 25
    savings_height = 20 if transaction.total_savings > 0 else 0
    barcode_height = 50
    footer_height = 30
    upi_card_height = 95 if transaction.payment_method == "UPI" else 0
    
    height = header_height + item_rows_height + summary_height + gst_breakdown_height + payment_height + savings_height + barcode_height + footer_height + upi_card_height
    
    # Create canvas
    c = canvas.Canvas(file_path, pagesize=(width, height))
    c.setTitle(transaction.invoice_number)
    
    y = height - 12
    margin = 8
    printable_width = width - (2 * margin)
    
    # Draw dashed line helper
    def draw_dashed_line(y_pos):
        c.setLineWidth(0.5)
        c.setStrokeColorRGB(0.5, 0.5, 0.5)
        c.setDash([1.5, 1.5])
        c.line(margin, y_pos, width - margin, y_pos)
        c.setDash() # Reset
        
    # 1. Store Header & Company Info
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y, clean_text(settings.store_name))
    y -= 15
    
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(width / 2, y, "Avenue Supermarts Ltd")
    y -= 8
    
    if settings.gst_number:
        c.drawCentredString(width / 2, y, f"GSTIN : {settings.gst_number}")
        y -= 8
        
    c.drawCentredString(width / 2, y, "CIN No : L51900MH2000PLC126473")
    y -= 8
    
    # Store Location Details
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString(width / 2, y, "TAX INVOICE")
    y -= 9
    
    c.setFont("Helvetica", 6.5)
    if settings.address:
        addr_lines = [l.strip() for l in settings.address.split(",") if l.strip()]
        addr_str1 = ", ".join(addr_lines[:3])
        addr_str2 = ", ".join(addr_lines[3:6])
        if addr_str1:
            c.drawCentredString(width / 2, y, clean_text(addr_str1))
            y -= 8
        if addr_str2:
            c.drawCentredString(width / 2, y, clean_text(addr_str2))
            y -= 8
            
    if settings.contact_info:
        c.drawCentredString(width / 2, y, clean_text(f"Phone: {settings.contact_info}"))
        y -= 8
        
    draw_dashed_line(y)
    y -= 8
    
    # 2. Invoice Metadata Block
    c.setFont("Helvetica", 6.5)
    c.drawString(margin, y, f"Bill No : {transaction.invoice_number}")
    
    from datetime import timezone as dt_timezone
    utc_ts = transaction.timestamp.replace(tzinfo=dt_timezone.utc) if transaction.timestamp.tzinfo is None else transaction.timestamp
    local_ts = utc_ts.astimezone()
    c.drawRightString(width - margin, y, f"Bill Dt : {local_ts.strftime('%d/%m/%Y %I:%M%p')}")
    y -= 8
    
    c.drawString(margin, y, f"Vou. No : {transaction.invoice_number[-6:]}")
    c.drawRightString(width - margin, y, f"Cashier : {transaction.cashier_username or 'Admin'}")
    y -= 8
    
    draw_dashed_line(y)
    y -= 8
    
    # 3. Product Columns Header
    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(margin, y, "HSN")
    c.drawString(margin + 32, y, "Particulars")
    c.drawRightString(margin + 135, y, "Qty")
    c.drawRightString(margin + 170, y, "Rate")
    c.drawRightString(width - margin, y, "Value")
    y -= 4
    draw_dashed_line(y)
    y -= 8
    
    # 4. Product List Grouped by GST rate
    c.setFont("Helvetica", 6.5)
    for idx, rate in enumerate(unique_rates, 1):
        rate_header = f"{idx}) CGST @ {rate/2.0:.2f}%, SGST @ {rate/2.0:.2f}%"
        c.setFont("Helvetica-Bold", 6.5)
        c.drawString(margin, y, rate_header)
        y -= 8
        
        c.setFont("Helvetica", 6.5)
        for item in grouped_items[rate]:
            barcode_short = (item.product_barcode or "000000")[-6:]
            name_str = item.product_name or "Retail Item"
            if len(name_str) > 17:
                name_str = name_str[:15] + ".."
                
            c.drawString(margin, y, clean_text(barcode_short))
            c.drawString(margin + 32, y, clean_text(name_str))
            c.drawRightString(margin + 135, y, f"{item.quantity}")
            c.drawRightString(margin + 170, y, f"{item.unit_selling_price:.2f}")
            c.drawRightString(width - margin, y, f"{item.total_amount:.2f}")
            y -= 9
            
    draw_dashed_line(y)
    y -= 8
    
    # 5. Items Summary Row
    total_qty = sum(item.quantity for item in transaction.items)
    total_items = len(transaction.items)
    
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(margin, y, f"Items: {total_items}")
    c.drawString(margin + 70, y, f"Qty: {total_qty}")
    c.drawRightString(width - margin, y, f"{transaction.grand_total:.2f}")
    y -= 4
    draw_dashed_line(y)
    y -= 8
    
    # 6. GST Breakup Details Table
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(width / 2, y, "<---------- GST Breakup Details -----------> (Amount INR)")
    y -= 9
    
    c.setFont("Helvetica-Bold", 6)
    c.drawString(margin, y, "GST")
    c.drawString(margin + 25, y, "Taxable")
    c.drawCentredString(margin + 80, y, "CGST")
    c.drawCentredString(margin + 120, y, "SGST")
    c.drawCentredString(margin + 160, y, "CESS")
    c.drawRightString(width - margin, y, "Total")
    y -= 7
    
    c.drawString(margin, y, "IND")
    c.drawString(margin + 25, y, "Amount")
    c.drawCentredString(margin + 80, y, "Amount")
    c.drawCentredString(margin + 120, y, "Amount")
    c.drawCentredString(margin + 160, y, "Amount")
    c.drawRightString(width - margin, y, "Amount")
    y -= 4
    draw_dashed_line(y)
    y -= 8
    
    c.setFont("Helvetica", 6)
    sum_taxable = 0.0
    sum_cgst = 0.0
    sum_sgst = 0.0
    sum_total = 0.0
    
    for idx, rate in enumerate(unique_rates, 1):
        rate_items = grouped_items[rate]
        taxable_amt = sum(item.subtotal - item.discount_amount for item in rate_items)
        gst_amt = sum(item.gst_amount for item in rate_items)
        cgst_amt = gst_amt / 2.0
        sgst_amt = gst_amt / 2.0
        row_total = taxable_amt + gst_amt
        
        sum_taxable += taxable_amt
        sum_cgst += cgst_amt
        sum_sgst += sgst_amt
        sum_total += row_total
        
        c.drawString(margin, y, f"{idx}")
        c.drawString(margin + 25, y, f"{taxable_amt:.2f}")
        c.drawCentredString(margin + 80, y, f"{cgst_amt:.2f}" if cgst_amt > 0 else "....")
        c.drawCentredString(margin + 120, y, f"{sgst_amt:.2f}" if sgst_amt > 0 else "....")
        c.drawCentredString(margin + 160, y, "....")
        c.drawRightString(width - margin, y, f"{row_total:.2f}")
        y -= 9
        
    draw_dashed_line(y)
    y -= 8
    
    # Total row
    c.setFont("Helvetica-Bold", 6)
    c.drawString(margin, y, "T:")
    c.drawString(margin + 25, y, f"{sum_taxable:.2f}")
    c.drawCentredString(margin + 80, y, f"{sum_cgst:.2f}")
    c.drawCentredString(margin + 120, y, f"{sum_sgst:.2f}")
    c.drawCentredString(margin + 160, y, "....")
    c.drawRightString(width - margin, y, f"{sum_total:.2f}")
    y -= 4
    draw_dashed_line(y)
    y -= 8
    
    # 7. Payment Received Section
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(width / 2, y, "<----- Amount Received From Customer ----->")
    y -= 9
    
    c.setFont("Helvetica-Bold", 7.5)
    pm_str = f"{transaction.payment_method} Payment :"
    c.drawString(margin, y, pm_str)
    c.drawRightString(width - margin, y, f"{transaction.grand_total:.2f} /-")
    y -= 4
    draw_dashed_line(y)
    y -= 8
    
    # 8. Total Savings Callout Box
    if transaction.total_savings > 0:
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(width / 2, y, f"** Saved Rs. {transaction.total_savings:.2f}/- On MRP **")
        y -= 8
        draw_dashed_line(y)
        y -= 8
        
    # 9. Barcode
    draw_vector_barcode(c, margin + 15, y - 15, printable_width - 30, 12, transaction.invoice_number)
    y -= 21
    
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(width / 2, y, "This is computer generated invoice.")
    y -= 4
    draw_dashed_line(y)
    y -= 8
    
    # 10. UPI Merchant Card Receipt (If Paid via UPI)
    if transaction.payment_method == "UPI":
        c.setFont("Helvetica-Bold", 6.5)
        c.drawCentredString(width / 2, y, "ICICI UPI")
        y -= 8
        c.setFont("Helvetica", 6)
        c.drawCentredString(width / 2, y, clean_text(settings.store_name))
        y -= 7
        c.drawCentredString(width / 2, y, "HYDERABAD")
        y -= 7
        c.drawCentredString(width / 2, y, f"Date/Time : {local_ts.strftime('%d-%m-%YT%H:%M:%S')}")
        y -= 7
        
        # Deterministic dummy transaction details
        random.seed(hash(transaction.invoice_number))
        mid = random.randint(10000000, 99999999)
        batch = random.randint(100000, 999999)
        roc = random.randint(100000, 999999)
        txn_id = random.randint(10000000, 99999999)
        
        c.drawCentredString(width / 2, y, f"MID : {mid}")
        y -= 7
        c.drawCentredString(width / 2, y, f"Batch ID : {batch}")
        y -= 7
        c.drawCentredString(width / 2, y, f"ROC : {roc}")
        y -= 7
        c.drawCentredString(width / 2, y, "UPI SALE COMPLETE")
        y -= 7
        c.drawCentredString(width / 2, y, f"Bill No : {transaction.invoice_number}")
        y -= 7
        c.drawCentredString(width / 2, y, f"TXN ID : {txn_id}")
        y -= 7
        draw_dashed_line(y)
        y -= 8
        
    # 11. Invoice Footer
    c.setFont("Helvetica-Oblique", 6.5)
    c.drawCentredString(width / 2, y, clean_text(settings.invoice_footer))
    y -= 8
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(width / 2, y, "Thank you! Powered by SmartStock AI")
    
    c.showPage()
    c.save()
    
    return f"reports/{filename}"
