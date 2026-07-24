from backend.app.models.user import User
from backend.app.models.category import Category
from backend.app.models.supplier import Supplier
from backend.app.models.product import Product
from backend.app.models.transaction import Transaction, TransactionItem
from backend.app.models.returns import Return
from backend.app.models.purchase import Purchase
from backend.app.models.expense import Expense
from backend.app.models.notification import Notification
from backend.app.models.daily_summary import DailySummary, TopProductItem
from backend.app.models.inventory_history import InventoryHistory
from backend.app.models.backup_history import BackupHistory
from backend.app.models.ai_recommendations import AIRecommendations
from backend.app.models.settings import StoreSettings
from backend.app.models.ai_prediction import AIPrediction
from backend.app.models.customer import Customer
from backend.app.models.audit_logs import AuditLog

all_document_models = [
    User,
    Category,
    Supplier,
    Product,
    Transaction,
    Return,
    Purchase,
    Expense,
    Notification,
    DailySummary,
    InventoryHistory,
    BackupHistory,
    AIRecommendations,
    StoreSettings,
    AIPrediction,
    Customer,
    AuditLog
]

__all__ = [
    "User",
    "Category",
    "Supplier",
    "Product",
    "Transaction",
    "TransactionItem",
    "Return",
    "Purchase",
    "Expense",
    "Notification",
    "DailySummary",
    "TopProductItem",
    "InventoryHistory",
    "BackupHistory",
    "AIRecommendations",
    "StoreSettings",
    "AIPrediction",
    "Customer",
    "AuditLog",
    "all_document_models"
]
