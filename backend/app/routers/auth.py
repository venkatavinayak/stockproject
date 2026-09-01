from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from backend.app.models.user import User
from backend.app.models.audit_logs import AuditLog
from backend.app.models.settings import StoreSettings
from backend.app.auth.security import verify_password, create_access_token, get_password_hash, verify_pin
from backend.app.auth.deps import get_current_user
from backend.app.auth.clerk import verify_clerk_token, verify_clerk_webhook
from backend.app.schemas.auth import Token, PasswordChangeRequest
from backend.app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

def set_auth_cookie(response: Response, token: str):
    """Sets secure HttpOnly cookie for the local smartstock_token."""
    response.set_cookie(
        key="smartstock_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production HTTPS
        max_age=86400 * 7, # 7 days
        path="/"
    )

@router.post("/login", response_model=Token)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends()
):
    username = form_data.username.strip()
    user = await User.find_one(User.username == username)
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
        
    user.last_login = datetime.utcnow()
    await user.save()
    
    audit = AuditLog(
        username=user.username,
        action="LOGIN",
        details=f"User '{user.username}' logged in successfully.",
        owner_username=user.owner
    )
    await audit.insert()
    
    access_token = create_access_token(data={
        "sub": user.username,
        "role": getattr(user, "role", "admin"),
        "owner_username": user.owner
    })
    set_auth_cookie(response, access_token)
    return {"access_token": access_token, "token_type": "bearer"}

class CounterPinLogin(BaseModel):
    owner_username: Optional[str] = None
    shop_id: Optional[str] = None
    counter_username: Optional[str] = None
    pin: str

@router.post("/counter-pin-login", response_model=Token)
async def counter_pin_login(data: CounterPinLogin, response: Response):
    owner = (data.owner_username or data.shop_id or "").strip()
    if not owner:
        raise HTTPException(status_code=400, detail="Shop owner username or POS register ID is required")
        
    pin_str = data.pin.strip()
    if not pin_str:
        raise HTTPException(status_code=400, detail="PIN is required")

    # Search users under this shop with matching PIN
    query = {"$or": [{"owner_username": owner}, {"username": owner}]}
    users = await User.find(query).to_list()
    
    target_user = None
    for u in users:
        stored_hash = getattr(u, "hashed_pin", None) or u.hashed_password
        if verify_pin(pin_str, stored_hash):
            target_user = u
            break
            
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 4-digit PIN for this shop"
        )

    if not target_user.is_active:
        raise HTTPException(status_code=400, detail="Counter user account is inactive")

    target_user.last_login = datetime.utcnow()
    await target_user.save()

    audit = AuditLog(
        username=target_user.username,
        action="COUNTER_PIN_LOGIN",
        details=f"Counter POS worker logged in via 4-digit PIN.",
        owner_username=target_user.owner
    )
    await audit.insert()

    access_token = create_access_token(data={
        "sub": target_user.username,
        "role": getattr(target_user, "role", "worker"),
        "owner_username": target_user.owner
    })
    set_auth_cookie(response, access_token)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    audit = AuditLog(
        username=current_user.username,
        action="LOGOUT",
        details="User logged out.",
        owner_username=current_user.owner
    )
    await audit.insert()
    response.delete_cookie(key="smartstock_token", path="/")
    return {"message": "Successfully logged out"}

@router.post("/refresh", response_model=Token)
async def refresh_token(response: Response, current_user: User = Depends(get_current_user)):
    access_token = create_access_token(data={
        "sub": current_user.username,
        "role": getattr(current_user, "role", "admin"),
        "owner_username": current_user.owner
    })
    set_auth_cookie(response, access_token)
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
        details="Password changed successfully.",
        owner_username=current_user.owner
    )
    await audit.insert()
    
    return {"message": "Password changed successfully"}

class UserCreate(BaseModel):
    username: str
    password: str
    pin: Optional[str] = None
    role: str = "worker"
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
        "owner_username": current_user.owner,
        "can_manage_stock": getattr(current_user, "can_manage_stock", False) if role == "worker" else True,
        "can_view_expenses": getattr(current_user, "can_view_expenses", False) if role == "worker" else True,
        "can_view_analytics": getattr(current_user, "can_view_analytics", False) if role == "worker" else True
    }

@router.get("/users")
async def list_users(current_user: User = Depends(get_current_user)):
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
    if getattr(current_user, "role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    owner_username = current_user.owner
    scoped_username = f"{owner_username}:{data.username.strip()}"
    
    existing = await User.find_one(User.username == scoped_username)
    if existing:
        raise HTTPException(status_code=400, detail="Counter username already exists for this shop")
        
    hashed_pin = get_password_hash(data.pin.strip()) if data.pin and data.pin.strip() else None

    new_user = User(
        username=scoped_username,
        hashed_password=get_password_hash(data.password),
        hashed_pin=hashed_pin,
        role=data.role,
        is_active=True,
        can_manage_stock=data.can_manage_stock,
        can_view_expenses=data.can_view_expenses,
        can_view_analytics=data.can_view_analytics,
        owner_username=owner_username
    )
    await new_user.insert()
    
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
    
    audit = AuditLog(
        username=current_user.username,
        action="UPDATE_USER_RIGHTS",
        details=f"Updated rights for {username}",
        owner_username=owner_username
    )
    await audit.insert()
    
    return {"message": f"Permissions updated for user {username}"}

class ShopRegister(BaseModel):
    shop_name: str
    owner_username: str
    password: str
    clerk_token: Optional[str] = None
    email: Optional[str] = None
    counter_pin: Optional[str] = None

@router.post("/register-shop")
async def register_shop(data: ShopRegister, response: Response):
    owner_name = data.owner_username.strip().lower()
    email_clean = (data.email or owner_name).strip().lower()
    clerk_id = None

    if data.clerk_token:
        claims = await verify_clerk_token(data.clerk_token)
        clerk_id = claims.get("sub")
        email_clean = claims.get("email", email_clean)

    # Check existing user by owner_username or clerk_user_id
    query_conditions = [{"username": owner_name}]
    if clerk_id:
        query_conditions.append({"clerk_user_id": clerk_id})

    existing = await User.find_one({"$or": query_conditions})
    if existing:
        # If user exists, log them in as owner
        if not verify_password(data.password, existing.hashed_password):
            raise HTTPException(status_code=400, detail="Username already exists. Incorrect password for existing shop.")
        user = existing
    else:
        hashed_pin = get_password_hash(data.counter_pin.strip()) if data.counter_pin and data.counter_pin.strip() else None
        user = User(
            username=owner_name,
            hashed_password=get_password_hash(data.password),
            hashed_pin=hashed_pin,
            role="admin",
            is_active=True,
            email=email_clean,
            full_name=data.shop_name,
            owner_username=owner_name,
            clerk_user_id=clerk_id
        )
        await user.insert()

    # Update or create StoreSettings
    settings = await StoreSettings.find_one(StoreSettings.owner_username == owner_name)
    if not settings:
        settings = StoreSettings(
            owner_username=owner_name,
            store_name=data.shop_name,
            gst_number="27AAAAA1111A1Z1",
            address="123 Shopping Arcade, Central Market Road, Sector 5",
            contact_info="+91 98765 43210",
            currency_symbol="₹",
            receipt_format="Thermal",
            invoice_footer="Thank you for shopping with us! Visit again."
        )
        await settings.save()
    else:
        settings.store_name = data.shop_name
        await settings.save()

    audit = AuditLog(
        username=owner_name,
        action="REGISTER_SHOP",
        details=f"Registered shop: {data.shop_name} for owner: {owner_name}"
    )
    await audit.insert()

    access_token = create_access_token(data={
        "sub": user.username,
        "role": "admin",
        "owner_username": user.owner
    })
    set_auth_cookie(response, access_token)
    return {"access_token": access_token, "token_type": "bearer"}

class ClerkLoginPayload(BaseModel):
    email: str
    clerk_id: str
    clerk_token: Optional[str] = None
    shop_name: Optional[str] = None
    owner_username: Optional[str] = None
    password: Optional[str] = None
    role: str = "admin"

@router.post("/clerk-login")
async def clerk_login(data: ClerkLoginPayload, response: Response):
    # Verify Clerk Token cryptographically if provided
    if data.clerk_token:
        claims = await verify_clerk_token(data.clerk_token)
        clerk_id = claims.get("sub", data.clerk_id)
        email = claims.get("email", data.email)
    else:
        clerk_id = data.clerk_id
        email = data.email.strip().lower()

    owner_key = (data.owner_username or email).strip().lower()

    # Find by clerk_user_id or username or email
    user = await User.find_one({"$or": [
        {"clerk_user_id": clerk_id},
        {"username": owner_key},
        {"email": email}
    ]})

    if not user:
        if not data.shop_name or not data.password:
            raise HTTPException(
                status_code=404,
                detail="Shop not registered for this Clerk account. Please complete shop onboarding."
            )
        hashed = get_password_hash(data.password)
        user = User(
            username=owner_key,
            hashed_password=hashed,
            role=data.role,
            is_active=True,
            email=email,
            full_name=data.shop_name,
            owner_username=owner_key,
            clerk_user_id=clerk_id
        )
        await user.insert()
        
        settings = await StoreSettings.find_one(StoreSettings.owner_username == owner_key)
        if not settings:
            settings = StoreSettings(
                owner_username=owner_key,
                store_name=data.shop_name,
                gst_number="27AAAAA1111A1Z1",
                address="123 Shopping Arcade, Central Market Road, Sector 5",
                contact_info="+91 98765 43210",
                currency_symbol="₹",
                receipt_format="Thermal",
                invoice_footer="Thank you for shopping with us! Visit again."
            )
            await settings.save()
    else:
        if data.password:
            if not verify_password(data.password, user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect store owner password"
                )
        user.last_login = datetime.utcnow()
        if clerk_id and not user.clerk_user_id:
            user.clerk_user_id = clerk_id
        await user.save()

    access_token = create_access_token(data={
        "sub": user.username,
        "role": getattr(user, "role", "admin"),
        "owner_username": user.owner
    })
    set_auth_cookie(response, access_token)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/check-shop")
async def check_shop(email: Optional[str] = None, clerk_id: Optional[str] = None):
    clean_email = (email or "").lower().strip()
    clean_clerk_id = (clerk_id or "").strip()

    if not clean_email and not clean_clerk_id:
        return {"exists": False}

    query_list = []
    if clean_email and clean_email not in ["null", "undefined"]:
        query_list.extend([{"email": clean_email}, {"username": clean_email}])
    if clean_clerk_id and clean_clerk_id not in ["null", "undefined"]:
        query_list.append({"clerk_user_id": clean_clerk_id})

    if not query_list:
        return {"exists": False}

    user = await User.find_one({"$or": query_list})
    if user and getattr(user, "username", None):
        settings = await StoreSettings.find_one(StoreSettings.owner_username == user.owner)
        shop_name = settings.store_name if settings else (user.full_name or "Smart Store")
        return {
            "exists": True,
            "shop_name": shop_name,
            "owner_username": user.owner
        }
    return {"exists": False}

@router.post("/webhook")
async def clerk_webhook(request: Request):
    """
    Svix-verified Clerk Webhook endpoint for async user.created / user.updated synchronization.
    """
    body = await request.body()
    data = await verify_clerk_webhook(request, body)
    
    event_type = data.get("type")
    user_data = data.get("data", {})
    clerk_id = user_data.get("id")
    email_addresses = user_data.get("email_addresses", [])
    primary_email = email_addresses[0].get("email_address") if email_addresses else ""

    if event_type in ["user.created", "user.updated"] and clerk_id:
        logger.info(f"Clerk webhook received for user {clerk_id} ({primary_email})")
        if primary_email:
            existing = await User.find_one({"$or": [{"clerk_user_id": clerk_id}, {"email": primary_email}]})
            if existing and not existing.clerk_user_id:
                existing.clerk_user_id = clerk_id
                await existing.save()

    return {"status": "success", "event": event_type}
