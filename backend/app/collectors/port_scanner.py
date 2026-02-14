import logging
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from app.config import settings

logger = logging.getLogger("sysmonitor.ports")

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv"}


class PortScanner:
    def __init__(self):
        self.projects_dir: Path = settings.projects_dir
        self.registry_path: Path = self.projects_dir / "SysMonitor" / "ports.yml"

    # ── Registry ─────────────────────────────────────────────────────

    def _load_registry(self) -> dict[str, Any]:
        if not self.registry_path.exists():
            logger.warning(f"Registry not found: {self.registry_path}")
            return {"ranges": {}, "services": []}
        try:
            return yaml.safe_load(self.registry_path.read_text()) or {}
        except Exception as e:
            logger.error(f"Failed to read ports.yml: {e}")
            return {"ranges": {}, "services": []}

    def _registry_by_port(self) -> dict[int, dict]:
        registry = self._load_registry()
        result: dict[int, dict] = {}
        for svc in registry.get("services", []):
            port = svc.get("port")
            if port is not None:
                result[int(port)] = svc
        return result

    # ── Source 1: Runtime (ss -tlnp) ─────────────────────────────────

    def _scan_runtime(self) -> dict[int, dict]:
        """Run ss -tlnp and parse listening TCP ports."""
        ports: dict[int, dict] = {}
        try:
            result = subprocess.run(
                ["ss", "-tlnp"],
                capture_output=True, text=True, timeout=10,
            )
            for line in result.stdout.splitlines()[1:]:  # skip header
                parts = line.split()
                if len(parts) < 5:
                    continue
                local_addr = parts[3]
                # parse address:port  (could be [::]:port, *:port, 0.0.0.0:port, 127.0.0.1:port)
                if "]:" in local_addr:
                    bind, port_str = local_addr.rsplit(":", 1)
                else:
                    bind, _, port_str = local_addr.rpartition(":")
                try:
                    port = int(port_str)
                except ValueError:
                    continue

                # extract process info from the last column if present
                process_name = ""
                pid = None
                process_col = parts[-1] if len(parts) >= 6 else ""
                m = re.search(r'users:\(\("([^"]+)",pid=(\d+)', process_col)
                if m:
                    process_name = m.group(1)
                    pid = int(m.group(2))

                # keep first seen entry per port (most specific bind)
                if port not in ports:
                    ports[port] = {
                        "bind": bind,
                        "process": process_name,
                        "pid": pid,
                    }
        except Exception as e:
            logger.error(f"Failed to run ss: {e}")
        return ports

    # ── Source 2: Docker Compose ─────────────────────────────────────

    def _scan_docker_compose(self) -> dict[int, dict]:
        """Parse docker-compose.yml files for port mappings."""
        ports: dict[int, dict] = {}
        for dc_path in self.projects_dir.rglob("docker-compose.yml"):
            # skip unwanted directories
            if any(part in SKIP_DIRS for part in dc_path.parts):
                continue
            try:
                content = yaml.safe_load(dc_path.read_text())
                if not content or "services" not in content:
                    continue
                project = dc_path.parent.relative_to(self.projects_dir)
                for svc_name, svc_conf in content["services"].items():
                    # Standard port mappings
                    for mapping in svc_conf.get("ports", []):
                        mapping_str = str(mapping)
                        # formats: "8400:8400", "8400:8400/tcp", "127.0.0.1:8400:8400"
                        m = re.match(
                            r"(?:[\d.]+:)?(\d+):\d+(?:/\w+)?$",
                            mapping_str,
                        )
                        if m:
                            host_port = int(m.group(1))
                            ports[host_port] = {
                                "source": "docker-compose",
                                "project": str(project),
                                "service": svc_name,
                                "file": str(dc_path),
                            }

                    # network_mode: host with PORT env vars
                    if svc_conf.get("network_mode") == "host":
                        for env_entry in svc_conf.get("environment", []):
                            env_str = str(env_entry)
                            if "PORT" in env_str.upper():
                                em = re.match(r"[^=]*PORT[^=]*=(\d+)", env_str, re.IGNORECASE)
                                if em:
                                    host_port = int(em.group(1))
                                    ports[host_port] = {
                                        "source": "docker-compose",
                                        "project": str(project),
                                        "service": svc_name,
                                        "file": str(dc_path),
                                    }
            except Exception as e:
                logger.debug(f"Failed to parse {dc_path}: {e}")
        return ports

    # ── Source 3: System config files ────────────────────────────────

    def _scan_system_config(self) -> dict[int, dict]:
        """Parse system config files for port settings."""
        ports: dict[int, dict] = {}

        # SSH
        sshd_conf = Path("/etc/ssh/sshd_config")
        if sshd_conf.exists():
            try:
                for line in sshd_conf.read_text().splitlines():
                    line = line.strip()
                    if line.startswith("#") or not line:
                        continue
                    m = re.match(r"^Port\s+(\d+)", line, re.IGNORECASE)
                    if m:
                        ports[int(m.group(1))] = {
                            "source": "system-config",
                            "service": "sshd",
                            "file": str(sshd_conf),
                        }
            except Exception as e:
                logger.debug(f"Failed to parse sshd_config: {e}")

        # Samba - hardcoded 139/445
        smb_conf = Path("/etc/samba/smb.conf")
        if smb_conf.exists():
            ports[139] = {"source": "system-config", "service": "samba", "file": str(smb_conf)}
            ports[445] = {"source": "system-config", "service": "samba", "file": str(smb_conf)}

        # Mosquitto
        for conf_path in Path("/etc/mosquitto").glob("*.conf") if Path("/etc/mosquitto").exists() else []:
            try:
                for line in conf_path.read_text().splitlines():
                    line = line.strip()
                    if line.startswith("#") or not line:
                        continue
                    m = re.match(r"^(?:port|listener)\s+(\d+)", line, re.IGNORECASE)
                    if m:
                        ports[int(m.group(1))] = {
                            "source": "system-config",
                            "service": "mosquitto",
                            "file": str(conf_path),
                        }
            except Exception as e:
                logger.debug(f"Failed to parse {conf_path}: {e}")

        # Cloudflared systemd services
        systemd_dir = Path("/etc/systemd/system")
        if systemd_dir.exists():
            for svc_file in systemd_dir.glob("cloudflared*.service"):
                try:
                    text = svc_file.read_text()
                    for m in re.finditer(r"localhost:(\d+)", text):
                        ports[int(m.group(1))] = {
                            "source": "system-config",
                            "service": "cloudflared",
                            "file": str(svc_file),
                        }
                except Exception as e:
                    logger.debug(f"Failed to parse {svc_file}: {e}")

        return ports

    # ── Source 4: Project config (.env, package.json) ────────────────

    def _scan_project_config(self) -> dict[int, dict]:
        """Parse .env and package.json for port settings."""
        ports: dict[int, dict] = {}

        # .env files with *PORT*=NUMBER
        for env_path in self.projects_dir.rglob(".env"):
            if any(part in SKIP_DIRS for part in env_path.parts):
                continue
            try:
                project = env_path.parent.relative_to(self.projects_dir)
                for line in env_path.read_text().splitlines():
                    line = line.strip()
                    if line.startswith("#") or not line:
                        continue
                    m = re.match(r"[^=]*PORT[^=]*=\s*(\d+)", line, re.IGNORECASE)
                    if m:
                        port = int(m.group(1))
                        ports[port] = {
                            "source": "project-config",
                            "project": str(project),
                            "file": str(env_path),
                        }
            except Exception as e:
                logger.debug(f"Failed to parse {env_path}: {e}")

        # package.json scripts for --port and -p args
        for pkg_path in self.projects_dir.rglob("package.json"):
            if any(part in SKIP_DIRS for part in pkg_path.parts):
                continue
            try:
                import json
                pkg = json.loads(pkg_path.read_text())
                scripts = pkg.get("scripts", {})
                project = pkg_path.parent.relative_to(self.projects_dir)
                for script_name, script_cmd in scripts.items():
                    for m in re.finditer(r"(?:--port|-p)\s+(\d+)", str(script_cmd)):
                        port = int(m.group(1))
                        ports[port] = {
                            "source": "project-config",
                            "project": str(project),
                            "file": str(pkg_path),
                            "script": script_name,
                        }
            except Exception as e:
                logger.debug(f"Failed to parse {pkg_path}: {e}")

        return ports

    # ── Status classification ────────────────────────────────────────

    def _classify_ports(
        self,
        registry: dict[int, dict],
        runtime: dict[int, dict],
        docker: dict[int, dict],
        system_cfg: dict[int, dict],
        project_cfg: dict[int, dict],
    ) -> list[dict[str, Any]]:
        """Cross-reference all sources and classify each port."""
        all_ports: set[int] = set()
        all_ports.update(registry.keys())
        all_ports.update(runtime.keys())
        all_ports.update(docker.keys())
        all_ports.update(system_cfg.keys())
        all_ports.update(project_cfg.keys())

        results: list[dict[str, Any]] = []
        for port in sorted(all_ports):
            in_registry = port in registry
            in_runtime = port in runtime
            in_config = port in docker or port in system_cfg or port in project_cfg

            # Determine status
            if in_registry and in_runtime:
                status = "active"
            elif in_registry and not in_runtime:
                status = "inactive"
            elif in_config and not in_registry:
                status = "configured"
            elif in_runtime and not in_registry:
                status = "unregistered"
            else:
                status = "configured"

            # Build sources list
            sources: list[str] = []
            if in_runtime:
                sources.append("runtime")
            if port in docker:
                sources.append("docker-compose")
            if port in system_cfg:
                sources.append("system-config")
            if port in project_cfg:
                sources.append("project-config")
            if in_registry:
                sources.append("registry")

            # Build entry
            reg = registry.get(port, {})
            rt = runtime.get(port, {})
            entry: dict[str, Any] = {
                "port": port,
                "status": status,
                "sources": sources,
                "name": reg.get("name", ""),
                "project": reg.get("project", ""),
                "category": reg.get("category", ""),
                "process": rt.get("process", ""),
                "pid": rt.get("pid"),
                "bind": rt.get("bind", ""),
            }

            # Fill project from config sources if not in registry
            if not entry["project"]:
                for cfg in [docker.get(port, {}), system_cfg.get(port, {}), project_cfg.get(port, {})]:
                    if cfg.get("project"):
                        entry["project"] = cfg["project"]
                        break
                    if cfg.get("service"):
                        entry["name"] = cfg["service"]
                        break

            results.append(entry)

        return results

    # ── Public API ───────────────────────────────────────────────────

    def get_status(self) -> dict[str, Any]:
        """Full port scan: cross-reference all sources with registry."""
        registry = self._registry_by_port()
        runtime = self._scan_runtime()
        docker = self._scan_docker_compose()
        system_cfg = self._scan_system_config()
        project_cfg = self._scan_project_config()

        ports = self._classify_ports(registry, runtime, docker, system_cfg, project_cfg)

        summary = {
            "total": len(ports),
            "registered": sum(1 for p in ports if p["status"] in ("active", "inactive")),
            "active": sum(1 for p in ports if p["status"] == "active"),
            "inactive": sum(1 for p in ports if p["status"] == "inactive"),
            "configured": sum(1 for p in ports if p["status"] == "configured"),
            "unregistered": sum(1 for p in ports if p["status"] == "unregistered"),
            "conflict": 0,
        }

        return {
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "summary": summary,
            "ports": ports,
        }

    def get_registry(self) -> dict[str, Any]:
        """Return ports.yml content."""
        return self._load_registry()

    def get_ranges(self) -> list[dict[str, Any]]:
        """Return category ranges with usage stats."""
        registry_data = self._load_registry()
        ranges_raw = registry_data.get("ranges", {})
        services = registry_data.get("services", [])
        runtime = self._scan_runtime()

        results: list[dict[str, Any]] = []
        for category, range_str in ranges_raw.items():
            m = re.match(r"(\d+)-(\d+)", str(range_str))
            if not m:
                continue
            lo, hi = int(m.group(1)), int(m.group(2))

            category_ports = [s for s in services if s.get("category") == category]
            registered_count = len(category_ports)
            port_list = [s["port"] for s in category_ports]
            active_count = sum(1 for p in port_list if p in runtime)

            results.append({
                "category": category,
                "range": range_str,
                "start": lo,
                "end": hi,
                "registered": registered_count,
                "active": active_count,
                "ports": sorted(port_list),
            })

        return results
