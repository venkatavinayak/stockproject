# SmartStock AI: Departmental Store ERP & POS System

SmartStock AI is a comprehensive, production-ready Enterprise Resource Planning (ERP) and Point of Sale (POS) application designed for modern departmental stores. It features real-time inventory management, automated GST calculation, thermal receipt generation, sales performance tracking, dynamic customer refunds, and Scikit-learn powered machine learning demand forecasting.

---

Deployment Link:  https://stockproject-vvk.netlify.app

## 🚀 Key Features

* **Point of Sale (POS) Billing**: Interactive billing terminal with support for scanning barcodes, selecting custom payment methods (Cash, Card, UPI), instant tax split calculations, and PDF invoice receipt generations.
* **Returns & Refunds Manager**: Processes item refunds and recalculates original transaction invoices (subtotal, tax split, net profit) on-the-fly, instantly updating the inventory and dashboard analytics in real-time.
* **Period-Aware Dashboard**: Visualizes sales trends, category shares, top-performing products, hourly store traffic heatmaps, and financial metrics across periods (Today, Week, Month, All-Time, or custom date ranges).
* **Machine Learning Demand Forecasting**: Leverages Scikit-learn (Linear Regression and moving averages) to predict future product sales trends, rounded to discrete package quantities.
* **Role-Based Access Control (RBAC)**: Multiple cashier node configuration where the owner can manage credentials and edit individual worker rights (e.g., allow stock edits, view analytics, manage expenses).
* **SMTP Email Receipt Dispatch**: Sends automated digital invoices directly to customers' emails upon successful checkout.
* **Automated Operations Backup**: Features automated nightly database backups and administrative database restoration points.

---

## 🛠️ Technology Stack

* **Frontend**: React (Vite), Axios, Tailwind CSS / Vanilla CSS, Lucide Icons, Chart.js.
* **Backend**: Python (FastAPI), Beanie ODM (MongoDB Object Document Mapper), Motor (Async MongoDB Driver), APScheduler (background cron jobs), ReportLab (PDF receipt compiler).
* **Database**: MongoDB.

---

## 💻 Local Installation & Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v16+)
* [Python 3.10+](https://www.python.org/)
* [MongoDB](https://www.mongodb.com/) (running locally on port 27017 or remote Atlas connection)

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the web client at `http://localhost:5173`.

---

## 🌐 Deployment Configuration

### Frontend (Netlify)
The frontend is deployed to Netlify:
* Live site builds production bundle from the `frontend` folder using standard SPA routing.
* The API client uses environment flags (`import.meta.env.PROD`) to automatically toggle the base URL between the local development server and the live production API.

### Backend (Render Blueprint)
Deploy the backend with one-click using the included `render.yaml` blueprint:
1. Create a project on [Render](https://render.com).
2. Create a new **Blueprint** service.
3. Link this repository.
4. Input your `MONGO_URI` connection string when prompted.
5. Render will automatically configure the free instance type, run dependencies builder (`pip install`), and start the production uvicorn server.
