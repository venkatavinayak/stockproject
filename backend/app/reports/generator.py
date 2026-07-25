import os
import io
from datetime import datetime, date
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.models.product import Product
from backend.app.models.transaction import Transaction
from backend.app.models.transaction_item import TransactionItem
from backend.app.models.expense import Expense
from backend.app.models.settings import StoreSettings
from backend.app.models.returns import Return

def build_pdf_report(
    db: Session,
    report_type: str,  # Daily, Weekly, Monthly, Yearly, Custom
    start_date: date,
    end_date: date,
    output_dir: str = "reports"
) -> str:
    os.makedirs(output_dir, exist_ok=True)
    filename = f"report_{report_type.lower()}_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.pdf"
    file_path = os.path.join(output_dir, filename)
    
    settings = db.query(StoreSettings).first() or StoreSettings(store_name="SmartStock AI")
    currency = settings.currency_symbol
    
    # Setup document
    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=28,
        textColor=colors.HexColor('#1E293B'),
        leading=34,
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'CoverSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=14,
        textColor=colors.HexColor('#64748B'),
        leading=18,
        spaceAfter=30
    )
    
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=15,
        spaceAfter=10,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'ReportBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor('#334155'),
        leading=14,
        spaceAfter=8
    )
    
    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=11
    )
    
    cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=cell_style,
        fontName='Helvetica-Bold'
    )
    
    story = []
    
    # ------------------ COVER PAGE ------------------
    story.append(Spacer(1, 1.5 * inch))
    story.append(Paragraph(f"{settings.store_name}", title_style))
    story.append(Paragraph(f"{report_type} Business Performance Report", subtitle_style))
    
    metadata_data = [
        [Paragraph("Date Range:", cell_bold), Paragraph(f"{start_date.strftime('%d-%m-%Y')} to {end_date.strftime('%d-%m-%Y')}", cell_style)],
        [Paragraph("Generated On:", cell_bold), Paragraph(datetime.now().strftime("%d-%m-%Y %H:%M"), cell_style)],
        [Paragraph("Report Type:", cell_bold), Paragraph(f"Retail ERP Automated Analytics", cell_style)],
        [Paragraph("GSTIN:", cell_bold), Paragraph(settings.gst_number or "N/A", cell_style)],
    ]
    meta_table = Table(metadata_data, colWidths=[1.5 * inch, 4.0 * inch])
    meta_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)
    
    story.append(Spacer(1, 2 * inch))
    
    # Footer message on cover
    story.append(Paragraph("CONFIDENTIAL BUSINESS REPORT - FOR INTERNAL USE ONLY", ParagraphStyle(
        'Confidential', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor('#94A3B8'), alignment=1
    )))
    story.append(PageBreak())
    
    # ------------------ EXECUTIVE SUMMARY ------------------
    story.append(Paragraph("1. Executive Financial Summary", h1_style))
    
    # Fetch aggregates
    sales_data = db.query(
        func.sum(Transaction.grand_total).label("revenue"),
        func.sum(Transaction.buying_cost).label("cost"),
        func.sum(Transaction.profit).label("profit"),
        func.count(Transaction.id).label("bills")
    ).filter(Transaction.timestamp >= start_date, Transaction.timestamp <= datetime.combine(end_date, datetime.max.time())).first()
    
    rev = float(sales_data.revenue or 0.0)
    cost = float(sales_data.cost or 0.0)
    gross_profit = float(sales_data.profit or 0.0)
    bills = int(sales_data.bills or 0)
    
    expenses_val = db.query(func.sum(Expense.amount)).filter(Expense.date >= start_date, Expense.date <= end_date).scalar() or 0.0
    net_profit = gross_profit - expenses_val
    
    items_sold = db.query(func.sum(TransactionItem.quantity)).join(Transaction).filter(
        Transaction.timestamp >= start_date, Transaction.timestamp <= datetime.combine(end_date, datetime.max.time())
    ).scalar() or 0
    
    summary_data = [
        [Paragraph("Metric", cell_bold), Paragraph("Value", cell_bold), Paragraph("Operational Impact", cell_bold)],
        [Paragraph("Total Revenue", cell_style), Paragraph(f"{currency}{rev:,.2f}", cell_style), Paragraph("Total billing sales logged", cell_style)],
        [Paragraph("Cost of Goods Sold (COGS)", cell_style), Paragraph(f"{currency}{cost:,.2f}", cell_style), Paragraph("Supplier stock acquisition cost", cell_style)],
        [Paragraph("Gross Profit", cell_bold), Paragraph(f"{currency}{gross_profit:,.2f}", cell_bold), Paragraph("Revenue minus COGS", cell_bold)],
        [Paragraph("Logged Expenses", cell_style), Paragraph(f"{currency}{expenses_val:,.2f}", cell_style), Paragraph("Operational costs (Rent, Electricity, Rent, etc.)", cell_style)],
        [Paragraph("Net Profit", cell_bold), Paragraph(f"{currency}{net_profit:,.2f}", cell_bold), Paragraph("Net business earnings after operations", cell_bold)],
        [Paragraph("Total Bills Generated", cell_style), Paragraph(f"{bills}", cell_style), Paragraph("Invoices counter", cell_style)],
        [Paragraph("Total Items Sold", cell_style), Paragraph(f"{items_sold}", cell_style), Paragraph("Units dispatched", cell_style)],
    ]
    
    summary_table = Table(summary_data, colWidths=[2.2 * inch, 1.8 * inch, 3.0 * inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#3B82F6')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    
    # Set text colors in header row to white by overriding styling
    for i in range(3):
        summary_data[0][i].style.textColor = colors.white
        
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # ------------------ INVENTORY HEALTH & ALERTS ------------------
    story.append(Paragraph("2. Inventory Health and Alerts", h1_style))
    
    # Low stock query
    low_stock_items = db.query(Product).filter(Product.current_stock <= Product.minimum_stock).all()
    if low_stock_items:
        story.append(Paragraph("The following products are at or below minimum stock thresholds and require replenishment:", body_style))
        low_data = [[Paragraph("Barcode", cell_bold), Paragraph("Product Name", cell_bold), Paragraph("Brand", cell_bold), Paragraph("In Stock", cell_bold), Paragraph("Min Level", cell_bold)]]
        for p in low_stock_items[:15]:  # limit list to prevent overflow
            low_data.append([
                Paragraph(p.barcode, cell_style),
                Paragraph(p.name, cell_style),
                Paragraph(p.brand or "-", cell_style),
                Paragraph(str(p.current_stock), cell_style),
                Paragraph(str(p.minimum_stock), cell_style)
            ])
        low_table = Table(low_data, colWidths=[1.5 * inch, 2.5 * inch, 1.2 * inch, 0.9 * inch, 0.9 * inch])
        low_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#EF4444')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ]))
        for i in range(5):
            low_data[0][i].style.textColor = colors.white
        story.append(low_table)
    else:
        story.append(Paragraph("No low-stock alerts. All products are above minimum thresholds.", body_style))
        
    story.append(Spacer(1, 15))
    
    # Expiring products
    near_expiry = db.query(Product).filter(
        Product.expiry_date != None,
        Product.expiry_date <= (date.today() + timedelta(days=30))
    ).all()
    
    if near_expiry:
        story.append(Paragraph("The following products are expiring within the next 30 days:", body_style))
        exp_data = [[Paragraph("Barcode", cell_bold), Paragraph("Product Name", cell_bold), Paragraph("Expiry Date", cell_bold), Paragraph("In Stock", cell_bold)]]
        for p in near_expiry[:15]:
            exp_data.append([
                Paragraph(p.barcode, cell_style),
                Paragraph(p.name, cell_style),
                Paragraph(p.expiry_date.strftime("%d-%m-%Y") if p.expiry_date else "-", cell_style),
                Paragraph(str(p.current_stock), cell_style)
            ])
        exp_table = Table(exp_data, colWidths=[1.5 * inch, 3.0 * inch, 1.5 * inch, 1.0 * inch])
        exp_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F59E0B')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ]))
        for i in range(4):
            exp_data[0][i].style.textColor = colors.white
        story.append(exp_table)
    else:
        story.append(Paragraph("No upcoming expiries detected within the 30-day window.", body_style))
        
    story.append(PageBreak())
    
    # ------------------ TRANSACTION LOG ------------------
    story.append(Paragraph("3. Transaction Ledger", h1_style))
    story.append(Paragraph("Complete listing of transactions recorded during the period:", body_style))
    
    txs = db.query(Transaction).filter(
        Transaction.timestamp >= start_date,
        Transaction.timestamp <= datetime.combine(end_date, datetime.max.time())
    ).order_by(Transaction.timestamp.desc()).all()
    
    if txs:
        tx_data = [[
            Paragraph("Timestamp", cell_bold),
            Paragraph("Invoice No", cell_bold),
            Paragraph("Method", cell_bold),
            Paragraph("Items", cell_bold),
            Paragraph("Subtotal", cell_bold),
            Paragraph("GST", cell_bold),
            Paragraph("Discount", cell_bold),
            Paragraph("Grand Total", cell_bold),
            Paragraph("Profit", cell_bold)
        ]]
        for t in txs[:40]:  # limit listing to prevent overflow
            tx_data.append([
                Paragraph(t.timestamp.strftime("%d-%m %H:%M"), cell_style),
                Paragraph(t.invoice_number, cell_style),
                Paragraph(t.payment_method, cell_style),
                Paragraph(str(t.items_count), cell_style),
                Paragraph(f"{currency}{t.subtotal:.2f}", cell_style),
                Paragraph(f"{currency}{t.gst_amount:.2f}", cell_style),
                Paragraph(f"{currency}{t.discount_amount:.2f}", cell_style),
                Paragraph(f"{currency}{t.grand_total:.2f}", cell_bold),
                Paragraph(f"{currency}{t.profit:.2f}", cell_style)
            ])
            
        tx_table = Table(tx_data, colWidths=[1.1*inch, 1.0*inch, 0.6*inch, 0.5*inch, 0.8*inch, 0.6*inch, 0.8*inch, 0.9*inch, 0.7*inch])
        tx_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ]))
        for i in range(9):
            tx_data[0][i].style.textColor = colors.white
        story.append(tx_table)
        
        if len(txs) > 40:
            story.append(Spacer(1, 8))
            story.append(Paragraph(f"...and {len(txs) - 40} more transactions. Refer to the dashboard or CSV exports for the complete log.", ParagraphStyle('Note', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#64748B'))))
    else:
        story.append(Paragraph("No transactions found in this date range.", body_style))
        
    # Build Document
    def add_page_number(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.drawString(40, 30, f"{settings.store_name} - {report_type} Business Report")
        canvas.drawRightString(612 - 40, 30, f"Page {doc.page}")
        canvas.restoreState()
        
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    
    return f"reports/{filename}"
