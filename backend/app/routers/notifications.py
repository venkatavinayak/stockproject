from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from beanie import PydanticObjectId

from backend.app.models.notification import Notification
from backend.app.schemas.other import NotificationResponse
from backend.app.auth.deps import get_current_user
from backend.app.models.user import User

router = APIRouter(prefix="/notifications", tags=["Notifications & Alerts"])

@router.get("", response_model=List[NotificationResponse])
async def get_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user)
):
    filters = {}
    if unread_only:
        filters["is_read"] = False
    return await Notification.find(filters).sort(-Notification.timestamp).to_list()

@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    notif = await Notification.get(notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.is_read = True
    await notif.save()
    return notif

@router.put("/read-all")
async def mark_all_as_read(
    current_user: User = Depends(get_current_user)
):
    await Notification.find(Notification.is_read == False).update({"$set": {"is_read": True}})
    return {"message": "All notifications marked as read"}

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    notif = await Notification.get(notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    await notif.delete()
    return {"message": "Notification deleted successfully"}
