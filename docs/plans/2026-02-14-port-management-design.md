# Port Management Feature Design

Date: 2026-02-14

## Problem

30+ TCP ports in use across 20+ projects on purions00 server. Port conflicts occur when spinning up new services. No central registry or visibility into allocated vs active ports.

## Solution

Add a port management feature to SysMonitor: a YAML registry for declaring port assignments + real-time scanning to detect actual usage, with a dashboard page comparing the two.

## Architecture

### 1. ports.yml Registry

Location: `SysMonitor/ports.yml`

```yaml
ranges:
  infrastructure: "3000-3499"
  backend: "8000-8999"
  monitoring: "9000-9199"
  dev: "5000-5999"
  database: "5400-5499"
  cache: "6300-6399"

services:
  - name: SysMonitor Frontend
    port: 3400
    project: SysMonitor
    category: infrastructure
  # ...
```

- `ranges`: recommended port ranges per category, used for suggesting open ports
- `services`: name, port, project, category (required), description (optional)
- Git-managed for version history

### 2. Backend Collector (`collectors/port_scanner.py`)

Scans 4 sources on each API request (no caching):

| Source | Method | Extracts |
|--------|--------|----------|
| Runtime | `ss -tlnp` subprocess | port, process, PID, bind address |
| Docker Compose | parse all `**/docker-compose.yml` under projects dir | host port, service name, project path, network_mode |
| System config | parse `/etc/ssh/sshd_config`, `/etc/samba/smb.conf`, `/etc/mosquitto/*.conf`, `/etc/systemd/system/cloudflared*.service` | port, service name |
| Project config | parse `**/.env` for `PORT=`, `**/package.json` scripts for `--port` args | port, project path |

### 3. Status Classification

Cross-reference scan results with ports.yml:

| Status | Condition |
|--------|-----------|
| active | in registry + port open |
| inactive | in registry + port closed |
| configured | in config files but not registry |
| unregistered | port open but nowhere registered |
| conflict | same port claimed by multiple services |

### 4. API Routes (`routes/ports.py`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/ports/status` | Full scan: summary + all ports with status |
| GET | `/api/v1/ports/registry` | ports.yml content only |
| GET | `/api/v1/ports/ranges` | Category ranges with usage stats |

All endpoints require JWT auth (same as existing routes).

### 5. Frontend (`/ports` page)

Add "Ports" to sidebar at same level as Cloudflare and Claude.

**Summary cards (4):**
- Registered (sm-text), Active (sm-ok), Unregistered (sm-warn), Conflicts (sm-error)

**Port table:**
- Columns: Port, Name, Project, Category, Status (color badge), Process, Source
- Default sort by port number
- Filter tabs: All / Active / Inactive / Unregistered / Conflicts
- Reuse existing DataTable component

**Range visualization:**
- Horizontal bars per category showing used ports as dots
- Visual identification of open slots for new port assignment

**Hooks:**
- `usePortStatus()` and `usePortRanges()` in useMetrics.ts
- Manual refresh (fetch on page load + refresh button, no SWR polling)

### 6. CLAUDE.md Global Rules

Add port allocation rules to `/home/nvme1/jhkim/00.Projects/CLAUDE.md` so all projects reference the registry before assigning ports.

## Files Changed

| File | Action |
|------|--------|
| `SysMonitor/ports.yml` | Create - port registry |
| `backend/app/collectors/port_scanner.py` | Create - 4-source scanner |
| `backend/app/routes/ports.py` | Create - 3 API endpoints |
| `backend/app/main.py` | Modify - register ports router |
| `frontend/src/app/ports/page.tsx` | Create - ports dashboard |
| `frontend/src/hooks/useMetrics.ts` | Modify - add port hooks |
| `frontend/src/components/layout/Sidebar.tsx` | Modify - add Ports menu |
| `/home/nvme1/jhkim/00.Projects/CLAUDE.md` | Modify - add port rules |
