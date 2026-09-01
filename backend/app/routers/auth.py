from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime
from typing import Optional

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
    owner_username = current_user.owner
    users = await User.find({"$or": [{"username": owner_username}, {"owner_username": owner_username}]}).to_list()
    return [{
        "id": str(u.id),
        "username": u.username.split(":")[-1] if ":" in u.username else u.username,
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
        
    owner_username = current_user.owner
    scoped_username = f"{owner_username}:{data.username}"
    
    # Check if username exists
    existing = await User.find_one(User.username == scoped_username)
    if existing:
        raise HTTPException(status_code=400, detail="Counter username already exists for this shop")
        
    new_user = User(
        username=scoped_username,
        hashed_password=get_password_hash(data.password),
        role=data.role,
        is_active=True,
        can_manage_stock=data.can_manage_stock,
        can_view_expenses=data.can_view_expenses,
        can_view_analytics=data.can_view_analytics,
        owner_username=owner_username
    )
    await new_user.insert()
    
    # Audit log
    audit = AuditLog(
        username=current_user.username,
        action="CREATE_USER",
        details=f"Created worker account: {data.username}",
        owner_username=owner_username
    )
    await audit.insert()
    
    return {"message": f"User '{data.username}' created successfully as '{data.role}'"}

@router.delete("/users/{username}")
async def delete_user(username: str, current_user: User = Depends(get_current_user)):
    # Verify current user is admin
    if getattr(current_user, "role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    owner_username = current_user.owner
    scoped_username = f"{owner_username}:{username}"
    
    if username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete default admin user")
        
    if scoped_username == current_user.username or username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot delete currently logged-in user")
        
    user = await User.find_one(User.username == scoped_username, User.owner_username == owner_username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    await user.delete()
    
    # Audit log
    audit = AuditLog(
        username=current_user.username,
        action="DELETE_USER",
        details=f"Deleted worker account: {username}",
        owner_username=owner_username
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
        
    owner_username = current_user.owner
    scoped_username = f"{owner_username}:{username}"
    
    user = await User.find_one(User.username == scoped_username, User.owner_username == owner_username)
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
        details=f"Updated rights for {username}: Stock={data.can_manage_stock}, Expenses={data.can_view_expenses}, Analytics={data.can_view_analytics}, Active={data.is_active}",
        owner_username=owner_username
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
        
    owner_username = current_user.owner
    scoped_username = f"{owner_username}:{username}"
    
    user = await User.find_one(User.username == scoped_username, User.owner_username == owner_username)
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
        details=f"Reset password for worker account: {username}",
        owner_username=owner_username
    )
    await audit.insert()
    
    return {"message": f"Password for user {username} updated successfully"}

class ShopRegister(BaseModel):
    shop_name: str
    owner_username: str
    email: str
    password: str
    clerk_id: Optional[str] = None

@router.post("/register-shop")
async def register_shop(data: ShopRegister):
    clean_email = data.email.lower().strip()
    owner_uname = data.owner_username.strip()
    
    # Check if a user with this username, email, or clerk_id already exists
    existing = await User.find_one({
        "$or": [
            {"username": owner_uname}, 
            {"email": clean_email}, 
            {"username": clean_email},
            *([{"clerk_user_id": data.clerk_id}] if data.clerk_id else [])
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Owner username, email, or Clerk account is already registered")
        
    # Create the owner user (admin role)
    new_user = User(
        username=owner_uname,
        hashed_password=get_password_hash(data.password),
        role="admin",
        is_active=True,
        email=clean_email,
        full_name=data.shop_name,
        owner_username=owner_uname,
        clerk_user_id=data.clerk_id
    )
    await new_user.insert()
    
    # Update store settings with shop name, scoped to this owner
    from backend.app.models.settings import StoreSettings
    settings = await StoreSettings.find_one(StoreSettings.owner_username == owner_uname)
    if not settings:
        settings = StoreSettings(
            owner_username=owner_uname,
            store_name=data.shop_name,
            gst_number="27AAAAA1111A1Z1",
            address="123 Shopping Arcade, Central Market Road, Sector 5",
            contact_info="+91 98765 43210",
            currency_symbol="₹",
            receipt_format="Thermal",
            invoice_footer="Thank you for shopping with us! Visit again."
        )
    else:
        settings.store_name = data.shop_name
    await settings.save()
    
    # Audit log
    audit = AuditLog(
        username=owner_uname,
        action="REGISTER_SHOP",
        details=f"Registered shop: {data.shop_name} for owner: {owner_uname} ({clean_email})"
    )
    await audit.insert()
    
    access_token = create_access_token(data={
        "sub": new_user.username,
        "role": new_user.role,
        "owner_username": owner_uname
    })
    return {
        "message": "Shop registered successfully!",
        "access_token": access_token,
        "token_type": "bearer",
        "owner_username": owner_uname
    }

class ClerkLoginPayload(BaseModel):
    email: str
    clerk_id: str
    shop_name: Optional[str] = None
    role: str = "admin"
    password: Optional[str] = None
    owner_username: Optional[str] = None

@router.post("/clerk-login")
async def clerk_login(data: ClerkLoginPayload):
    clean_email = data.email.lower().strip()
    target_username = data.owner_username.strip() if data.owner_username else clean_email

    user = await User.find_one({
        "$or": [
            {"clerk_user_id": data.clerk_id},
            {"username": target_username}, 
            {"email": clean_email}, 
            {"username": clean_email}
        ]
    })
    if not user:
        if not data.shop_name:
            raise HTTPException(status_code=404, detail="No shop found for this account. Please create a shop.")
        hashed = get_password_hash(data.password) if data.password else get_password_hash(data.clerk_id)
        user = User(
            username=target_username,
            hashed_password=hashed,
            role=data.role,
            is_active=True,
            email=clean_email,
            full_name=data.shop_name or "Store Owner",
            owner_username=target_username,
            clerk_user_id=data.clerk_id
        )
        await user.insert()
        
        if data.role == "admin" and data.shop_name:
            from backend.app.models.settings import StoreSettings
            settings = await StoreSettings.find_one(StoreSettings.owner_username == target_username)
            if not settings:
                settings = StoreSettings(
                    owner_username=target_username,
                    store_name=data.shop_name,
                    gst_number="27AAAAA1111A1Z1",
                    address="123 Shopping Arcade, Central Market Road, Sector 5",
                    contact_info="+91 98765 43210",
                    currency_symbol="₹",
                    receipt_format="Thermal",
                    invoice_footer="Thank you for shopping with us! Visit again."
                )
            else:
                settings.store_name = data.shop_name
            await settings.save()
            
        audit = AuditLog(
            username=target_username,
            action="CLERK_AUTO_REGISTER",
            details=f"Auto-registered via Clerk. Shop: {data.shop_name or 'Default'}"
        )
        await audit.insert()
    else:
        # Bind clerk_user_id if not previously attached
        if not user.clerk_user_id:
            user.clerk_user_id = data.clerk_id
        if data.password:
            if not verify_password(data.password, user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect store owner password"
                )
        user.last_login = datetime.utcnow()
        await user.save()
        
    access_token = create_access_token(data={
        "sub": user.username,
        "role": user.role,
        "owner_username": user.owner
    })
    return {"access_token": access_token, "token_type": "bearer", "owner_username": user.owner}

@router.get("/check-shop")
async def check_shop(email: Optional[str] = None, clerk_id: Optional[str] = None):
    query_conditions = []
    if clerk_id:
        query_conditions.append({"clerk_user_id": clerk_id.strip()})
    if email:
        clean_email = email.lower().strip()
        query_conditions.extend([
            {"username": clean_email},
            {"email": clean_email},
            {"owner_username": clean_email}
        ])
    
    if not query_conditions:
        raise HTTPException(status_code=400, detail="Email or clerk_id query param required")

    user = await User.find_one({"$or": query_conditions})
    if user:
        from backend.app.models.settings import StoreSettings
        settings = await StoreSettings.find_one(StoreSettings.owner_username == user.owner)
        shop_name = settings.store_name if settings else (user.full_name or "Smart Store")
        return {
            "exists": True,
            "shop_name": shop_name,
            "owner_username": user.owner,
            "email": user.email or email
        }
    return {"exists": False}

class CounterLoginRequest(BaseModel):
    shop_code: str  # Owner username
    username: str   # Counter username
    password: str

@router.post("/counter-login")
async def counter_login(data: CounterLoginRequest):
    shop_code = data.shop_code.strip()
    counter_name = data.username.strip()
    
    scoped_username = counter_name if ":" in counter_name else f"{shop_code}:{counter_name}"
    
    user = await User.find_one({"$or": [{"username": scoped_username}, {"username": counter_name, "owner_username": shop_code}]})
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Shop Code, Counter Username, or Password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive counter account. Please contact store owner."
        )

    user.last_login = datetime.utcnow()
    await user.save()

    audit = AuditLog(
        username=user.username,
        action="COUNTER_LOGIN",
        details=f"Counter cashier logged into shop: {shop_code}",
        owner_username=shop_code
    )
    await audit.insert()

    access_token = create_access_token(data={
        "sub": user.username,
        "role": user.role,
        "owner_username": user.owner,
        "can_manage_stock": user.can_manage_stock,
        "can_view_expenses": user.can_view_expenses,
        "can_view_analytics": user.can_view_analytics
    })
    return {"access_token": access_token, "token_type": "bearer", "owner_username": user.owner}


