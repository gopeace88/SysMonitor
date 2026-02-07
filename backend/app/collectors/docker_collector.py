import logging
from typing import Optional

logger = logging.getLogger("sysmonitor.docker")


class DockerCollector:
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                import docker
                self._client = docker.from_env()
            except Exception as e:
                logger.error(f"Docker client init failed: {e}")
        return self._client

    def collect(self) -> list:
        client = self._get_client()
        if not client:
            return []
        containers = []
        try:
            for c in client.containers.list(all=True):
                containers.append({
                    "id": c.short_id,
                    "name": c.name,
                    "image": c.image.tags[0] if c.image.tags else str(c.image.id)[:12],
                    "status": c.status,
                    "state": c.attrs["State"]["Status"],
                    "created": c.attrs["Created"],
                    "ports": self._format_ports(c.ports),
                })
        except Exception as e:
            logger.error(f"Docker collection failed: {e}")
        return containers

    def _format_ports(self, ports: dict) -> str:
        parts = []
        for container_port, bindings in (ports or {}).items():
            if bindings:
                for b in bindings:
                    parts.append(f"{b['HostPort']}->{container_port}")
            else:
                parts.append(container_port)
        return ", ".join(parts[:3])
