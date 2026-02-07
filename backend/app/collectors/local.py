import psutil
import time


class LocalCollector:
    def __init__(self):
        self._prev_net = None
        self._prev_time = None

    def collect(self) -> dict:
        now = time.time()
        cpu = self._collect_cpu()
        memory = self._collect_memory()
        disks = self._collect_disks()
        network = self._collect_network(now)
        processes = self._collect_processes()
        self._prev_time = now

        return {
            "cpu": cpu,
            "memory": memory,
            "disks": disks,
            "network": network,
            "uptime_seconds": int(now - psutil.boot_time()),
            "process_count": processes["count"],
            "top_processes": processes["top"],
            "timestamp": now,
        }

    def _collect_cpu(self) -> dict:
        per_core = psutil.cpu_percent(interval=0, percpu=True)
        load = psutil.getloadavg()
        return {
            "usage_percent": round(sum(per_core) / len(per_core), 1) if per_core else 0,
            "per_core": per_core,
            "load_avg": list(load),
            "count": {"physical": psutil.cpu_count(logical=False), "logical": psutil.cpu_count()},
        }

    def _collect_memory(self) -> dict:
        vm = psutil.virtual_memory()
        sw = psutil.swap_memory()
        return {
            "total_gb": round(vm.total / (1024**3), 1),
            "used_gb": round(vm.used / (1024**3), 1),
            "available_gb": round(vm.available / (1024**3), 1),
            "percent": vm.percent,
            "swap_total_gb": round(sw.total / (1024**3), 1),
            "swap_used_gb": round(sw.used / (1024**3), 1),
            "swap_percent": sw.percent,
        }

    def _collect_disks(self) -> list:
        result = []
        for part in psutil.disk_partitions(all=False):
            if part.fstype in ("", "squashfs", "tmpfs", "devtmpfs", "overlay"):
                continue
            try:
                usage = psutil.disk_usage(part.mountpoint)
            except PermissionError:
                continue
            result.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total_gb": round(usage.total / (1024**3), 1),
                "used_gb": round(usage.used / (1024**3), 1),
                "free_gb": round(usage.free / (1024**3), 1),
                "percent": round(usage.percent, 1),
            })
        return result

    def _collect_network(self, now: float) -> dict:
        counters = psutil.net_io_counters(pernic=True)
        stats = psutil.net_if_stats()
        elapsed = (now - self._prev_time) if self._prev_time else 1

        interfaces = []
        for name, cnt in counters.items():
            if name == "lo":
                continue
            st = stats.get(name)
            iface = {
                "name": name,
                "is_up": st.isup if st else False,
                "speed_mbps": st.speed if st else 0,
                "rx_bytes": cnt.bytes_recv,
                "tx_bytes": cnt.bytes_sent,
                "rx_bytes_sec": 0.0,
                "tx_bytes_sec": 0.0,
                "rx_packets": cnt.packets_recv,
                "tx_packets": cnt.packets_sent,
                "errors_in": cnt.errin,
                "errors_out": cnt.errout,
                "drops_in": cnt.dropin,
                "drops_out": cnt.dropout,
            }
            if self._prev_net and name in self._prev_net:
                prev = self._prev_net[name]
                iface["rx_bytes_sec"] = round((cnt.bytes_recv - prev.bytes_recv) / elapsed, 1)
                iface["tx_bytes_sec"] = round((cnt.bytes_sent - prev.bytes_sent) / elapsed, 1)
            interfaces.append(iface)

        self._prev_net = counters
        return {"interfaces": interfaces}

    def _collect_processes(self) -> dict:
        statuses = {"running": 0, "sleeping": 0, "zombie": 0, "other": 0}
        procs = []
        for p in psutil.process_iter(["pid", "name", "status", "cpu_percent", "memory_percent"]):
            info = p.info
            s = info.get("status", "other")
            if s in statuses:
                statuses[s] += 1
            else:
                statuses["other"] += 1
            procs.append(info)

        top = sorted(procs, key=lambda x: x.get("cpu_percent") or 0, reverse=True)[:10]
        return {
            "count": {
                "total": len(procs),
                "running": statuses["running"],
                "sleeping": statuses["sleeping"],
                "zombie": statuses["zombie"],
            },
            "top": [
                {
                    "pid": p["pid"],
                    "name": p["name"],
                    "cpu_percent": round(p.get("cpu_percent") or 0, 1),
                    "memory_percent": round(p.get("memory_percent") or 0, 1),
                }
                for p in top
            ],
        }
