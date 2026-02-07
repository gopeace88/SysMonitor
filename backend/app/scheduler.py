import asyncio
import logging
import time
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.collectors.local import LocalCollector
from app.collectors.prometheus import PrometheusCollector
from app.collectors.docker_collector import DockerCollector
from app.storage.cache import MetricsCache
from app.storage.sqlite_store import SQLiteStore
from app.alerts.engine import check_alerts

logger = logging.getLogger("sysmonitor")

cache = MetricsCache()
store = SQLiteStore(settings.data_dir / "sysmonitor.db")
local_collector = LocalCollector()
prom_collector = PrometheusCollector()
docker_collector = DockerCollector()


def _persist_metrics(server_id: str, data: dict):
    ts = int(data.get("timestamp", time.time()))
    if "cpu" in data and data["cpu"]:
        store.write_metric(server_id, "cpu", "usage_percent",
                           data["cpu"].get("usage_percent", 0), ts)
    if "memory" in data and data["memory"]:
        store.write_metric(server_id, "memory", "percent",
                           data["memory"].get("percent", 0), ts)
    if "disks" in data:
        for disk in data["disks"]:
            store.write_metric(server_id, "disk", f"percent:{disk['mountpoint']}",
                               disk.get("percent", 0), ts)
    if "network" in data:
        for iface in data["network"].get("interfaces", []):
            store.write_metric(server_id, "network", f"rx:{iface['name']}",
                               iface.get("rx_bytes_sec", 0), ts)
            store.write_metric(server_id, "network", f"tx:{iface['name']}",
                               iface.get("tx_bytes_sec", 0), ts)


async def collect_all():
    # Local server
    try:
        local_data = local_collector.collect()
        local_data["docker"] = docker_collector.collect()
        cache.update("purions00", local_data)
        _persist_metrics("purions00", local_data)
        check_alerts("purions00", local_data, store)
        logger.info(f"Local: CPU={local_data['cpu']['usage_percent']}% MEM={local_data['memory']['percent']}%")
    except Exception as e:
        logger.error(f"Local collection failed: {e}")

    # NAS via Prometheus
    try:
        nas_data = await prom_collector.collect()
        cache.update("rtk_nas", nas_data)
        _persist_metrics("rtk_nas", nas_data)
        check_alerts("rtk_nas", nas_data, store)
        logger.info(f"NAS: CPU={nas_data['cpu']['usage_percent']}% MEM={nas_data['memory']['percent']}%")
    except Exception as e:
        logger.error(f"NAS collection failed: {e}")


def start_scheduler():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    scheduler = AsyncIOScheduler()
    scheduler.add_job(collect_all, "interval", seconds=settings.collect_interval,
                      id="collect_metrics", replace_existing=True)
    scheduler.start()
    logger.info(f"Scheduler started: collecting every {settings.collect_interval}s")
    asyncio.get_event_loop().create_task(collect_all())
