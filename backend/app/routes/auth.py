from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.auth.jwt import create_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(req: LoginRequest):
    if req.username != settings.admin_username or req.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(req.username)
    return {"access_token": token, "token_type": "bearer"}
