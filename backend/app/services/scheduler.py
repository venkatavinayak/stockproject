from apscheduler.schedulers.asyncio import AsyncIOScheduler
import asyncio
from datetime import datetime, timedelta

from backend.app.services.backup_service import run_automated_backup
from backend.app.services.notification_service import run_low_stock_expiry_checks
from backend.app.services.summary_service import compile_daily_closing_summary
from backend.app.services.forecasting_service import run_forecasting_analysis
from backend.app.utils.logger import get_logger

logger = get_logger("scheduler")

scheduler = AsyncIOScheduler()

def start_scheduler():
    # 1. Nightly automated backup task at 2:00 AM
    scheduler.add_job(run_automated_backup, 'cron', hour=2, minute=0, id='nightly_backup')
    
    # 2. Daily stock check & expiry warning scan at 7:00 AM
    scheduler.add_job(run_low_stock_expiry_checks, 'cron', hour=7, minute=0, id='stock_scans')
    
    # 3. Nightly daily summary sheet generation at 11:59 PM
    scheduler.add_job(compile_daily_closing_summary, 'cron', hour=23, minute=59, id='daily_summaries')
    
    # 4. Weekly AI recommendation & sales velocity refresh (every Sunday at midnight)
    scheduler.add_job(run_forecasting_analysis, 'cron', day_of_week='sun', hour=0, minute=0, id='ai_insights')
    
    # Run immediate check scan 5 seconds after startup to prime database alerts
    scheduler.add_job(
        run_low_stock_expiry_checks, 
        'date', 
        run_date=datetime.now() + timedelta(seconds=5), 
        id='startup_scans'
    )
    
    scheduler.start()
    logger.info("APScheduler initialized background jobs successfully.")
