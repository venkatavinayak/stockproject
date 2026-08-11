import os
from datetime import datetime
import unicodedata
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

def clean_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace("₹", "Rs. ")
    normalized = unicodedata.normalize('NFKD', text)
    cleaned = []
    for char in normalized:
        if ord(char) <= 255:
            cleaned.append(char)
        else:
            cleaned.append(" ")
    return "".join(cleaned)

class NumberedCanvas(canvas.Canvas):
    """Canvas wrapper to draw page numbers and background decorations."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor('#64748b'))
        
        # Header text
        self.drawString(54, 800, "SmartStock AI - Detailed Sales & Inventory Operations Report")
        self.setStrokeColor(colors.HexColor('#e2e8f0'))
        self.setLineWidth(0.5)
        self.line(54, 792, 541, 792)
        
        # Footer text
        self.line(54, 50, 541, 50)
        self.drawString(54, 38, f"Generated on: {datetime.now().strftime('%d %b %Y, %I:%M %p')}")
        self.drawRightString(541, 38, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def generate_full_report_pdf(
    period: str,
    start_date: datetime,
    end_date: datetime,
    kpis: dict,
    transactions: list,
    returns: list,
    expenses: list,
    inv_history: list,
    products: list,
    settings: any,
    output_dir: str = "reports"
) -> str:
    os.makedirs(output_dir, exist_ok=True)
    filename = f"Operations_Report_{period}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    file_path = os.path.join(output_dir, filename)

    doc = SimpleDocTemplate(
        file_path,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )

    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1e1b4b'),
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#475569'),
        spaceAfter=15
    )
    
    h1_style = ParagraphStyle(
        'DocH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#4f46e5'),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )
    
    cell_style = ParagraphStyle(
        'DocCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#1e293b')
    )
    
    cell_bold_style = ParagraphStyle(
        'DocCellBold',
        parent=cell_style,
        fontName='Helvetica-Bold'
    )
    
    cell_header_style = ParagraphStyle(
        'DocCellHeader',
        parent=cell_style,
        fontName='Helvetica-Bold',
        textColor=colors.white
    )

    story = []

    # Title Banner
    story.append(Paragraph(clean_text(settings.store_name), title_style))
    story.append(Paragraph(
        f"DETAILED OPERATIONS & PERFORMANCE REPORT - {period.upper()} ANALYTICS<br/>"
        f"<b>Reporting Interval:</b> {start_date.strftime('%d %b %Y')} to {end_date.strftime('%d %b %Y')}",
        subtitle_style
    ))
    
    # Section 1: Executive Summary (KPIs)
    story.append(Paragraph("1. Executive Summary & KPIs", h1_style))
    
    kpi_data = [
        [
            Paragraph("Metric", cell_header_style),
            Paragraph("Value", cell_header_style),
            Paragraph("Inventory Metric", cell_header_style),
            Paragraph("Value", cell_header_style)
        ],
        [
            Paragraph("Total Revenue", cell_style),
            Paragraph(f"Rs. {kpis.get('today_revenue', 0.0):,.2f}", cell_bold_style),
            Paragraph("Inventory Value (Retail)", cell_style),
            Paragraph(f"Rs. {kpis.get('inventory_value', 0.0):,.2f}", cell_style)
        ],
        [
            Paragraph("Total Profit", cell_style),
            Paragraph(f"Rs. {kpis.get('today_profit', 0.0):,.2f}", cell_bold_style),
            Paragraph("Current Stock Cost", cell_style),
            Paragraph(f"Rs. {kpis.get('current_stock_value', 0.0):,.2f}", cell_style)
        ],
        [
            Paragraph("Logged Expenses", cell_style),
            Paragraph(f"Rs. {kpis.get('today_expenses', 0.0):,.2f}", cell_style),
            Paragraph("Potential Stock Margin", cell_style),
            Paragraph(f"Rs. {kpis.get('potential_profit', 0.0):,.2f}", cell_style)
        ],
        [
            Paragraph("Net Profit", cell_style),
            Paragraph(f"Rs. {kpis.get('net_profit', 0.0):,.2f}", cell_bold_style),
            Paragraph("Total Invoices Issued", cell_style),
            Paragraph(str(kpis.get('bills_today', 0)), cell_style)
        ],
        [
            Paragraph("Total Items Sold", cell_style),
            Paragraph(str(kpis.get('items_sold', 0)), cell_style),
            Paragraph("Average Order Value", cell_style),
            Paragraph(f"Rs. {kpis.get('average_bill', 0.0):,.2f}", cell_style)
        ]
    ]
    
    kpi_table = Table(kpi_data, colWidths=[140, 100, 140, 100])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#4f46e5')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8fafc')),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 15))

    # Section 2: Detailed Billing & Sales Logs (shows nested item lists!)
    story.append(Paragraph(f"2. Billing & Customer Sales Logs ({len(transactions)} Records)", h1_style))
    if not transactions:
        story.append(Paragraph("No billing invoices logged in this period.", cell_style))
    else:
        tx_data = [
            [
                Paragraph("Invoice Details / Items Purchased", cell_header_style),
                Paragraph("Qty", cell_header_style),
                Paragraph("Price", cell_header_style),
                Paragraph("Tax/Disc", cell_header_style),
                Paragraph("Total Cost", cell_header_style),
                Paragraph("Net Profit", cell_header_style)
            ]
        ]
        from datetime import timezone as dt_timezone
        for tx in transactions:
            cust_details = []
            if tx.customer_name: cust_details.append(tx.customer_name)
            if tx.customer_phone: cust_details.append(tx.customer_phone)
            if tx.customer_email: cust_details.append(tx.customer_email)
            
            cust_info = f" - Customer: {', '.join(cust_details)}" if cust_details else ""
            utc_ts = tx.timestamp.replace(tzinfo=dt_timezone.utc) if tx.timestamp.tzinfo is None else tx.timestamp
            local_ts = utc_ts.astimezone()
            formatted_time = local_ts.strftime('%d-%m-%Y %I:%M %p')
            cashier_info = f" (Cashier: {tx.cashier_username or 'Admin'})"
            header_text = f"<b>Invoice #{tx.invoice_number}</b> - {formatted_time} - {tx.payment_method}{cust_info}{cashier_info}"
            tx_data.append([
                Paragraph(header_text, ParagraphStyle('TxHeader', parent=cell_bold_style, textColor=colors.HexColor('#1e1b4b'))),
                Paragraph("", cell_style),
                Paragraph("", cell_style),
                Paragraph("", cell_style),
                Paragraph(f"<b>Rs. {tx.grand_total:,.2f}</b>", cell_bold_style),
                Paragraph(f"<b>Rs. {tx.profit:,.2f}</b>", cell_bold_style)
            ])
            for item in tx.items:
                item_details = f"   &bull; {item.product_name or 'Product'}"
                tx_data.append([
                    Paragraph(clean_text(item_details), cell_style),
                    Paragraph(str(item.quantity), cell_style),
                    Paragraph(f"Rs. {item.unit_selling_price:.2f}", cell_style),
                    Paragraph(f"GST: {item.gst_rate:.0f}% / Disc: {item.discount_rate:.0f}%", cell_style),
                    Paragraph(f"Rs. {item.total_amount:.2f}", cell_style),
                    Paragraph(f"Rs. {item.profit:.2f}", cell_style)
                ])
                
        tx_table = Table(tx_data, colWidths=[200, 35, 65, 110, 65, 65])
        
        # Apply programmatic spanning and row backgrounds for transaction headers
        t_style = [
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e1b4b')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ]
        curr_row = 1
        for tx in transactions:
            # Transaction Header Row Style
            t_style.append(('SPAN', (0, curr_row), (3, curr_row)))
            t_style.append(('BACKGROUND', (0, curr_row), (-1, curr_row), colors.HexColor('#f1f5f9')))
            curr_row += 1
            # Items background style
            for _ in tx.items:
                t_style.append(('BACKGROUND', (0, curr_row), (-1, curr_row), colors.white))
                curr_row += 1
                
        tx_table.setStyle(TableStyle(t_style))
        story.append(tx_table)
    story.append(Spacer(1, 15))

    # Section 3: Refunds & Returns
    story.append(Paragraph(f"3. Refunds & Returns ({len(returns)} Records)", h1_style))
    if not returns:
        story.append(Paragraph("No product returns/refunds registered in this period.", cell_style))
    else:
        ret_data = [
            [
                Paragraph("Refund Details", cell_header_style),
                Paragraph("Product Name", cell_header_style),
                Paragraph("Quantity", cell_header_style),
                Paragraph("Refund Paid", cell_header_style),
                Paragraph("Return Reason", cell_header_style)
            ]
        ]
        from datetime import timezone as dt_timezone
        for r in returns:
            details = r.get("details", "INV-REF") if isinstance(r, dict) else getattr(r, "details", "INV-REF")
            prod = r.get("product") if isinstance(r, dict) else getattr(r, "product", None)
            prod_name = prod.get("name", "Product") if prod else "Product"
            quantity = r.get("quantity", 0) if isinstance(r, dict) else getattr(r, "quantity", 0)
            refund_amount = r.get("refund_amount", 0.0) if isinstance(r, dict) else getattr(r, "refund_amount", 0.0)
            reason = r.get("reason", "") if isinstance(r, dict) else getattr(r, "reason", "")
            
            # Format return timestamp
            r_ts = r.get("timestamp") if isinstance(r, dict) else getattr(r, "timestamp", None)
            formatted_time = ""
            if r_ts:
                utc_ts = r_ts.replace(tzinfo=dt_timezone.utc) if r_ts.tzinfo is None else r_ts
                local_ts = utc_ts.astimezone()
                formatted_time = local_ts.strftime('%d-%m-%Y %I:%M %p')
                
            cust_name = r.get("customer_name") if isinstance(r, dict) else getattr(r, "customer_name", None)
            cust_phone = r.get("customer_phone") if isinstance(r, dict) else getattr(r, "customer_phone", None)
            cust_email = r.get("customer_email") if isinstance(r, dict) else getattr(r, "customer_email", None)
            
            cust_details = []
            if cust_name: cust_details.append(cust_name)
            if cust_phone: cust_details.append(cust_phone)
            if cust_email: cust_details.append(cust_email)
            
            cust_str = f"<br/><font color='#4b5563'>Cust: {', '.join(cust_details)}</font>" if cust_details else ""
            time_str = f"<br/><font color='#4b5563'>Date: {formatted_time}</font>" if formatted_time else ""
            
            refund_details_html = f"<b>{details}</b>{time_str}{cust_str}"
            
            ret_data.append([
                Paragraph(refund_details_html, cell_style),
                Paragraph(clean_text(prod_name), cell_style),
                Paragraph(str(quantity), cell_style),
                Paragraph(f"Rs. {refund_amount:,.2f}", cell_bold_style),
                Paragraph(clean_text(reason), cell_style)
            ])
        ret_table = Table(ret_data, colWidths=[150, 110, 35, 75, 110])
        ret_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#b91c1c')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
        ]))
        story.append(ret_table)
    story.append(Spacer(1, 15))

    # Section 4: Inventory Movements
    story.append(Paragraph(f"4. Inventory Movements & Restocks ({len(inv_history)} Records)", h1_style))
    if not inv_history:
        story.append(Paragraph("No inventory movements logged in this period.", cell_style))
    else:
        inv_data = [
            [
                Paragraph("Product Name", cell_header_style),
                Paragraph("Event", cell_header_style),
                Paragraph("Qty Change", cell_header_style),
                Paragraph("Stock After", cell_header_style),
                Paragraph("Movement Log", cell_header_style)
            ]
        ]
        for ih in inv_history:
            inv_data.append([
                Paragraph(clean_text(ih.product_name or "Product"), cell_bold_style),
                Paragraph(ih.event, cell_style),
                Paragraph(f"{ih.quantity_change:+d}", cell_style),
                Paragraph(str(ih.stock_after), cell_style),
                Paragraph(clean_text(ih.details or "N/A"), cell_style)
            ])
        inv_table = Table(inv_data, colWidths=[120, 60, 55, 55, 190])
        inv_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f766e')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
        ]))
        story.append(inv_table)
    story.append(Spacer(1, 15))

    # Section 5: Detailed Inventory Catalog (shows every item in stock and total value!)
    story.append(Paragraph(f"5. Complete Inventory Catalog & Valuation ({len(products)} Items)", h1_style))
    if not products:
        story.append(Paragraph("No products registered in catalog.", cell_style))
    else:
        prod_data = [
            [
                Paragraph("Product Name", cell_header_style),
                Paragraph("Barcode", cell_header_style),
                Paragraph("Buying Cost", cell_header_style),
                Paragraph("Selling Price", cell_header_style),
                Paragraph("In Stock Level", cell_header_style),
                Paragraph("Total Valuation", cell_header_style)
            ]
        ]
        total_stock = 0
        total_valuation = 0.0
        for p in products:
            val = p.current_stock * p.selling_price
            total_stock += p.current_stock
            total_valuation += val
            prod_data.append([
                Paragraph(clean_text(p.name), cell_bold_style),
                Paragraph(p.barcode or "N/A", cell_style),
                Paragraph(f"Rs. {p.buying_price:.2f}", cell_style),
                Paragraph(f"Rs. {p.selling_price:.2f}", cell_style),
                Paragraph(f"{p.current_stock} units", cell_style),
                Paragraph(f"Rs. {val:,.2f}", cell_bold_style)
            ])
            
        # Total Summary Row
        prod_data.append([
            Paragraph("<b>TOTAL CATALOG STATUS</b>", cell_bold_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph(f"<b>{total_stock} units</b>", cell_bold_style),
            Paragraph(f"<b>Rs. {total_valuation:,.2f}</b>", cell_bold_style)
        ])
        
        prod_table = Table(prod_data, colWidths=[150, 75, 70, 70, 75, 90])
        prod_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0369a1')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f1f5f9')),
            ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor('#f8fafc')])
        ]))
        story.append(prod_table)
    story.append(Spacer(1, 15))

    # Section 6: Expenses
    story.append(Paragraph(f"6. Expenses Summary ({len(expenses)} Records)", h1_style))
    if not expenses:
        story.append(Paragraph("No expenses registered in this period.", cell_style))
    else:
        exp_data = [
            [
                Paragraph("Expense Category", cell_header_style),
                Paragraph("Description", cell_header_style),
                Paragraph("Amount", cell_header_style)
            ]
        ]
        for exp in expenses:
            exp_data.append([
                Paragraph(clean_text(exp.category), cell_bold_style),
                Paragraph(clean_text(exp.description or "No description"), cell_style),
                Paragraph(f"Rs. {exp.amount:,.2f}", cell_style)
            ])
        exp_table = Table(exp_data, colWidths=[140, 240, 100])
        exp_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#6d28d9')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
        ]))
        story.append(exp_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    return f"reports/{filename}"
