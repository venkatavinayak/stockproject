import os
import logging
from logging.handlers import RotatingFileHandler

# Define absolute paths for logs relative to project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOG_DIR = os.path.join(BASE_DIR, 'logs')
os.makedirs(LOG_DIR, exist_ok=True)

# Formatter
log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Backend logger
backend_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, 'backend.log'),
    maxBytes=5*1024*1024, # 5MB
    backupCount=3
)
backend_handler.setFormatter(log_formatter)
backend_handler.setLevel(logging.INFO)

# Scheduler logger
scheduler_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, 'scheduler.log'),
    maxBytes=5*1024*1024,
    backupCount=3
)
scheduler_handler.setFormatter(log_formatter)
scheduler_handler.setLevel(logging.INFO)

# Error logger
error_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, 'error.log'),
    maxBytes=5*1024*1024,
    backupCount=5
)
error_handler.setFormatter(log_formatter)
error_handler.setLevel(logging.ERROR)

def get_logger(name: str):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Avoid duplicate handlers
    if not logger.handlers:
        # Add basic console output
        console = logging.StreamHandler()
        console.setFormatter(log_formatter)
        console.setLevel(logging.INFO)
        logger.addHandler(console)
        
        # Add standard backend file handler
        logger.addHandler(backend_handler)
        
        # Add error file handler
        logger.addHandler(error_handler)
        
    return logger

def get_scheduler_logger():
    logger = logging.getLogger('scheduler')
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        console = logging.StreamHandler()
        console.setFormatter(log_formatter)
        console.setLevel(logging.INFO)
        logger.addHandler(console)
        
        logger.addHandler(scheduler_handler)
        logger.addHandler(error_handler)
        
    return logger
