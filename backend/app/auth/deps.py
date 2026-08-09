import os
import httpx
from datetime import datetime, timedelta
from typing import Optional

from backend.app.models.user import User
from backend.app.auth.security import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "https://lucky-puma-99.clerk.accounts.dev/.well-known/jwks.json")

_jwks_cache = None
_jwks_last_fetched = None

async def get_jwks_keys():
    global _jwks_cache, _jwks_last_fetched
    
    if _jwks_cache and _jwks_last_fetched and (datetime.utcnow() - _jwks_last_fetched) < timedelta(hours=1):
        return _jwks_cache
        
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(CLERK_JWKS_URL)
            if r.status_code == 200:
                _jwks_cache = r.json()
                _jwks_last_fetched = datetime.utcnow()
                return _jwks_cache
    except Exception as e:
        if _jwks_cache:
            return _jwks_cache
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Clerk JWKS: {str(e)}"
        )
    return _jwks_cache

async def get_current_user(
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode header without verification to find kid
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            raise credentials_exception
            
        jwks = await get_jwks_keys()
        if not jwks:
            raise credentials_exception
            
        # Match key from JWKS
        public_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                public_key = key
                break
                
        if not public_key:
            raise credentials_exception
            
        # Decode and verify token signature using the public key
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        
        clerk_id: str = payload.get("sub")
        email: Optional[str] = payload.get("email") or payload.get("emails", [None])[0]
        
        if clerk_id is None:
            raise credentials_exception
            
    except Exception:
        raise credentials_exception
        
    # Check if this Clerk user is already linked to a profile
    user = await User.find_one(User.clerk_id == clerk_id)
    if user is None:
        # Try auto-linking by email
        if email:
            user = await User.find_one(User.email == email)
            if user:
                user.clerk_id = clerk_id
                await user.save()
                return user
                
        # Raise special unlinked account error
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="UNLINKED_ACCOUNT"
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return user

async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if getattr(current_user, "role", "admin") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required. Operation not permitted."
        )
    return current_user

async def get_current_stock_manager(
    current_user: User = Depends(get_current_user)
) -> User:
    if getattr(current_user, "role", "admin") == "admin" or getattr(current_user, "can_manage_stock", False):
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Permission denied. Stock management rights required."
    )

async def get_current_expenses_manager(
    current_user: User = Depends(get_current_user)
) -> User:
    if getattr(current_user, "role", "admin") == "admin" or getattr(current_user, "can_view_expenses", False):
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Permission denied. Expense access rights required."
    )

async def get_current_analytics_viewer(
    current_user: User = Depends(get_current_user)
) -> User:
    if getattr(current_user, "role", "admin") == "admin" or getattr(current_user, "can_view_analytics", False):
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Permission denied. Analytics access rights required."
    )
