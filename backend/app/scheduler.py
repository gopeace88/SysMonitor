import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.collectors.cloudflare import CloudflareCollector
from app.storage.cache import MetricsCache

logger = logging.getLogger("sysmonitor")

cache = MetricsCache()
cf_collector = CloudflareCollector()


async def collect_cloudflare():
    try:
        tunnels = await cf_collector.get_tunnels()
        for t in tunnels:
            t["ingress"] = await cf_collector.get_tunnel_config(t["id"])
        cache.update("cf_tunnels", {"tunnels": tunnels})
        logger.info(f"Cloudflare: cached {len(tunnels)} tunnels")
    except Exception as e:
        logger.error(f"Cloudflare collection failed: {e}")


def start_scheduler():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    scheduler = AsyncIOScheduler()
    scheduler.add_job(collect_cloudflare, "interval", seconds=settings.collect_interval,
                      id="collect_cloudflare", replace_existing=True)
    scheduler.start()
    logger.info(f"Scheduler started: caching Cloudflare every {settings.collect_interval}s")
    asyncio.get_event_loop().create_task(collect_cloudflare())
