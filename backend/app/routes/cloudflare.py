from fastapi import APIRouter, Depends

from app.auth.jwt import verify_token
from app.collectors.cloudflare import CloudflareCollector
from app.config import settings

router = APIRouter(prefix="/api/v1/cloudflare", tags=["cloudflare"])
cf = CloudflareCollector()

ZONE_MAP = {
    "purions": settings.cf_zone_purions,
    "rtk": settings.cf_zone_rtk,
}


@router.get("/tunnels")
async def tunnels(_: str = Depends(verify_token)):
    tunnels_list = await cf.get_tunnels()
    result = []
    for t in tunnels_list:
        config = await cf.get_tunnel_config(t["id"])
        result.append({**t, "ingress": config})
    return result


@router.get("/dns/{zone}")
async def dns_records(zone: str, _: str = Depends(verify_token)):
    zone_id = ZONE_MAP.get(zone)
    if not zone_id:
        return {"error": f"Unknown zone: {zone}. Use: {list(ZONE_MAP.keys())}"}
    return await cf.get_dns_records(zone_id)


@router.get("/warp/devices")
async def warp_devices(_: str = Depends(verify_token)):
    return await cf.get_warp_devices()
