from fastapi import APIRouter, Depends, HTTPException, status
from beanie import PydanticObjectId

from backend.app.models.settings import StoreSettings
from backend.app.schemas.settings import StoreSettingsUpdate, StoreSettingsResponse
from backend.app.auth.deps import get_current_admin
from backend.app.models.user import User

router = APIRouter(prefix="/settings", tags=["Store Settings"])

@router.get("", response_model=StoreSettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_admin)
):
    settings = await StoreSettings.find_one()
    if not settings:
        settings = StoreSettings()
        await settings.insert()
    return settings

@router.put("", response_model=StoreSettingsResponse)
async def update_settings(
    settings_in: StoreSettingsUpdate,
    current_user: User = Depends(get_current_admin)
):
    settings = await StoreSettings.find_one()
    if not settings:
        settings = StoreSettings()
        await settings.insert()
        
    update_data = settings_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)
        
    await settings.save()
    return settings
