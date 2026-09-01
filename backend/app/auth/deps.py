from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from backend.app.models.user import User
from backend.app.auth.security import SECRET_KEY, ALGORITHM
from backend.app.schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

async def get_token_from_request(
    request: Request,
    bearer_token: Optional[str] = Depends(oauth2_scheme)
) -> str:
    cookie_token = request.cookies.get("smartstock_token")
    token = cookie_token or bearer_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Missing session cookie or Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token

async def get_current_user(
    token: str = Depends(get_token_from_request)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
        
    user = await User.find_one(User.username == token_data.username)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return user

async def require_owner(
    current_user: User = Depends(get_current_user)
) -> User:
    if getattr(current_user, "role", "admin") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Shop Owner access required for this operation."
        )
    return current_user

async def require_worker(
    current_user: User = Depends(get_current_user)
) -> User:
    # Allows both owner (admin) and counter workers
    return current_user

get_current_admin = require_owner

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

