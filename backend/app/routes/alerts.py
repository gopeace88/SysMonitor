from fastapi import APIRouter, Depends

from app.auth.jwt import verify_token
from app.scheduler import store

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(_: str = Depends(verify_token)):
    return store.get_all_alerts()


@router.get("/active")
async def active_alerts(_: str = Depends(verify_token)):
    return store.get_active_alerts()


@router.post("/{alert_id}/acknowledge")
async def acknowledge(alert_id: int, _: str = Depends(verify_token)):
    store.acknowledge_alert(alert_id)
    return {"status": "ok"}
