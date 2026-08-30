import os
import json
from datetime import datetime
from backend.app.models import all_document_models
from backend.app.models.backup_history import BackupHistory
from backend.app.models.notification import Notification

BACKUP_DIR = "backups"

async def run_automated_backup():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"autobackup_{timestamp}.json"
    dest_path = os.path.join(BACKUP_DIR, filename)
    
    status_str = "Success"
    try:
        backup_data = {}
        for model in all_document_models:
            documents = await model.find_all().to_list()
            backup_data[model.__name__] = [
                json.loads(doc.model_dump_json()) for doc in documents
            ]
        with open(dest_path, "w", encoding="utf-8") as f:
            json.dump(backup_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        status_str = "Failed"
        print("Automated backup error:", str(e))
        
    history = BackupHistory(
        filename=filename,
        backup_type="Auto",
        timestamp=datetime.utcnow(),
        status=status_str,
        owner_username="admin"
    )
    await history.insert()
    
    notif = Notification(
        type="Backup",
        message=f"Automated nightly database backup completed: {filename}" if status_str == "Success" else "Automated nightly database backup failed.",
        timestamp=datetime.utcnow(),
        owner_username="admin"
    )
    await notif.insert()
    return history
