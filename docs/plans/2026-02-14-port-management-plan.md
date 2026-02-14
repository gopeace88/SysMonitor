# Port Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add port registry + real-time scanning to SysMonitor so all server ports are visible and manageable from a single dashboard.

**Architecture:** YAML registry (`ports.yml`) declares known port assignments. A backend collector scans 4 sources on each API call (ss, docker-compose, system config, project .env/package.json), cross-references with registry, and classifies each port into 5 statuses. Frontend renders a `/ports` page with summary cards, filtered table, and range visualization.

**Tech Stack:** FastAPI (Python), Next.js 14, Tailwind v4, SWR, PyYAML, existing DataTable component.

---

### Task 1: Create ports.yml registry

**Files:**
- Create: `ports.yml`

**Step 1: Create the registry file with all known ports**

```yaml
# ports.yml - Central port registry for purions00 server
# All projects MUST register their ports here before deployment.

ranges:
  system: "1-1023"
  infrastructure: "3000-3499"
  dev: "5000-5999"
  database: "5400-5499"
  cache: "6300-6399"
  backend: "8000-8999"
  monitoring: "9000-9199"

services:
  # === System ===
  - name: SSH
    port: 22
    project: system
    category: system

  - name: Samba
    port: 139
    project: system
    category: system

  - name: Samba (CIFS)
    port: 445
    project: system
    category: system

  - name: CUPS
    port: 631
    project: system
    category: system

  - name: Mosquitto MQTT
    port: 1883
    project: system
    category: system

  - name: Cloudflared SSH Proxy
    port: 2222
    project: system
    category: system

  # === SysMonitor ===
  - name: SysMonitor Frontend
    port: 3400
    project: SysMonitor
    category: infrastructure

  - name: SysMonitor Backend
    port: 8400
    project: SysMonitor
    category: backend

  # === Monitoring ===
  - name: Grafana
    port: 3300
    project: SysMonitor/monitoring
    category: monitoring

  - name: Portainer
    port: 9000
    project: system
    category: monitoring

  - name: Portainer HTTPS
    port: 9443
    project: system
    category: monitoring

  - name: Prometheus
    port: 9090
    project: SysMonitor/monitoring
    category: monitoring

  - name: Node Exporter
    port: 9100
    project: SysMonitor/monitoring
    category: monitoring

  # === caffe24 ===
  - name: PostgreSQL (caffe24)
    port: 5433
    project: caffe24
    category: database

  - name: Redis (caffe24)
    port: 6379
    project: caffe24/c24-assistant
    category: cache

  - name: Redis (caffe24 main)
    port: 6380
    project: caffe24
    category: cache
```

**Step 2: Commit**

```bash
git add ports.yml
git commit -m "feat: create ports.yml registry with known port assignments"
```

---

### Task 2: Create port scanner collector

**Files:**
- Create: `backend/app/collectors/port_scanner.py`
- Modify: `backend/app/config.py` (add projects_dir setting)

**Step 1: Add projects_dir to config**

In `backend/app/config.py`, add one field to Settings:

```python
projects_dir: Path = Path("/home/nvme1/jhkim/00.Projects")
```

Also add to `.env`:
```
PROJECTS_DIR=/home/nvme1/jhkim/00.Projects
```

**Step 2: Create the port scanner collector**

Create `backend/app/collectors/port_scanner.py`:

```python
import json
import logging
import re
import subprocess
from pathlib import Path
from typing import Any

import yaml

from app.config import settings

logger = logging.getLogger("sysmonitor.ports")


class PortScanner:
    def __init__(self):
        self.projects_dir: Path = settings.projects_dir
        self.registry_path: Path = self.projects_dir / "SysMonitor" / "ports.yml"

    # --- Registry ---

    def _read_registry(self) -> dict[str, Any]:
        if not self.registry_path.exists():
            return {"ranges": {}, "services": []}
        try:
            return yaml.safe_load(self.registry_path.read_text()) or {"ranges": {}, "services": []}
        except Exception as e:
            logger.error(f"Failed to read ports.yml: {e}")
            return {"ranges": {}, "services": []}

    # --- Source 1: Runtime (ss -tlnp) ---

    def _scan_runtime(self) -> dict[int, dict]:
        """Scan currently listening TCP ports via ss."""
        result: dict[int, dict] = {}
        try:
            out = subprocess.run(
                ["ss", "-tlnp"],
                capture_output=True, text=True, timeout=5,
            )
            for line in out.stdout.strip().split("\n")[1:]:  # skip header
                parts = line.split()
                if len(parts) < 6:
                    continue
                addr = parts[3]
                # extract port from addr like 0.0.0.0:8400 or [::]:22 or *:3300
                port_str = addr.rsplit(":", 1)[-1]
                if not port_str.isdigit():
                    continue
                port = int(port_str)
                # extract process name from users:(("name",pid=123,...))
                process_info = parts[-1] if "users:" in parts[-1] else ""
                process_name = ""
                pid = 0
                m = re.search(r'users:\(\("([^"]+)",pid=(\d+)', process_info)
                if m:
                    process_name = m.group(1)
                    pid = int(m.group(2))
                # extract bind address (without port)
                bind = addr.rsplit(":", 1)[0]
                if port not in result:
                    result[port] = {
                        "process": process_name,
                        "pid": pid,
                        "bind": bind,
                    }
        except Exception as e:
            logger.error(f"ss scan failed: {e}")
        return result

    # --- Source 2: Docker Compose files ---

    def _scan_docker_compose(self) -> dict[int, dict]:
        """Parse all docker-compose.yml files for port mappings."""
        result: dict[int, dict] = {}
        for dc_path in self.projects_dir.rglob("docker-compose.yml"):
            # skip node_modules, .git, etc.
            if any(part.startswith(".") or part == "node_modules" for part in dc_path.parts):
                continue
            try:
                data = yaml.safe_load(dc_path.read_text())
                if not data or "services" not in data:
                    continue
                project = str(dc_path.parent.relative_to(self.projects_dir))
                for svc_name, svc_conf in data["services"].items():
                    # Standard port mappings
                    for p in svc_conf.get("ports", []):
                        port_str = str(p).split(":")[0].strip().strip('"').strip("'")
                        if port_str.isdigit():
                            port = int(port_str)
                            result[port] = {
                                "service": svc_name,
                                "file": str(dc_path),
                                "project": project,
                            }
                    # Host network mode: check environment for port vars
                    if svc_conf.get("network_mode") == "host":
                        for env in svc_conf.get("environment", []):
                            env_str = str(env)
                            if "PORT" in env_str.upper() and "=" in env_str:
                                val = env_str.split("=", 1)[1].strip()
                                if val.isdigit():
                                    result[int(val)] = {
                                        "service": svc_name,
                                        "file": str(dc_path),
                                        "project": project,
                                    }
            except Exception as e:
                logger.warning(f"Failed to parse {dc_path}: {e}")
        return result

    # --- Source 3: System config files ---

    def _scan_system_configs(self) -> dict[int, dict]:
        """Parse system service config files for port assignments."""
        result: dict[int, dict] = {}

        # SSH
        sshd = Path("/etc/ssh/sshd_config")
        if sshd.exists():
            for line in sshd.read_text().splitlines():
                line = line.strip()
                if line.startswith("Port "):
                    port_str = line.split()[1]
                    if port_str.isdigit():
                        result[int(port_str)] = {"service": "sshd", "file": str(sshd)}

        # Samba
        smb = Path("/etc/samba/smb.conf")
        if smb.exists():
            result[139] = {"service": "smbd", "file": str(smb)}
            result[445] = {"service": "smbd", "file": str(smb)}

        # Mosquitto
        for conf in Path("/etc/mosquitto").glob("*.conf") if Path("/etc/mosquitto").exists() else []:
            for line in conf.read_text().splitlines():
                line = line.strip()
                if line.startswith("listener ") or line.startswith("port "):
                    port_str = line.split()[1]
                    if port_str.isdigit():
                        result[int(port_str)] = {"service": "mosquitto", "file": str(conf)}

        # Cloudflared systemd services
        systemd_dir = Path("/etc/systemd/system")
        if systemd_dir.exists():
            for svc_file in systemd_dir.glob("cloudflared*.service"):
                content = svc_file.read_text()
                # match patterns like --url 127.0.0.1:2222 or --url localhost:PORT
                for m in re.finditer(r"(?:localhost|127\.0\.0\.1):(\d+)", content):
                    result[int(m.group(1))] = {"service": svc_file.stem, "file": str(svc_file)}

        return result

    # --- Source 4: Project config files (.env, package.json) ---

    def _scan_project_configs(self) -> dict[int, dict]:
        """Parse .env files and package.json for port assignments."""
        result: dict[int, dict] = {}

        # .env files
        for env_path in self.projects_dir.rglob(".env"):
            if any(part.startswith(".") or part == "node_modules" for part in env_path.parts):
                continue
            try:
                project = str(env_path.parent.relative_to(self.projects_dir))
                for line in env_path.read_text().splitlines():
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip().upper()
                    val = val.strip().strip('"').strip("'")
                    if "PORT" in key and val.isdigit():
                        port = int(val)
                        if 1024 < port < 65535:
                            result[port] = {"source": "env", "file": str(env_path), "project": project, "key": key}
            except Exception:
                pass

        # package.json scripts with --port
        for pkg_path in self.projects_dir.rglob("package.json"):
            if any(part.startswith(".") or part == "node_modules" for part in pkg_path.parts):
                continue
            try:
                data = json.loads(pkg_path.read_text())
                scripts = data.get("scripts", {})
                project = str(pkg_path.parent.relative_to(self.projects_dir))
                for script_name, script_cmd in scripts.items():
                    for m in re.finditer(r"--port[= ]+(\d+)", str(script_cmd)):
                        port = int(m.group(1))
                        result[port] = {"source": "package.json", "file": str(pkg_path), "project": project, "script": script_name}
                    # also match -p PORT pattern (common in next dev -p 3000)
                    for m in re.finditer(r"\s-p\s+(\d+)", str(script_cmd)):
                        port = int(m.group(1))
                        result[port] = {"source": "package.json", "file": str(pkg_path), "project": project, "script": script_name}
            except Exception:
                pass

        return result

    # --- Aggregation ---

    def get_status(self) -> dict[str, Any]:
        """Full scan: merge all sources, cross-reference registry, classify status."""
        registry = self._read_registry()
        registry_by_port = {s["port"]: s for s in registry.get("services", [])}

        runtime = self._scan_runtime()
        docker = self._scan_docker_compose()
        system = self._scan_system_configs()
        project = self._scan_project_configs()

        # Collect all known ports
        all_ports: set[int] = set()
        all_ports.update(registry_by_port.keys())
        all_ports.update(runtime.keys())
        all_ports.update(docker.keys())
        all_ports.update(system.keys())
        all_ports.update(project.keys())

        ports_list = []
        counts = {"active": 0, "inactive": 0, "configured": 0, "unregistered": 0, "conflict": 0}

        for port in sorted(all_ports):
            reg = registry_by_port.get(port)
            rt = runtime.get(port)
            dc = docker.get(port)
            sys_conf = system.get(port)
            proj_conf = project.get(port)

            # Build source list
            sources = []
            if reg:
                sources.append("registry")
            if rt:
                sources.append("runtime")
            if dc:
                sources.append("docker-compose")
            if sys_conf:
                sources.append("system-config")
            if proj_conf:
                sources.append("project-config")

            # Classify status
            in_registry = reg is not None
            is_running = rt is not None
            in_config = dc is not None or sys_conf is not None or proj_conf is not None

            if in_registry and is_running:
                status = "active"
            elif in_registry and not is_running:
                status = "inactive"
            elif not in_registry and in_config and not is_running:
                status = "configured"
            elif not in_registry and is_running:
                status = "unregistered"
            else:
                status = "configured"

            counts[status] += 1

            entry: dict[str, Any] = {
                "port": port,
                "status": status,
                "sources": sources,
                "name": reg["name"] if reg else (dc or {}).get("service") or (sys_conf or {}).get("service") or "",
                "project": reg["project"] if reg else (dc or proj_conf or {}).get("project", ""),
                "category": reg["category"] if reg else "",
                "process": rt["process"] if rt else "",
                "pid": rt["pid"] if rt else 0,
                "bind": rt["bind"] if rt else "",
            }
            ports_list.append(entry)

        # Conflict detection: check docker-compose files for duplicate host ports
        # (already handled by dict keying — later entries overwrite)

        return {
            "scanned_at": __import__("datetime").datetime.now().isoformat(),
            "summary": {
                "total": len(ports_list),
                "registered": len(registry_by_port),
                **counts,
            },
            "ports": ports_list,
        }

    def get_registry(self) -> dict[str, Any]:
        """Return ports.yml content only."""
        return self._read_registry()

    def get_ranges(self) -> dict[str, Any]:
        """Return category ranges with usage stats."""
        registry = self._read_registry()
        ranges_raw = registry.get("ranges", {})
        services = registry.get("services", [])

        runtime = self._scan_runtime()

        ranges_list = []
        for cat, range_str in ranges_raw.items():
            parts = range_str.split("-")
            start, end = int(parts[0]), int(parts[1])
            registered_ports = [s["port"] for s in services if s.get("category") == cat and start <= s["port"] <= end]
            active_ports = [p for p in registered_ports if p in runtime]

            ranges_list.append({
                "category": cat,
                "start": start,
                "end": end,
                "total_slots": end - start + 1,
                "registered": len(registered_ports),
                "active": len(active_ports),
                "ports": sorted(registered_ports),
            })

        return {"ranges": ranges_list}
```

**Step 3: Commit**

```bash
git add backend/app/config.py backend/app/collectors/port_scanner.py
git commit -m "feat: add port scanner collector with 4-source scanning"
```

---

### Task 3: Create API routes

**Files:**
- Create: `backend/app/routes/ports.py`
- Modify: `backend/app/main.py` (register router)

**Step 1: Create routes/ports.py**

```python
from fastapi import APIRouter, Depends

from app.auth.jwt import verify_token
from app.collectors.port_scanner import PortScanner

router = APIRouter(prefix="/api/v1/ports", tags=["ports"])
scanner = PortScanner()


@router.get("/status")
async def port_status(_: str = Depends(verify_token)):
    return scanner.get_status()


@router.get("/registry")
async def port_registry(_: str = Depends(verify_token)):
    return scanner.get_registry()


@router.get("/ranges")
async def port_ranges(_: str = Depends(verify_token)):
    return scanner.get_ranges()
```

**Step 2: Register in main.py**

Add import and include_router after the claude router:

```python
from app.routes.ports import router as ports_router
# ...
app.include_router(ports_router)
```

**Step 3: Commit**

```bash
git add backend/app/routes/ports.py backend/app/main.py
git commit -m "feat: add /api/v1/ports endpoints (status, registry, ranges)"
```

---

### Task 4: Add PyYAML dependency

**Files:**
- Modify: `backend/requirements.txt`

**Step 1: Add pyyaml to requirements.txt**

Append `PyYAML>=6.0` to `backend/requirements.txt`.

**Step 2: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat: add PyYAML dependency for ports.yml parsing"
```

---

### Task 5: Add frontend hooks and types

**Files:**
- Modify: `frontend/src/hooks/useMetrics.ts`

**Step 1: Add types and hooks**

Append to `useMetrics.ts`:

```typescript
// --- Port Types ---

export interface PortEntry {
  port: number;
  status: "active" | "inactive" | "configured" | "unregistered" | "conflict";
  sources: string[];
  name: string;
  project: string;
  category: string;
  process: string;
  pid: number;
  bind: string;
}

export interface PortStatus {
  scanned_at: string;
  summary: {
    total: number;
    registered: number;
    active: number;
    inactive: number;
    configured: number;
    unregistered: number;
    conflict: number;
  };
  ports: PortEntry[];
}

export interface PortRange {
  category: string;
  start: number;
  end: number;
  total_slots: number;
  registered: number;
  active: number;
  ports: number[];
}

export interface PortRanges {
  ranges: PortRange[];
}

// --- Port Hooks ---

export function usePortStatus() {
  return useFetch<PortStatus>("/api/v1/ports/status");
}

export function usePortRanges() {
  return useFetch<PortRanges>("/api/v1/ports/ranges");
}
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/useMetrics.ts
git commit -m "feat: add port status types and hooks"
```

---

### Task 6: Add Ports menu to sidebar

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Step 1: Add Ports menu item**

In the `menuItems` array, add after the Claude entry:

```typescript
{ label: "Ports", href: "/ports", icon: "\u{1F50C}" },
```

**Step 2: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add Ports menu to sidebar"
```

---

### Task 7: Create /ports page

**Files:**
- Create: `frontend/src/app/ports/page.tsx`

**Step 1: Create the page**

```tsx
"use client";

import { useState } from "react";
import { usePortStatus, usePortRanges } from "@/hooks/useMetrics";
import type { PortEntry } from "@/hooks/useMetrics";
import DataTable from "@/components/tables/DataTable";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-sm-ok/20 text-sm-ok",
  inactive: "bg-sm-text-dim/20 text-sm-text-dim",
  configured: "bg-sm-link/20 text-sm-link",
  unregistered: "bg-sm-warn/20 text-sm-warn",
  conflict: "bg-sm-error/20 text-sm-error",
};

const FILTER_TABS = ["All", "Active", "Inactive", "Configured", "Unregistered", "Conflict"] as const;

export default function PortsPage() {
  const { data: status, isLoading, mutate } = usePortStatus();
  const { data: rangesData } = usePortRanges();
  const [filter, setFilter] = useState<string>("All");

  const ports = status?.ports ?? [];
  const filtered = filter === "All" ? ports : ports.filter((p) => p.status === filter.toLowerCase());
  const summary = status?.summary;

  const summaryCards = [
    { label: "Registered", value: summary?.registered ?? 0, color: "text-sm-text" },
    { label: "Active", value: summary?.active ?? 0, color: "text-sm-ok" },
    { label: "Unregistered", value: summary?.unregistered ?? 0, color: "text-sm-warn" },
    { label: "Conflicts", value: summary?.conflict ?? 0, color: "text-sm-error" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-sm-text">Port Management</h1>
        <div className="flex items-center gap-3">
          {status && (
            <span className="text-[10px] text-sm-text-dim">
              Scanned: {new Date(status.scanned_at).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => mutate()}
            className="text-[10px] px-2 py-1 rounded bg-sm-surface border border-[#2d3a4f] text-sm-text-dim hover:text-sm-text transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3"
          >
            <div className="text-[10px] text-sm-text-dim">{card.label}</div>
            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1">
        {FILTER_TABS.map((tab) => {
          const count =
            tab === "All"
              ? ports.length
              : ports.filter((p) => p.status === tab.toLowerCase()).length;
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`text-[10px] px-2.5 py-1 rounded transition-colors ${
                filter === tab
                  ? "bg-sm-link text-white"
                  : "bg-sm-surface text-sm-text-dim hover:text-sm-text border border-[#2d3a4f]"
              }`}
            >
              {tab} ({count})
            </button>
          );
        })}
      </div>

      {/* Port Table */}
      {isLoading ? (
        <div className="text-sm-text-dim text-xs">Scanning ports...</div>
      ) : (
        <DataTable
          columns={[
            { key: "port", label: "Port", width: "70px", align: "right" },
            {
              key: "status",
              label: "Status",
              width: "100px",
              format: (v) => (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[v as string] ?? ""}`}
                >
                  {v as string}
                </span>
              ),
            },
            { key: "name", label: "Name" },
            { key: "project", label: "Project" },
            { key: "category", label: "Category", width: "100px" },
            { key: "process", label: "Process", width: "110px" },
            {
              key: "sources",
              label: "Source",
              format: (v) => (
                <span className="text-[10px] text-sm-text-dim">
                  {(v as string[]).join(", ")}
                </span>
              ),
            },
          ]}
          data={filtered as unknown as Record<string, unknown>[]}
          maxHeight="500px"
        />
      )}

      {/* Range Visualization */}
      {rangesData && (
        <div>
          <h2 className="text-xs font-semibold text-sm-text-dim mb-2">Port Ranges</h2>
          <div className="space-y-2">
            {rangesData.ranges.map((range) => {
              const usedPct = range.total_slots > 0
                ? (range.registered / range.total_slots) * 100
                : 0;
              return (
                <div
                  key={range.category}
                  className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-sm-text">{range.category}</span>
                    <span className="text-[10px] text-sm-text-dim">
                      {range.registered} / {range.total_slots} ({usedPct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="relative h-4 bg-[#1a1a2e] rounded overflow-hidden">
                    {/* Range bar background */}
                    <div className="absolute inset-0 flex items-center px-1">
                      <span className="text-[8px] text-sm-text-dim/50">
                        {range.start}
                      </span>
                      <span className="flex-1" />
                      <span className="text-[8px] text-sm-text-dim/50">
                        {range.end}
                      </span>
                    </div>
                    {/* Port dots */}
                    {range.ports.map((port) => {
                      const pct =
                        ((port - range.start) / (range.end - range.start)) * 100;
                      const isActive = status?.ports.find(
                        (p) => p.port === port
                      )?.status === "active";
                      return (
                        <div
                          key={port}
                          className={`absolute top-1 w-2 h-2 rounded-full ${
                            isActive ? "bg-sm-ok" : "bg-sm-text-dim"
                          }`}
                          style={{ left: `${pct}%` }}
                          title={`${port}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/ports/page.tsx
git commit -m "feat: add /ports dashboard page with table and range visualization"
```

---

### Task 8: Update CLAUDE.md with port rules

**Files:**
- Modify: `/home/nvme1/jhkim/00.Projects/CLAUDE.md`

**Step 1: Append port registry rules**

Add after the existing content:

```markdown
## Port Registry

이 서버(purions00)의 모든 프로젝트는 TCP 포트 할당 시 아래 규칙을 따라야 합니다.

- 레지스트리 파일: `/home/nvme1/jhkim/00.Projects/SysMonitor/ports.yml`
- 대시보드: http://192.192.192.169:3400/ports

### 포트 할당 절차
1. 새 서비스에 포트를 할당하기 전에 `ports.yml`을 읽어 사용 중인 포트를 확인
2. 권장 범위 내에서 빈 포트를 선택:
   - system: 1-1023
   - infrastructure: 3000-3499 (웹/프론트엔드)
   - dev: 5000-5999 (개발용)
   - database: 5400-5499 (DB)
   - cache: 6300-6399 (Redis 등)
   - backend: 8000-8999 (API 서버)
   - monitoring: 9000-9199 (모니터링)
3. 포트 할당 후 반드시 `ports.yml`에 등록 (name, port, project, category 필수)
```

**Step 2: Commit**

```bash
git add /home/nvme1/jhkim/00.Projects/CLAUDE.md
git commit -m "docs: add port registry rules to global CLAUDE.md"
```

---

### Task 9: Docker rebuild and verify

**Step 1: Rebuild backend and frontend containers**

```bash
cd /home/nvme1/jhkim/00.Projects/SysMonitor
docker compose up --build -d
```

**Step 2: Verify API endpoint works**

```bash
TOKEN=$(curl -s http://192.192.192.169:8400/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -s http://192.192.192.169:8400/api/v1/ports/status \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -30
```

Expected: JSON with `scanned_at`, `summary`, and `ports` array.

**Step 3: Verify frontend page loads**

Open `http://192.192.192.169:3400/ports` — should show summary cards, port table, and range bars.

**Step 4: Commit any fixes if needed**
