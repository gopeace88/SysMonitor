import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger("sysmonitor.cloudflare")

CF_BASE = "https://api.cloudflare.com/client/v4"


class CloudflareCollector:
    def __init__(self):
        self.headers = {
            "X-Auth-Email": settings.cf_api_email,
            "X-Auth-Key": settings.cf_api_key,
            "Content-Type": "application/json",
        }
        self.account_id = settings.cf_account_id

    def _enabled(self) -> bool:
        return bool(settings.cf_api_email and settings.cf_api_key)

    async def get_tunnels(self) -> list:
        if not self._enabled():
            return []
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{CF_BASE}/accounts/{self.account_id}/cfd_tunnel",
                headers=self.headers,
                params={"is_deleted": "false"},
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("success"):
                return []
            return [
                {
                    "id": t["id"],
                    "name": t["name"],
                    "status": t.get("status", "unknown"),
                    "created_at": t.get("created_at"),
                    "connections": len(t.get("connections", [])),
                }
                for t in data["result"]
            ]

    async def get_tunnel_config(self, tunnel_id: str) -> list:
        if not self._enabled():
            return []
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{CF_BASE}/accounts/{self.account_id}/cfd_tunnel/{tunnel_id}/configurations",
                headers=self.headers,
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("success"):
                return []
            ingress = data["result"]["config"]["ingress"]
            return [
                {"hostname": i.get("hostname", "(catch-all)"), "service": i.get("service", "http_status:404")}
                for i in ingress
            ]

    async def get_dns_records(self, zone_id: str) -> list:
        if not self._enabled():
            return []
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{CF_BASE}/zones/{zone_id}/dns_records",
                headers=self.headers,
                params={"per_page": 100},
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("success"):
                return []
            return [
                {
                    "type": r["type"],
                    "name": r["name"],
                    "content": r["content"][:60],
                    "proxied": r.get("proxied", False),
                }
                for r in data["result"]
            ]

    async def get_warp_devices(self) -> list:
        if not self._enabled():
            return []
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{CF_BASE}/accounts/{self.account_id}/devices",
                headers=self.headers,
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("success"):
                return []
            return [
                {
                    "name": d.get("name", "?"),
                    "type": d.get("device_type", "?"),
                    "version": d.get("version", "?"),
                    "ip": d.get("ip", "?"),
                    "last_seen": d.get("last_seen"),
                }
                for d in data["result"]
            ]
