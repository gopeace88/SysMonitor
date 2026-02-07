import time
from fastapi import APIRouter, Depends, HTTPException

from app.auth.jwt import verify_token
from app.scheduler import cache, store

router = APIRouter(prefix="/api/v1/servers", tags=["servers"])

SERVERS = {
    "purions00": {"id": "purions00", "name": "Purions00", "ip": "192.192.192.169", "os": "Ubuntu 24.04 LTS"},
    "rtk_nas": {"id": "rtk_nas", "name": "RTK NAS", "ip": "192.192.192.145", "os": "Synology DSM 7.3.2"},
}


@router.get("")
async def list_servers(_: str = Depends(verify_token)):
    result = []
    for sid, info in SERVERS.items():
        latest = cache.get_latest(sid)
        status = "up" if latest else "down"
        summary = {}
        if latest:
            summary = {
                "cpu_percent": latest.get("cpu", {}).get("usage_percent", 0),
                "mem_percent": latest.get("memory", {}).get("percent", 0),
                "uptime_seconds": latest.get("uptime_seconds", 0),
            }
        result.append({**info, "status": status, **summary})
    return result


@router.get("/{server_id}/overview")
async def server_overview(server_id: str, _: str = Depends(verify_token)):
    if server_id not in SERVERS:
        raise HTTPException(status_code=404, detail="Server not found")
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    return {**SERVERS[server_id], "metrics": latest}


@router.get("/{server_id}/cpu")
async def server_cpu(server_id: str, _: str = Depends(verify_token)):
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    history = cache.get_history(server_id)
    return {
        "current": latest.get("cpu"),
        "history": [
            {"timestamp": h["timestamp"], "usage_percent": h["cpu"]["usage_percent"]}
            for h in history if "cpu" in h
        ],
    }


@router.get("/{server_id}/memory")
async def server_memory(server_id: str, _: str = Depends(verify_token)):
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    history = cache.get_history(server_id)
    return {
        "current": latest.get("memory"),
        "history": [
            {"timestamp": h["timestamp"], "percent": h["memory"]["percent"]}
            for h in history if "memory" in h
        ],
    }


@router.get("/{server_id}/disk")
async def server_disk(server_id: str, _: str = Depends(verify_token)):
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    return {"disks": latest.get("disks", [])}


@router.get("/{server_id}/network")
async def server_network(server_id: str, _: str = Depends(verify_token)):
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    history = cache.get_history(server_id)
    return {
        "current": latest.get("network", {}),
        "history": [
            {
                "timestamp": h["timestamp"],
                "interfaces": h.get("network", {}).get("interfaces", []),
            }
            for h in history if "network" in h
        ],
    }


@router.get("/{server_id}/processes")
async def server_processes(server_id: str, _: str = Depends(verify_token)):
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    return {
        "count": latest.get("process_count"),
        "top": latest.get("top_processes", []),
    }


@router.get("/{server_id}/docker")
async def server_docker(server_id: str, _: str = Depends(verify_token)):
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    return {"containers": latest.get("docker", [])}
