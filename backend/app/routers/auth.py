from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime

from backend.app.models.user import User
from backend.app.models.audit_logs import AuditLog
from backend.app.auth.security import verify_password, create_access_token, get_password_hash
from backend.app.auth.deps import get_current_user
from backend.app.schemas.auth import Token, PasswordChangeRequest
from backend.app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends()
):
    user = await User.find_one(User.username == form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )
        
    # Update last login time
    user.last_login = datetime.utcnow()
    await user.save()
    
    # Audit log
    audit = AuditLog(
        username=user.username,
        action="LOGIN",
        details="Owner portal logged in successfully."
    )
    await audit.insert()
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    audit = AuditLog(
        username=current_user.username,
        action="LOGOUT",
        details="Owner logged out."
    )
    await audit.insert()
    return {"message": "Successfully logged out"}

@router.post("/refresh", response_model=Token)
async def refresh_token(current_user: User = Depends(get_current_user)):
    access_token = create_access_token(data={"sub": current_user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/change-password")
async def change_password(
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user)
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    current_user.hashed_password = get_password_hash(data.new_password)
    await current_user.save()
    
    audit = AuditLog(
        username=current_user.username,
        action="CHANGE_PASSWORD",
        details="Admin password changed successfully."
    )
    await audit.insert()
    
    return {"message": "Password changed successfully"}

# User management and profile endpoints
from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "worker" # "admin" or "worker"
    can_manage_stock: bool = False
    can_view_expenses: bool = False
    can_view_analytics: bool = False

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    role = getattr(current_user, "role", "admin")
    return {
        "username": current_user.username,
        "role": role,
        "is_active": current_user.is_active,
        "full_name": getattr(current_user, "full_name", None) or "",
        "email": getattr(current_user, "email", None) or "",
        "can_manage_stock": getattr(current_user, "can_manage_stock", False) if role == "worker" else True,
        "can_view_expenses": getattr(current_user, "can_view_expenses", False) if role == "worker" else True,
        "can_view_analytics": getattr(current_user, "can_view_analytics", False) if role == "worker" else True
    }

@router.get("/users")
async def list_users(current_user: User = Depends(get_current_user)):
    # Verify current user is admin
    if getattr(current_user, "role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    users = await User.find_all().to_list()
    return [{
        "id": str(u.id),
        "username": u.username,
        "role": getattr(u, "role", "admin"),
        "is_active": u.is_active,
        "last_login": u.last_login,
        "full_name": getattr(u, "full_name", None) or "",
        "email": getattr(u, "email", None) or "",
        "can_manage_stock": getattr(u, "can_manage_stock", False),
        "can_view_expenses": getattr(u, "can_view_expenses", False),
        "can_view_analytics": getattr(u, "can_view_analytics", False)
    } for u in users]

@router.post("/users")
async def create_user(data: UserCreate, current_user: User = Depends(get_current_user)):
    # Verify current user is admin
    if getattr(current_user, "role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    # Check if username exists
    existing = await User.find_one(User.username == data.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    new_user = User(
        username=data.username,
        hashed_password=get_password_hash(data.password),
        role=data.role,
        is_active=True,
        can_manage_stock=data.can_manage_stock,
        can_view_expenses=data.can_view_expenses,
        can_view_analytics=data.can_view_analytics
    )
    await new_user.insert()
    
    # Audit log
    audit = AuditLog(
        username=current_user.username,
        action="CREATE_USER",
        details=f"Created worker account: {data.username}"
    )
    await audit.insert()
    
    return {"message": f"User '{data.username}' created successfully as '{data.role}'"}

@router.delete("/users/{username}")
async def delete_user(username: str, current_user: User = Depends(get_current_user)):
    # Verify current user is admin
    if getattr(current_user, "role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    if username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete default admin user")
        
    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot delete currently logged-in user")
        
    user = await User.find_one(User.username == username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    await user.delete()
    
    # Audit log
    audit = AuditLog(
        username=current_user.username,
        action="DELETE_USER",
        details=f"Deleted worker account: {username}"
    )
    await audit.insert()
    
    return {"message": f"User '{username}' deleted successfully"}

class UserRightsUpdate(BaseModel):
    can_manage_stock: bool
    can_view_expenses: bool
    can_view_analytics: bool
    is_active: bool

@router.put("/users/{username}/rights")
async def update_user_rights(
    username: str,
    data: UserRightsUpdate,
    current_user: User = Depends(get_current_user)
):
    if getattr(current_user, "role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    user = await User.find_one(User.username == username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if username == "admin":
        raise HTTPException(status_code=400, detail="Cannot edit default admin permissions")
        
    user.can_manage_stock = data.can_manage_stock
    user.can_view_expenses = data.can_view_expenses
    user.can_view_analytics = data.can_view_analytics
    user.is_active = data.is_active
    await user.save()
    
    # Audit log
    audit = AuditLog(
        username=current_user.username,
        action="UPDATE_USER_RIGHTS",
        details=f"Updated rights for {username}: Stock={data.can_manage_stock}, Expenses={data.can_view_expenses}, Analytics={data.can_view_analytics}, Active={data.is_active}"
    )
    await audit.insert()
    
    return {"message": f"Permissions updated for user {username}"}

class ProfileUpdate(BaseModel):
    full_name: str
    email: str

@router.put("/profile")
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    current_user.full_name = data.full_name.strip()
    current_user.email = data.email.strip()
    await current_user.save()
    return {"message": "Profile updated successfully"}

class UserPasswordReset(BaseModel):
    new_password: str

@router.put("/users/{username}/password")
async def reset_user_password(
    username: str,
    data: UserPasswordReset,
    current_user: User = Depends(get_current_user)
):
    if getattr(current_user, "role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    user = await User.find_one(User.username == username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters long")
        
    user.hashed_password = get_password_hash(data.new_password)
    await user.save()
    
    # Audit log
    audit = AuditLog(
        username=current_user.username,
        action="RESET_WORKER_PASSWORD",
        details=f"Reset password for worker account: {username}"
    )
    await audit.insert()
    
    return {"message": f"Password for user {username} updated successfully"}
