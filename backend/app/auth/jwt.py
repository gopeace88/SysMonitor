from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings

security = HTTPBearer()


def create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours)
    return jwt.encode(
        {"sub": username, "exp": expire},
        settings.jwt_secret,
        algorithm="HS256",
    )


def verify_token(cred: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(cred.credentials, settings.jwt_secret, algorithms=["HS256"])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
