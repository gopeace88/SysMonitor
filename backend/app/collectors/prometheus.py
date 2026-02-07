import time
import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger("sysmonitor.prometheus")


class PrometheusCollector:
    QUERIES = {
        "cpu_usage": '100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
        "memory_total": "node_memory_MemTotal_bytes",
        "memory_available": "node_memory_MemAvailable_bytes",
        "memory_used": "node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes",
        "load1": "node_load1",
        "load5": "node_load5",
        "load15": "node_load15",
        "net_rx": 'irate(node_network_receive_bytes_total{device="eth0"}[5m])',
        "net_tx": 'irate(node_network_transmit_bytes_total{device="eth0"}[5m])',
        "fs_total": 'node_filesystem_size_bytes{mountpoint="/"}',
        "fs_used": 'node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_avail_bytes{mountpoint="/"}',
        "uptime": "node_time_seconds - node_boot_time_seconds",
    }

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or f"http://{settings.nas_host}:{settings.nas_prometheus_port}"

    async def collect(self) -> dict:
        results = {}
        async with httpx.AsyncClient(timeout=10) as client:
            for name, query in self.QUERIES.items():
                try:
                    resp = await client.get(
                        f"{self.base_url}/api/v1/query",
                        params={"query": query},
                    )
                    resp.raise_for_status()
                    results[name] = self._parse_scalar(resp.json())
                except Exception as e:
                    logger.debug(f"Query {name} failed: {e}")
                    results[name] = None
        return self._format(results)

    def _parse_scalar(self, raw: dict) -> Optional[float]:
        try:
            result = raw["data"]["result"]
            if not result:
                return None
            return float(result[0]["value"][1])
        except (KeyError, IndexError, ValueError):
            return None

    def _format(self, r: dict) -> dict:
        mem_total = r.get("memory_total") or 1
        return {
            "cpu": {
                "usage_percent": round(r.get("cpu_usage") or 0, 1),
                "per_core": [],
                "load_avg": [
                    round(r.get("load1") or 0, 2),
                    round(r.get("load5") or 0, 2),
                    round(r.get("load15") or 0, 2),
                ],
                "count": {"physical": 2, "logical": 4},
            },
            "memory": {
                "total_gb": round(mem_total / (1024**3), 1),
                "used_gb": round((r.get("memory_used") or 0) / (1024**3), 1),
                "available_gb": round((r.get("memory_available") or 0) / (1024**3), 1),
                "percent": round(((r.get("memory_used") or 0) / mem_total) * 100, 1),
                "swap_total_gb": 0,
                "swap_used_gb": 0,
                "swap_percent": 0,
            },
            "network": {
                "interfaces": [
                    {
                        "name": "eth0",
                        "is_up": True,
                        "speed_mbps": 1000,
                        "rx_bytes_sec": round(r.get("net_rx") or 0, 1),
                        "tx_bytes_sec": round(r.get("net_tx") or 0, 1),
                    }
                ]
            },
            "disks": [
                {
                    "device": "RAID5",
                    "mountpoint": "/volume1",
                    "fstype": "btrfs",
                    "total_gb": round((r.get("fs_total") or 0) / (1024**3), 1),
                    "used_gb": round((r.get("fs_used") or 0) / (1024**3), 1),
                    "free_gb": round(((r.get("fs_total") or 0) - (r.get("fs_used") or 0)) / (1024**3), 1),
                    "percent": round(((r.get("fs_used") or 0) / max(r.get("fs_total") or 1, 1)) * 100, 1),
                }
            ],
            "uptime_seconds": int(r.get("uptime") or 0),
            "process_count": {"total": 0, "running": 0, "sleeping": 0, "zombie": 0},
            "top_processes": [],
            "timestamp": time.time(),
        }
