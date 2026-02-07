import logging
from typing import Optional

from app.storage.sqlite_store import SQLiteStore

logger = logging.getLogger("sysmonitor.alerts")

RULES = [
    {"type": "cpu_high", "metric": "cpu.usage_percent", "op": ">", "threshold": 90, "severity": "warning", "msg": "CPU usage > 90%"},
    {"type": "cpu_critical", "metric": "cpu.usage_percent", "op": ">", "threshold": 95, "severity": "critical", "msg": "CPU usage > 95%"},
    {"type": "mem_low", "metric": "memory.percent", "op": ">", "threshold": 90, "severity": "warning", "msg": "Memory usage > 90%"},
    {"type": "mem_critical", "metric": "memory.percent", "op": ">", "threshold": 95, "severity": "critical", "msg": "Memory usage > 95%"},
]


def _get_nested(data: dict, path: str) -> Optional[float]:
    keys = path.split(".")
    val = data
    for k in keys:
        if isinstance(val, dict):
            val = val.get(k)
        else:
            return None
    return val if isinstance(val, (int, float)) else None


def check_alerts(server_id: str, data: dict, store: SQLiteStore):
    active = {a["type"]: a for a in store.get_active_alerts() if a["server_id"] == server_id}

    for rule in RULES:
        val = _get_nested(data, rule["metric"])
        if val is None:
            continue

        triggered = val > rule["threshold"] if rule["op"] == ">" else val < rule["threshold"]

        if triggered and rule["type"] not in active:
            store.write_alert(server_id, rule["severity"], rule["type"],
                              f"{rule['msg']} (current: {val:.1f}%)")
            logger.warning(f"Alert: {server_id} {rule['type']} val={val}")
        elif not triggered and rule["type"] in active:
            store.resolve_alert(active[rule["type"]]["id"])
            logger.info(f"Resolved: {server_id} {rule['type']}")
