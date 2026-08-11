from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from backend.app.models.user import User
from backend.app.auth.security import SECRET_KEY, ALGORITHM
from backend.app.schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme)
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
