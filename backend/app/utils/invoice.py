from datetime import datetime
import re
from backend.app.models.transaction import Transaction

async def generate_invoice_number() -> str:
    # Format today's date
    today_str = datetime.now().strftime("%Y%m%d")
    prefix = f"INV-{today_str}-"
    
    # Count invoices already generated today using regex match
    reg = re.compile(f"^{re.escape(prefix)}")
    count = await Transaction.find({"invoice_number": reg}).count()
    
    # Generate sequential 4-digit number
    next_number = count + 1
    return f"{prefix}{next_number:04d}"
