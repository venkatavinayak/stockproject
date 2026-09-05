# 🛍️ SmartStore AI — Departmental Store ERP & POS Platform

Welcome to **SmartStore AI**, a modern, Enterprise Resource Planning (ERP) and Point-of-Sale (POS) management suite built specifically for retail stores, supermarkets, and departmental outlets. Designed with speed, elegance, and multi-tenant security at its core, SmartStore AI turns everyday store operations—from fast counter checkouts to inventory tracking and financial analytics—into an effortless, automated experience.

---

## 🌟 Overview & Highlights

SmartStore AI is built to bridge the gap between heavy, complex enterprise software and modern, accessible web apps. Whether you are running a single counter neighborhood market or managing a bustling retail chain with multiple cashiers, SmartStore AI keeps your inventory synced, your finances clear, and your customers delighted with instant digital PDF tax receipts.

### 🌐 Live Production Application
* **Store Management Portal**: [https://stockproject-vvk.netlify.app](https://stockproject-vvk.netlify.app)
* **Backend API Engine**: [https://stockproject-backend.onrender.com](https://stockproject-backend.onrender.com)

---

## ✨ Core Features & Modules

### 1. ⚡ High-Speed Point of Sale (POS) Billing
* **Barcode & Quick Search**: Instant product lookup via physical USB/wireless barcode scanners or name suggestions.
* **Keyboard Hotkeys**: Lightning-fast cashier workflow (`F2` to focus search, `F12` for instant cash checkout).
* **Multi-Payment Settlement**: Full support for Cash, UPI QR code, Credit/Debit Cards, and Mixed payments.
* **Dynamic GST & Discount Math**: Auto-calculates tax breakdown (CGST/SGST splits) and savings discounts per line item.
* **Thermal & A4 Invoice Printing**: Crisp vector thermal receipt generation (80mm format) complete with item barcodes and store branding.

### 2. 📧 Automated PDF Email Receipts
* **Direct Customer Dispatch**: Automatically compiles and emails digital PDF tax invoices directly to the customer's inbox upon checkout.
* **High-Reliability SMTP Delivery**: Built-in Gmail SMTP integration with automatic port fallback (Port 587 TLS & Port 465 SSL) ensuring zero missed emails.

### 3. 📦 Real-Time Inventory & Stock Management
* **Stock Movement Tracking**: Real-time quantity deductions during sales with complete audit logging.
* **Low Stock Alerts**: Visual notifications when products hit minimum threshold boundaries.
* **Batch Import & Export**: Bulk inventory updates via Excel `.xlsx` spreadsheets.
* **Supplier & Category Cataloging**: Group products cleanly by brand, category, and supplier.

### 4. 👥 Multi-Counter & Granular Worker Access Control (RBAC)
* **Permanent Store Codes**: Every registered shop gets a permanent unique Shop Code for cashier logins.
* **Multi-Cashier Support**: Assign separate login credentials (`c1`, `c2`, etc.) to individual counter staff.
* **Customizable Worker Permissions**: Shop owners can independently toggle worker access to:
  * 📦 **Stock Control**: Ability to edit product catalog and adjust inventory.
  * 💰 **Expenses Access**: Ability to log and view daily store operational overheads.
  * 📊 **Analytics View**: Access to sales history, revenue trends, and store performance dashboards.

### 5. 💰 Store Operational Expense Tracker
* **Categorized Expenses**: Record utility bills, rent, maintenance, staff salaries, and petty cash outlays.
* **Net Profit Calculation**: Automatically subtracts daily operational expenses from gross margins to display true net earnings.

### 6. 📊 Advanced Analytics & ML Demand Forecasting
* **Period-Aware Dashboards**: Track revenue, gross profit, sales counts, and average bill values across Today, 7-Day, 30-Day, or Custom date ranges.
* **Machine Learning Demand Prediction**: Uses Scikit-learn regression models to forecast future product restocking needs based on historical sales velocity.
* **Dead Stock Capital Analysis**: Highlights slow-moving inventory holding up capital and suggests clearance discount strategies.

---

## 🛠️ Technical Architecture & Stack

### Frontend Client
* **Framework**: React 18 + Vite (Ultra-fast HMR and bundle compilation)
* **Styling**: Tailwind CSS with custom Dark Mode palette and glassmorphism elements
* **Authentication**: Clerk Authentication integration + JWT token management
* **Icons & Visuals**: Lucide React + Chart.js

### Backend Engine
* **Language & Framework**: Python 3.10+ with FastAPI (Asynchronous high-performance REST API)
* **Database & ODM**: MongoDB with Beanie ODM & Motor async driver
* **Document Compiler**: ReportLab for thermal receipt and PDF operations report rendering
* **Mail Dispatch**: Python `smtplib` with TLS/SSL socket failover

---

## 🚀 Getting Started Locally

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* [Python 3.10+](https://www.python.org/)
* [MongoDB](https://www.mongodb.com/) (Running locally on `mongodb://localhost:27017` or Atlas connection URI)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/venkatavinayak/stockproject.git
cd stockproject
```

### Step 2: Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create a virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start local FastAPI server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
> The API server will be live at `http://127.0.0.1:8000` (Swagger docs available at `http://127.0.0.1:8000/docs`).

---

### Step 3: Frontend Setup
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
> The web client will be running at `http://localhost:5173`.

---

## 📁 Repository Directory Structure

```
deptstore/
├── backend/
│   ├── app/
│   │   ├── auth/          # JWT authentication, security, and access guards
│   │   ├── models/        # Beanie ODM schemas (User, Product, Transaction, Expense, Settings)
│   │   ├── reports/       # ReportLab PDF invoice and operations compiler
│   │   ├── routers/       # FastAPI endpoints (billing, transactions, inventory, analytics, users)
│   │   ├── schemas/       # Pydantic data validation contracts
│   │   └── services/      # Email service dispatch and inventory event loggers
│   ├── requirements.txt
│   └── render.yaml        # One-click Render deployment configuration
├── frontend/
│   ├── src/
│   │   ├── components/    # Navbar, Sidebar, and reusable UI components
│   │   ├── context/       # AuthContext and ThemeContext providers
│   │   ├── pages/         # POS Billing, Inventory, Transactions, Expenses, Analytics, Users, Settings
│   │   └── services/      # Axios API client modules
│   ├── package.json
│   └── netlify.toml       # Netlify SPA routing rules
└── README.md
```

---


