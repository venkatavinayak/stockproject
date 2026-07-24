import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from backend.app.utils.logger import get_logger

logger = get_logger(__name__)

# Monkey-patch AsyncIOMotorClient to bypass Beanie initialization crash in PyMongo 4.x
if not hasattr(AsyncIOMotorClient, "append_metadata"):
    def mock_append_metadata(self, *args, **kwargs):
        pass
    AsyncIOMotorClient.append_metadata = mock_append_metadata

# Connection parameters
MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/smartstock")
DB_NAME = os.getenv("MONGO_DB_NAME", "smartstock")

class MongoManager:
    client: AsyncIOMotorClient = None
    db = None

db_manager = MongoManager()

async def init_db(document_models: list):
    try:
        logger.info(f"Connecting to MongoDB at {MONGO_URI}...")
        db_manager.client = AsyncIOMotorClient(MONGO_URI)
        db_manager.db = db_manager.client[DB_NAME]
        
        # Initialize Beanie ODM
        await init_beanie(
            database=db_manager.db,
            document_models=document_models
        )
        logger.info("MongoDB connection and Beanie initialization complete.")
    except Exception as e:
        logger.error(f"Failed to initialize MongoDB connection: {str(e)}")
        raise e

async def close_db():
    if db_manager.client:
        db_manager.client.close()
        logger.info("MongoDB client connection closed.")

def get_mongo_db():
    return db_manager.db
