from fastapi import APIRouter, Depends

from app.auth.jwt import verify_token
from app.collectors.port_scanner import PortScanner

router = APIRouter(prefix="/api/v1/ports", tags=["ports"])
scanner = PortScanner()


@router.get("/status")
async def port_status(_: str = Depends(verify_token)):
    return scanner.get_status()


@router.get("/registry")
async def port_registry(_: str = Depends(verify_token)):
    return scanner.get_registry()


@router.get("/ranges")
async def port_ranges(_: str = Depends(verify_token)):
    return scanner.get_ranges()
