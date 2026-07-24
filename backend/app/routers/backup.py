from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
import os
import json
from datetime import datetime
from typing import List
from beanie import PydanticObjectId

from backend.app.models import all_document_models
from backend.app.models.backup_history import BackupHistory
from backend.app.models.notification import Notification
from backend.app.models.audit_logs import AuditLog
from backend.app.schemas.other import BackupHistoryResponse
from backend.app.auth.deps import get_current_admin
from backend.app.models.user import User

router = APIRouter(prefix="/backup", tags=["Backup & Data Management"])

BACKUP_DIR = "backups"

@router.get("/list", response_model=List[BackupHistoryResponse])
async def list_backups(
    current_user: User = Depends(get_current_admin)
):
    return await BackupHistory.find_all().sort(-BackupHistory.timestamp).to_list()

@router.post("/create", response_model=BackupHistoryResponse)
async def trigger_backup(
    current_user: User = Depends(get_current_admin)
):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.json"
    dest_path = os.path.join(BACKUP_DIR, filename)
    
    status_str = "Success"
    try:
        backup_data = {}
        for model in all_document_models:
            documents = await model.find_all().to_list()
            # Serialize each document via Pydantic model serialization
            backup_data[model.__name__] = [
                json.loads(doc.model_dump_json()) for doc in documents
            ]
            
        with open(dest_path, "w", encoding="utf-8") as f:
            json.dump(backup_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        import traceback
        traceback.print_exc()
        status_str = "Failed"
        
    # Record backup in history
    history = BackupHistory(
        filename=filename,
        backup_type="Manual",
        timestamp=datetime.utcnow(),
        status=status_str
    )
    await history.insert()
    
    # Create notification
    notif = Notification(
        type="Backup",
        message=f"Manual database backup completed successfully: {filename}" if status_str == "Success" else f"Manual database backup failed.",
        timestamp=datetime.utcnow()
    )
    await notif.insert()
    
    # Audit log
    audit = AuditLog(
        username=current_user.username,
        action="BACKUP",
        details=f"Triggered manual database backup. Status: {status_str}."
    )
    await audit.insert()
    
    return history

@router.post("/restore/{backup_id}")
async def restore_backup(
    backup_id: PydanticObjectId,
    current_user: User = Depends(get_current_admin)
):
    history = await BackupHistory.get(backup_id)
    if not history:
        raise HTTPException(status_code=404, detail="Backup record not found")
        
    backup_path = os.path.join(BACKUP_DIR, history.filename)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=400, detail="Physical backup file does not exist on disk")
        
    try:
        with open(backup_path, "r", encoding="utf-8") as f:
            backup_data = json.load(f)
            
        # Map models by name
        model_map = {model.__name__: model for model in all_document_models}
        
        # 1. Clear current database collections and import documents
        for model_name, doc_dicts in backup_data.items():
            if model_name in model_map:
                model = model_map[model_name]
                # Drop existing documents in collection
                await model.delete_all()
                # Insert all documents from backup
                for doc_dict in doc_dicts:
                    doc_obj = model.model_validate(doc_dict)
                    # Force insert the document with its original ObjectId
                    await doc_obj.insert()
                    
        # Log restoration event to the newly restored database
        notif = Notification(
            type="System",
            message=f"Database successfully restored to state: {history.filename}",
            timestamp=datetime.utcnow()
        )
        await notif.insert()
        
        audit = AuditLog(
            username=current_user.username,
            action="RESTORE",
            details=f"Restored database to backup: {history.filename}."
        )
        await audit.insert()
        
        return {"message": "Database restored successfully. Please refresh the page."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database restoration failed: {str(e)}")

@router.get("/download/{backup_id}")
async def download_backup_file(
    backup_id: PydanticObjectId,
    token: str = None
):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing"
        )
    from jose import JWTError, jwt
    from backend.app.auth.security import SECRET_KEY, ALGORITHM
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    user = await User.find_one(User.username == username)
    if not user or getattr(user, "role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    history = await BackupHistory.get(backup_id)
    if not history:
        raise HTTPException(status_code=404, detail="Backup record not found")
        
    file_path = os.path.join(BACKUP_DIR, history.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    return FileResponse(
        path=file_path,
        filename=history.filename,
        media_type='application/octet-stream'
    )
