# SysMonitor Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ubuntu 워크스테이션(Purions00)과 Synology NAS(RTK)를 통합 모니터링하는 ntopng 스타일 Dark UI 웹 애플리케이션의 MVP를 구축한다.

**Architecture:** FastAPI 백엔드가 60초 간격으로 로컬(psutil) + NAS(Prometheus API) 메트릭을 수집하고, 인메모리 캐시 + SQLite에 저장한다. Next.js 프론트엔드가 SWR 60초 polling으로 REST API를 조회하여 ntopng 스타일 Dark UI에 표시한다.

**Tech Stack:** Python 3.12 + FastAPI + psutil + APScheduler + SQLite / Next.js 14 + React 18 + Tailwind CSS + Apache ECharts + SWR + Zustand / Docker Compose

---

## Pre-requisite: NAS Prometheus 포트 노출

NAS의 Prometheus 컨테이너가 호스트 포트에 바인딩되어 있지 않다 (`9090/tcp: null`). Purions00에서 직접 접근하려면 호스트 포트를 열어야 한다.

**방법:** NAS Synology Container Manager에서 Prometheus 컨테이너의 포트 매핑을 `9090:9090`으로 설정하거나, SSH 터널을 사용한다.

본 계획에서는 SSH 터널 방식을 채택한다 (NAS 설정 변경 불필요):
```python
# backend에서 SSH 터널로 Prometheus 접근
# ssh -L 9090:prometheus:9090 jhkim@192.192.192.145 -i ~/.ssh/sysmonitor_nas
# 또는 paramiko로 프로그래밍 방식 터널
```

대안: NAS에서 Prometheus를 host port로 노출하면 SSH 터널 불필요.

---

## Task 1: 프로젝트 초기화 + Git

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `backend/requirements.txt`
- Create: `backend/Dockerfile`
- Create: `frontend/package.json` (via npx)
- Create: `frontend/Dockerfile`

**Step 1: Git 초기화**
```bash
cd /home/nvme1/jhkim/00.Projects/SysMonitor
git init
```

**Step 2: .gitignore 작성**
```gitignore
# Python
__pycache__/
*.pyc
.venv/
*.egg-info/

# Node
node_modules/
.next/
out/

# Env
.env
*.env.local

# Data
data/
*.db

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

**Step 3: .env.example 작성**
```env
# Server
API_HOST=0.0.0.0
API_PORT=8000

# Auth
JWT_SECRET=change-me-to-random-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me

# NAS
NAS_HOST=192.192.192.145
NAS_SSH_USER=jhkim
NAS_SSH_KEY_PATH=~/.ssh/sysmonitor_nas
NAS_PROMETHEUS_PORT=9090

# Cloudflare
CF_API_EMAIL=gopeace88@gmail.com
CF_API_KEY=your-global-api-key
CF_ACCOUNT_ID=28b9de8f436a1a7b49eeb39d61b1fefd
CF_ZONE_PURIONS=4eafbe955e38cac710b7ee7693739a85
CF_ZONE_RTK=084db07a319a721c04f840475a1239ff

# Collector
COLLECT_INTERVAL=60
```

**Step 4: backend/requirements.txt 작성**
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
psutil==6.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
pydantic-settings==2.6.0
apscheduler==3.10.4
httpx==0.28.0
paramiko==3.5.0
docker==7.1.0
```

**Step 5: backend/Dockerfile 작성**
```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 6: Next.js 프로젝트 생성**
```bash
cd /home/nvme1/jhkim/00.Projects/SysMonitor
npx create-next-app@latest frontend \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --no-turbopack
```

**Step 7: 프론트엔드 추가 의존성 설치**
```bash
cd frontend
npm install echarts echarts-for-react swr zustand
npm install -D @types/node
```

**Step 8: frontend/Dockerfile 작성**
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

**Step 9: docker-compose.yml 작성**
```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8400:8000"
    volumes:
      - ./data:/app/data
      - ${HOME}/.ssh/sysmonitor_nas:/app/.ssh/sysmonitor_nas:ro
    env_file: .env
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3400:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8400
    depends_on:
      - backend
    restart: unless-stopped
```

**Step 10: 초기 커밋**
```bash
git add .gitignore .env.example docker-compose.yml backend/requirements.txt backend/Dockerfile frontend/Dockerfile docs/
git commit -m "chore: project scaffold - FastAPI + Next.js + Docker Compose"
```

---

## Task 2: 백엔드 설정 + FastAPI 앱 초기화

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/main.py`
- Test: `backend/tests/test_main.py`

**Step 1: 빈 __init__.py 생성**
```bash
mkdir -p backend/app backend/tests
touch backend/app/__init__.py backend/tests/__init__.py
```

**Step 2: config.py 작성**
```python
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Auth
    jwt_secret: str = "dev-secret-change-me"
    admin_username: str = "admin"
    admin_password: str = "admin"
    jwt_expiry_hours: int = 24

    # NAS
    nas_host: str = "192.192.192.145"
    nas_ssh_user: str = "jhkim"
    nas_ssh_key_path: str = "~/.ssh/sysmonitor_nas"
    nas_prometheus_port: int = 9090

    # Cloudflare
    cf_api_email: str = ""
    cf_api_key: str = ""
    cf_account_id: str = ""
    cf_zone_purions: str = ""
    cf_zone_rtk: str = ""

    # Collector
    collect_interval: int = 60

    # Storage
    data_dir: Path = Path("data")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

**Step 3: main.py 작성**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(title="SysMonitor", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3400", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
```

**Step 4: 테스트 작성**
```python
# backend/tests/test_main.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
```

**Step 5: 테스트 실행**
```bash
cd /home/nvme1/jhkim/00.Projects/SysMonitor/backend
pip install -r requirements.txt pytest
PYTHONPATH=. pytest tests/test_main.py -v
```
Expected: PASS

**Step 6: 백엔드 단독 실행 확인**
```bash
cd /home/nvme1/jhkim/00.Projects/SysMonitor/backend
PYTHONPATH=. uvicorn app.main:app --port 8400 &
curl -s http://localhost:8400/api/v1/health
kill %1
```
Expected: `{"status":"ok","version":"0.1.0"}`

**Step 7: 커밋**
```bash
git add backend/
git commit -m "feat: FastAPI app init with config and health endpoint"
```

---

## Task 3: JWT 인증

**Files:**
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/jwt.py`
- Create: `backend/app/routes/__init__.py`
- Create: `backend/app/routes/auth.py`
- Modify: `backend/app/main.py` (라우터 등록)
- Test: `backend/tests/test_auth.py`

**Step 1: 테스트 작성**
```python
# backend/tests/test_auth.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_login_success():
    resp = client.post("/api/v1/auth/login", json={
        "username": "admin", "password": "admin"
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password():
    resp = client.post("/api/v1/auth/login", json={
        "username": "admin", "password": "wrong"
    })
    assert resp.status_code == 401


def test_protected_route_no_token():
    resp = client.get("/api/v1/servers")
    assert resp.status_code == 401


def test_protected_route_with_token():
    login = client.post("/api/v1/auth/login", json={
        "username": "admin", "password": "admin"
    })
    token = login.json()["access_token"]
    resp = client.get("/api/v1/servers", headers={
        "Authorization": f"Bearer {token}"
    })
    assert resp.status_code == 200
```

**Step 2: 테스트 실행 → 실패 확인**
```bash
cd /home/nvme1/jhkim/00.Projects/SysMonitor/backend
PYTHONPATH=. pytest tests/test_auth.py -v
```
Expected: FAIL

**Step 3: auth/jwt.py 구현**
```python
# backend/app/auth/jwt.py
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings

security = HTTPBearer()


def create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours)
    return jwt.encode(
        {"sub": username, "exp": expire},
        settings.jwt_secret,
        algorithm="HS256",
    )


def verify_token(cred: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(cred.credentials, settings.jwt_secret, algorithms=["HS256"])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

**Step 4: routes/auth.py 구현**
```python
# backend/app/routes/auth.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.auth.jwt import create_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(req: LoginRequest):
    if req.username != settings.admin_username or req.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(req.username)
    return {"access_token": token, "token_type": "bearer"}
```

**Step 5: routes/servers.py 스텁 (인증 테스트용)**
```python
# backend/app/routes/servers.py
from fastapi import APIRouter, Depends

from app.auth.jwt import verify_token

router = APIRouter(prefix="/api/v1/servers", tags=["servers"])


@router.get("")
async def list_servers(_: str = Depends(verify_token)):
    return [
        {"id": "purions00", "name": "Purions00", "ip": "192.192.192.169", "status": "up"},
        {"id": "rtk_nas", "name": "RTK NAS", "ip": "192.192.192.145", "status": "up"},
    ]
```

**Step 6: main.py에 라우터 등록**
```python
# backend/app/main.py 에 추가
from app.routes.auth import router as auth_router
from app.routes.servers import router as servers_router

app.include_router(auth_router)
app.include_router(servers_router)
```

**Step 7: __init__.py 파일 생성**
```bash
touch backend/app/auth/__init__.py backend/app/routes/__init__.py
```

**Step 8: 테스트 실행 → 통과 확인**
```bash
PYTHONPATH=. pytest tests/test_auth.py -v
```
Expected: 4 PASS

**Step 9: 커밋**
```bash
git add backend/
git commit -m "feat: JWT authentication with login endpoint"
```

---

## Task 4: LocalCollector (psutil 기반 로컬 메트릭 수집)

**Files:**
- Create: `backend/app/collectors/__init__.py`
- Create: `backend/app/collectors/local.py`
- Test: `backend/tests/test_collectors.py`

**Step 1: 테스트 작성**
```python
# backend/tests/test_collectors.py
from app.collectors.local import LocalCollector


def test_collect_returns_all_sections():
    collector = LocalCollector()
    data = collector.collect()
    assert "cpu" in data
    assert "memory" in data
    assert "disks" in data
    assert "network" in data
    assert "uptime_seconds" in data
    assert "process_count" in data
    assert "top_processes" in data


def test_cpu_has_required_fields():
    collector = LocalCollector()
    data = collector.collect()
    cpu = data["cpu"]
    assert "usage_percent" in cpu
    assert "per_core" in cpu
    assert "load_avg" in cpu
    assert isinstance(cpu["per_core"], list)
    assert len(cpu["load_avg"]) == 3


def test_memory_values_reasonable():
    collector = LocalCollector()
    data = collector.collect()
    mem = data["memory"]
    assert mem["total_gb"] > 0
    assert 0 <= mem["percent"] <= 100


def test_disks_not_empty():
    collector = LocalCollector()
    data = collector.collect()
    assert len(data["disks"]) > 0
    disk = data["disks"][0]
    assert "mountpoint" in disk
    assert "percent" in disk
```

**Step 2: 실행 → 실패 확인**
```bash
PYTHONPATH=. pytest tests/test_collectors.py -v
```

**Step 3: local.py 구현**
```python
# backend/app/collectors/local.py
import psutil
import time


class LocalCollector:
    def __init__(self):
        self._prev_net = None
        self._prev_disk_io = None
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
        counts = psutil.cpu_count
        return {
            "usage_percent": sum(per_core) / len(per_core) if per_core else 0,
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
                "percent": usage.percent,
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
```

**Step 4: 테스트 실행 → 통과**
```bash
PYTHONPATH=. pytest tests/test_collectors.py -v
```
Expected: 4 PASS

**Step 5: 커밋**
```bash
git add backend/
git commit -m "feat: LocalCollector - psutil based system metrics"
```

---

## Task 5: PrometheusCollector (NAS 메트릭 수집)

**Files:**
- Create: `backend/app/collectors/prometheus.py`
- Test: `backend/tests/test_prometheus_collector.py`

**Step 1: 테스트 작성**
```python
# backend/tests/test_prometheus_collector.py
import pytest
from unittest.mock import AsyncMock, patch
from app.collectors.prometheus import PrometheusCollector


@pytest.mark.asyncio
async def test_parse_instant_query_result():
    collector = PrometheusCollector.__new__(PrometheusCollector)
    raw = {
        "status": "success",
        "data": {
            "resultType": "vector",
            "result": [{"metric": {}, "value": [1707350400, "42.5"]}]
        }
    }
    value = collector._parse_scalar(raw)
    assert value == 42.5


@pytest.mark.asyncio
async def test_parse_empty_result():
    collector = PrometheusCollector.__new__(PrometheusCollector)
    raw = {"status": "success", "data": {"resultType": "vector", "result": []}}
    value = collector._parse_scalar(raw)
    assert value is None


@pytest.mark.asyncio
async def test_collect_returns_dict_structure():
    """Test with mocked HTTP responses"""
    collector = PrometheusCollector.__new__(PrometheusCollector)
    collector.base_url = "http://fake:9090"
    collector.ssh_tunnel = None

    mock_response = AsyncMock()
    mock_response.json = lambda: {
        "status": "success",
        "data": {"resultType": "vector", "result": [{"metric": {}, "value": [0, "50.0"]}]}
    }
    mock_response.raise_for_status = lambda: None

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        data = await collector.collect()
        assert "cpu" in data
        assert "memory" in data
```

**Step 2: prometheus.py 구현**
```python
# backend/app/collectors/prometheus.py
import httpx
import paramiko
import threading
from typing import Optional

from app.config import settings


class SSHTunnel:
    """SSH tunnel to access NAS Prometheus via paramiko"""

    def __init__(self):
        self.local_port = 19090
        self._transport = None
        self._channel = None

    def start(self):
        key_path = settings.nas_ssh_key_path.replace("~", str(__import__("pathlib").Path.home()))
        pkey = paramiko.Ed25519Key.from_private_key_file(key_path)
        self._transport = paramiko.Transport((settings.nas_host, 22))
        self._transport.connect(username=settings.nas_ssh_user, pkey=pkey)
        # Forward local_port to prometheus container's port 9090
        # Prometheus container name in docker network is "prometheus"
        # But we'll use the docker bridge IP instead

    def get_url(self) -> str:
        return f"http://localhost:{self.local_port}"

    def stop(self):
        if self._transport:
            self._transport.close()


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
        self.ssh_tunnel = None

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
                except Exception:
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
                "load_avg": [
                    round(r.get("load1") or 0, 2),
                    round(r.get("load5") or 0, 2),
                    round(r.get("load15") or 0, 2),
                ],
            },
            "memory": {
                "total_gb": round(mem_total / (1024**3), 1),
                "used_gb": round((r.get("memory_used") or 0) / (1024**3), 1),
                "available_gb": round((r.get("memory_available") or 0) / (1024**3), 1),
                "percent": round(((r.get("memory_used") or 0) / mem_total) * 100, 1),
            },
            "network": {
                "interfaces": [
                    {
                        "name": "eth0",
                        "is_up": True,
                        "rx_bytes_sec": round(r.get("net_rx") or 0, 1),
                        "tx_bytes_sec": round(r.get("net_tx") or 0, 1),
                    }
                ]
            },
            "disks": [
                {
                    "device": "volume1",
                    "mountpoint": "/volume1",
                    "total_gb": round((r.get("fs_total") or 0) / (1024**3), 1),
                    "used_gb": round((r.get("fs_used") or 0) / (1024**3), 1),
                    "percent": round(
                        ((r.get("fs_used") or 0) / (r.get("fs_total") or 1)) * 100, 1
                    ),
                }
            ],
            "uptime_seconds": int(r.get("uptime") or 0),
            "timestamp": __import__("time").time(),
        }
```

**Step 3: pytest-asyncio 추가**
```bash
cd /home/nvme1/jhkim/00.Projects/SysMonitor/backend
pip install pytest-asyncio
echo "pytest-asyncio==0.24.0" >> requirements.txt
```

**Step 4: 테스트 실행**
```bash
PYTHONPATH=. pytest tests/test_prometheus_collector.py -v
```
Expected: 3 PASS (mocked)

**Step 5: 커밋**
```bash
git add backend/
git commit -m "feat: PrometheusCollector - NAS metrics via PromQL"
```

---

## Task 6: 인메모리 캐시 + SQLite 저장소

**Files:**
- Create: `backend/app/storage/__init__.py`
- Create: `backend/app/storage/cache.py`
- Create: `backend/app/storage/sqlite_store.py`
- Test: `backend/tests/test_storage.py`

**Step 1: 테스트 작성**
```python
# backend/tests/test_storage.py
import time
from app.storage.cache import MetricsCache
from app.storage.sqlite_store import SQLiteStore


def test_cache_update_and_get():
    cache = MetricsCache()
    data = {"cpu": {"usage_percent": 25.0}, "timestamp": time.time()}
    cache.update("purions00", data)
    latest = cache.get_latest("purions00")
    assert latest["cpu"]["usage_percent"] == 25.0


def test_cache_history():
    cache = MetricsCache()
    for i in range(5):
        cache.update("purions00", {"cpu": {"usage_percent": float(i)}, "timestamp": time.time()})
    history = cache.get_history("purions00")
    assert len(history) == 5


def test_cache_unknown_server():
    cache = MetricsCache()
    assert cache.get_latest("unknown") is None


def test_sqlite_store_write_and_read(tmp_path):
    store = SQLiteStore(tmp_path / "test.db")
    store.write_metric("purions00", "cpu", "usage_percent", 25.5, int(time.time()))
    rows = store.read_metrics("purions00", "cpu", "usage_percent", 0, int(time.time()) + 1)
    assert len(rows) == 1
    assert rows[0]["value"] == 25.5


def test_sqlite_store_aggregation(tmp_path):
    store = SQLiteStore(tmp_path / "test.db")
    now = int(time.time())
    for i in range(5):
        store.write_metric("purions00", "cpu", "usage_percent", float(10 + i), now + i)
    store.aggregate_hourly("purions00", "cpu", "usage_percent", now, now + 5)
    rows = store.read_hourly("purions00", "cpu", "usage_percent", now - 1, now + 6)
    assert len(rows) == 1
    assert rows[0]["avg_value"] == 12.0  # avg(10,11,12,13,14)
```

**Step 2: cache.py 구현**
```python
# backend/app/storage/cache.py
from collections import deque
from typing import Optional
import threading


class MetricsCache:
    def __init__(self, max_history: int = 60):
        self._data: dict = {}
        self._max = max_history
        self._lock = threading.Lock()

    def update(self, server_id: str, data: dict):
        with self._lock:
            if server_id not in self._data:
                self._data[server_id] = {
                    "latest": None,
                    "history": deque(maxlen=self._max),
                }
            self._data[server_id]["latest"] = data
            self._data[server_id]["history"].append(data)

    def get_latest(self, server_id: str) -> Optional[dict]:
        with self._lock:
            entry = self._data.get(server_id)
            return entry["latest"] if entry else None

    def get_history(self, server_id: str, count: int = 0) -> list:
        with self._lock:
            entry = self._data.get(server_id)
            if not entry:
                return []
            hist = list(entry["history"])
            return hist[-count:] if count > 0 else hist

    def get_all_latest(self) -> dict:
        with self._lock:
            return {sid: e["latest"] for sid, e in self._data.items() if e["latest"]}
```

**Step 3: sqlite_store.py 구현**
```python
# backend/app/storage/sqlite_store.py
import sqlite3
from pathlib import Path
from typing import Optional


class SQLiteStore:
    def __init__(self, db_path: Path):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db_path = str(db_path)
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS metrics_1m (
                    server_id TEXT,
                    timestamp INTEGER,
                    metric_type TEXT,
                    metric_name TEXT,
                    value REAL,
                    PRIMARY KEY (server_id, timestamp, metric_type, metric_name)
                );
                CREATE TABLE IF NOT EXISTS metrics_1h (
                    server_id TEXT,
                    timestamp INTEGER,
                    metric_type TEXT,
                    metric_name TEXT,
                    avg_value REAL,
                    max_value REAL,
                    min_value REAL,
                    PRIMARY KEY (server_id, timestamp, metric_type, metric_name)
                );
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id TEXT,
                    severity TEXT,
                    type TEXT,
                    message TEXT,
                    created_at INTEGER,
                    resolved_at INTEGER,
                    acknowledged INTEGER DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_m1m ON metrics_1m(server_id, timestamp);
                CREATE INDEX IF NOT EXISTS idx_m1h ON metrics_1h(server_id, timestamp);
            """)

    def write_metric(self, server_id: str, metric_type: str, metric_name: str,
                     value: float, timestamp: int):
        with self._conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO metrics_1m VALUES (?,?,?,?,?)",
                (server_id, timestamp, metric_type, metric_name, value),
            )

    def read_metrics(self, server_id: str, metric_type: str, metric_name: str,
                     ts_from: int, ts_to: int) -> list:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT timestamp, value FROM metrics_1m WHERE server_id=? AND metric_type=? AND metric_name=? AND timestamp BETWEEN ? AND ? ORDER BY timestamp",
                (server_id, metric_type, metric_name, ts_from, ts_to),
            ).fetchall()
            return [dict(r) for r in rows]

    def aggregate_hourly(self, server_id: str, metric_type: str, metric_name: str,
                         ts_from: int, ts_to: int):
        with self._conn() as conn:
            row = conn.execute(
                "SELECT AVG(value) as avg_v, MAX(value) as max_v, MIN(value) as min_v FROM metrics_1m WHERE server_id=? AND metric_type=? AND metric_name=? AND timestamp BETWEEN ? AND ?",
                (server_id, metric_type, metric_name, ts_from, ts_to),
            ).fetchone()
            if row and row["avg_v"] is not None:
                conn.execute(
                    "INSERT OR REPLACE INTO metrics_1h VALUES (?,?,?,?,?,?,?)",
                    (server_id, ts_from, metric_type, metric_name,
                     round(row["avg_v"], 2), round(row["max_v"], 2), round(row["min_v"], 2)),
                )

    def read_hourly(self, server_id: str, metric_type: str, metric_name: str,
                    ts_from: int, ts_to: int) -> list:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT timestamp, avg_value, max_value, min_value FROM metrics_1h WHERE server_id=? AND metric_type=? AND metric_name=? AND timestamp BETWEEN ? AND ? ORDER BY timestamp",
                (server_id, metric_type, metric_name, ts_from, ts_to),
            ).fetchall()
            return [dict(r) for r in rows]

    def cleanup_old(self, days_1m: int = 30, days_1h: int = 365):
        import time
        now = int(time.time())
        with self._conn() as conn:
            conn.execute("DELETE FROM metrics_1m WHERE timestamp < ?", (now - days_1m * 86400,))
            conn.execute("DELETE FROM metrics_1h WHERE timestamp < ?", (now - days_1h * 86400,))
```

**Step 4: 테스트 실행**
```bash
PYTHONPATH=. pytest tests/test_storage.py -v
```
Expected: 5 PASS

**Step 5: 커밋**
```bash
git add backend/
git commit -m "feat: MetricsCache + SQLiteStore for time-series storage"
```

---

## Task 7: 스케줄러 + 서버 메트릭 API

**Files:**
- Create: `backend/app/scheduler.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/metrics.py`
- Modify: `backend/app/routes/servers.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_api_servers.py`

**Step 1: scheduler.py 구현**
```python
# backend/app/scheduler.py
import asyncio
import logging
import time
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.collectors.local import LocalCollector
from app.collectors.prometheus import PrometheusCollector
from app.storage.cache import MetricsCache
from app.storage.sqlite_store import SQLiteStore

logger = logging.getLogger("sysmonitor")

cache = MetricsCache()
store = SQLiteStore(settings.data_dir / "sysmonitor.db")
local_collector = LocalCollector()
prom_collector = PrometheusCollector()


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
    # Local
    try:
        local_data = local_collector.collect()
        cache.update("purions00", local_data)
        _persist_metrics("purions00", local_data)
    except Exception as e:
        logger.error(f"Local collection failed: {e}")

    # NAS
    try:
        nas_data = await prom_collector.collect()
        cache.update("rtk_nas", nas_data)
        _persist_metrics("rtk_nas", nas_data)
    except Exception as e:
        logger.error(f"NAS collection failed: {e}")


def start_scheduler():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(collect_all, "interval", seconds=settings.collect_interval,
                      id="collect_metrics", replace_existing=True)
    scheduler.start()
    logger.info(f"Scheduler started: collecting every {settings.collect_interval}s")
    # Run once immediately
    asyncio.get_event_loop().create_task(collect_all())
```

**Step 2: routes/servers.py 완성**
```python
# backend/app/routes/servers.py
import time
from fastapi import APIRouter, Depends, HTTPException

from app.auth.jwt import verify_token
from app.scheduler import cache, store

router = APIRouter(prefix="/api/v1/servers", tags=["servers"])

SERVERS = {
    "purions00": {"id": "purions00", "name": "Purions00", "ip": "192.192.192.169", "os": "Ubuntu 24.04"},
    "rtk_nas": {"id": "rtk_nas", "name": "RTK NAS", "ip": "192.192.192.145", "os": "Synology DSM 7.3.2"},
}


@router.get("")
async def list_servers(_: str = Depends(verify_token)):
    result = []
    for sid, info in SERVERS.items():
        latest = cache.get_latest(sid)
        status = "up" if latest else "down"
        result.append({**info, "status": status})
    return result


@router.get("/{server_id}/overview")
async def server_overview(server_id: str, _: str = Depends(verify_token)):
    if server_id not in SERVERS:
        raise HTTPException(status_code=404, detail="Server not found")
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    return {**SERVERS[server_id], "metrics": latest}


@router.get("/{server_id}/cpu")
async def server_cpu(server_id: str, _: str = Depends(verify_token)):
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    history = cache.get_history(server_id)
    return {
        "current": latest.get("cpu"),
        "history": [{"timestamp": h["timestamp"], "usage_percent": h["cpu"]["usage_percent"]} for h in history if "cpu" in h],
    }


@router.get("/{server_id}/memory")
async def server_memory(server_id: str, _: str = Depends(verify_token)):
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    history = cache.get_history(server_id)
    return {
        "current": latest.get("memory"),
        "history": [{"timestamp": h["timestamp"], "percent": h["memory"]["percent"]} for h in history if "memory" in h],
    }


@router.get("/{server_id}/disk")
async def server_disk(server_id: str, _: str = Depends(verify_token)):
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    return {"disks": latest.get("disks", [])}


@router.get("/{server_id}/network")
async def server_network(server_id: str, _: str = Depends(verify_token)):
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    return latest.get("network", {})


@router.get("/{server_id}/processes")
async def server_processes(server_id: str, _: str = Depends(verify_token)):
    latest = cache.get_latest(server_id)
    if not latest:
        raise HTTPException(status_code=503, detail="No data yet")
    return {
        "count": latest.get("process_count"),
        "top": latest.get("top_processes", []),
    }
```

**Step 3: main.py 업데이트 (스케줄러 시작)**
```python
# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.auth import router as auth_router
from app.routes.servers import router as servers_router
from app.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield


app = FastAPI(title="SysMonitor", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3400", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(servers_router)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
```

**Step 4: 테스트**
```python
# backend/tests/test_api_servers.py
from fastapi.testclient import TestClient
from app.main import app
from app.scheduler import cache

client = TestClient(app)


def _get_token():
    r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin"})
    return r.json()["access_token"]


def test_servers_list():
    token = _get_token()
    r = client.get("/api/v1/servers", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_server_overview_no_data():
    token = _get_token()
    r = client.get("/api/v1/servers/purions00/overview", headers={"Authorization": f"Bearer {token}"})
    # Either 200 (if scheduler ran) or 503 (no data yet)
    assert r.status_code in (200, 503)
```

**Step 5: 테스트 실행**
```bash
PYTHONPATH=. pytest tests/ -v
```

**Step 6: 커밋**
```bash
git add backend/
git commit -m "feat: scheduler + servers API with cache/SQLite"
```

---

## Task 8: 프론트엔드 - ntopng 스타일 UI 프레임

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/app/globals.css`
- Create: `frontend/src/app/layout.tsx` (덮어쓰기)
- Create: `frontend/src/components/layout/TopBar.tsx`
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/stores/serverStore.ts`

이 태스크의 코드는 길어지므로, 핵심 파일만 포함한다. 실제 구현 시 아래 구조를 따른다.

**Step 1: Tailwind 커스텀 테마 설정**

`tailwind.config.ts` 수정: sm-bg, sm-surface, sm-text, sm-ok, sm-warn, sm-error, sm-link 색상 추가. font-mono에 JetBrains Mono 추가.

**Step 2: globals.css를 Dark 테마 기본으로 변경**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-sm-bg text-sm-text;
}
```

**Step 3: layout.tsx - TopBar + Sidebar + Main Content 프레임**

ntopng 레이아웃: 고정 TopBar(48px) + 고정 Sidebar(220px) + 가변 Main Content.

**Step 4: TopBar.tsx**

로고(SysMonitor), 서버 선택 드롭다운, 현재 시간, 알림벨, 유저 메뉴. 상태 배지(Alerts, Hosts, Flows).

**Step 5: Sidebar.tsx**

고정 메뉴: Dashboard, Interfaces, Hosts, Flows, Alerts, System(하위메뉴), Settings. 활성 메뉴 하이라이트. ntopng 아이콘 스타일.

**Step 6: lib/api.ts - fetch 래퍼 + JWT 인터셉터**

**Step 7: hooks/useAuth.ts - 로그인/로그아웃/토큰 관리**

**Step 8: stores/serverStore.ts - Zustand: 선택된 서버, 시간 범위**

**Step 9: 빌드 확인**
```bash
cd /home/nvme1/jhkim/00.Projects/SysMonitor/frontend
npm run build
```

**Step 10: 커밋**
```bash
git add frontend/
git commit -m "feat: ntopng-style dark UI frame (TopBar + Sidebar)"
```

---

## Task 9: 프론트엔드 - 로그인 페이지

**Files:**
- Create: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/layout.tsx` (인증 가드 추가)

**Step 1: login/page.tsx 구현**

Dark 테마 로그인 폼. username + password 입력, JWT 발급 후 localStorage 저장, /dashboard로 리다이렉트.

**Step 2: layout.tsx에 인증 가드**

토큰 없으면 /login으로 리다이렉트. 로그인 페이지는 제외.

**Step 3: 동작 확인**
```bash
cd /home/nvme1/jhkim/00.Projects/SysMonitor/frontend
npm run dev
# http://localhost:3000 → 로그인 → 대시보드
```

**Step 4: 커밋**
```bash
git add frontend/
git commit -m "feat: login page with JWT auth"
```

---

## Task 10: 프론트엔드 - Dashboard 페이지

**Files:**
- Create: `frontend/src/app/dashboard/page.tsx`
- Create: `frontend/src/components/cards/ServerCard.tsx`
- Create: `frontend/src/components/charts/TimeSeriesChart.tsx`
- Create: `frontend/src/components/charts/GaugeChart.tsx`
- Create: `frontend/src/components/charts/BarChart.tsx`
- Create: `frontend/src/components/tables/DataTable.tsx`
- Create: `frontend/src/hooks/useMetrics.ts`
- Create: `frontend/src/lib/format.ts`

**Step 1: hooks/useMetrics.ts - SWR 기반 데이터 패칭**

60초 polling. 서버별 overview, cpu, memory, disk 엔드포인트 조회.

**Step 2: lib/format.ts - 단위 변환 유틸리티**

formatBytes(bytes) → "1.2 GB", formatBps(bytes_sec) → "45.2 Mbps", formatDuration(seconds) → "3d 2h 15m"

**Step 3: ServerCard.tsx**

서버명, IP, 상태(●), CPU/MEM/NET 요약. ntopng 스타일 밀도.

**Step 4: TimeSeriesChart.tsx (ECharts)**

ECharts line/area 차트. props: data, title, yAxisLabel, color. Dark theme 자동.

**Step 5: GaugeChart.tsx**

CPU/MEM 사용률 게이지. 색상: 0-60 green, 60-85 orange, 85-100 red.

**Step 6: BarChart.tsx**

디스크 마운트별 사용률 가로 막대.

**Step 7: DataTable.tsx**

범용 테이블. 정렬/필터. 컬럼 정의, 색상 함수.

**Step 8: dashboard/page.tsx 조합**

레이아웃:
- Row 1: ServerCard ×2 (Purions00, RTK NAS)
- Row 2: CPU/MEM 시계열 차트 | 디스크 바차트
- Row 3: 네트워크 트래픽 차트 | Docker 테이블
- Row 4: 최근 알림 테이블

**Step 9: 통합 테스트**
```bash
# 백엔드 + 프론트엔드 동시 실행
cd /home/nvme1/jhkim/00.Projects/SysMonitor/backend && PYTHONPATH=. uvicorn app.main:app --port 8400 &
cd /home/nvme1/jhkim/00.Projects/SysMonitor/frontend && npm run dev &
# http://localhost:3000/dashboard 에서 확인
```

**Step 10: 커밋**
```bash
git add frontend/
git commit -m "feat: Dashboard page with server cards, charts, tables"
```

---

## Task 11: 프론트엔드 - System 페이지 (탭 구조)

**Files:**
- Create: `frontend/src/app/system/page.tsx` (Overview)
- Create: `frontend/src/app/system/cpu/page.tsx`
- Create: `frontend/src/app/system/memory/page.tsx`
- Create: `frontend/src/app/system/disks/page.tsx`
- Create: `frontend/src/app/system/docker/page.tsx`
- Create: `frontend/src/app/system/layout.tsx` (탭 네비게이션)

**Step 1: system/layout.tsx - 탭 네비게이션**

Overview | CPU | Memory | Disks | Docker 탭. 서버 선택 드롭다운.

**Step 2: Overview - 전체 리소스 게이지 4개 + 요약 테이블**

**Step 3: CPU - 전체 사용률 시계열 + 코어별 사용률 + Load Average**

**Step 4: Memory - 사용량 시계열 + Used/Cache/Available 스택 차트**

**Step 5: Disks - 마운트별 사용률 바차트 + 상세 테이블**

**Step 6: Docker - 컨테이너 목록 테이블 (Name, Image, Status, CPU%, MEM)**

**Step 7: 커밋**
```bash
git add frontend/
git commit -m "feat: System pages (Overview/CPU/Memory/Disks/Docker tabs)"
```

---

## Task 12: 알림 엔진 + Alerts 페이지

**Files:**
- Create: `backend/app/alerts/__init__.py`
- Create: `backend/app/alerts/engine.py`
- Create: `backend/app/routes/alerts.py`
- Modify: `backend/app/scheduler.py` (알림 체크 추가)
- Modify: `backend/app/main.py` (라우터 등록)
- Create: `frontend/src/app/alerts/page.tsx`

**Step 1: alerts/engine.py 구현**

임계값 기반 알림 체크. 설정된 규칙(CPU>90% Warning, >95% Critical 등)과 현재 메트릭 비교. 새 알림 생성, 해결된 알림 자동 해제.

**Step 2: routes/alerts.py**

GET /api/v1/alerts (전체), GET /api/v1/alerts/active (미해결), POST /api/v1/alerts/{id}/acknowledge.

**Step 3: scheduler에 알림 체크 추가**

collect_all() 후 check_alerts() 호출.

**Step 4: frontend alerts/page.tsx**

활성/과거 탭, 심각도 필터, 알림 테이블, acknowledge 버튼.

**Step 5: 커밋**
```bash
git add backend/ frontend/
git commit -m "feat: alert engine + alerts API + alerts page"
```

---

## Task 13: Docker 컨테이너 모니터링

**Files:**
- Create: `backend/app/collectors/docker_collector.py`
- Create: `backend/app/routes/docker.py`
- Modify: `backend/app/scheduler.py`
- Test: `backend/tests/test_docker_collector.py`

**Step 1: docker_collector.py 구현**

docker-py로 로컬 컨테이너 목록, 상태, CPU/MEM 사용량 수집.

**Step 2: NAS Docker는 cAdvisor PromQL로 수집**

기존 PrometheusCollector에 컨테이너 메트릭 쿼리 추가.

**Step 3: routes/docker.py**

GET /api/v1/servers/{id}/docker → 컨테이너 목록.

**Step 4: 커밋**
```bash
git add backend/
git commit -m "feat: Docker container monitoring (local + NAS via cAdvisor)"
```

---

## Task 14: Cloudflare API 연동

**Files:**
- Create: `backend/app/collectors/cloudflare.py`
- Create: `backend/app/routes/cloudflare.py`
- Modify: `backend/app/main.py`

**Step 1: cloudflare.py 구현**

httpx로 CF API 호출: 터널 상태, DNS 레코드, WARP 디바이스 조회. Global API Key + Email 인증.

**Step 2: routes/cloudflare.py**

GET /api/v1/cloudflare/tunnels, GET /api/v1/cloudflare/dns/{zone}, GET /api/v1/cloudflare/warp/devices.

**Step 3: 커밋**
```bash
git add backend/
git commit -m "feat: Cloudflare API integration (tunnels, DNS, WARP)"
```

---

## Task 15: Docker Compose 통합 + Cloudflare Tunnel 배포

**Step 1: .env 파일 생성 (실제 값)**

.env.example을 복사하여 실제 값 입력.

**Step 2: frontend next.config.js에 standalone output 설정**
```js
module.exports = { output: 'standalone' }
```

**Step 3: Docker Compose 빌드 + 실행**
```bash
cd /home/nvme1/jhkim/00.Projects/SysMonitor
docker compose build
docker compose up -d
```

**Step 4: 동작 확인**
```bash
curl http://localhost:8400/api/v1/health
curl http://localhost:3400
```

**Step 5: Cloudflare Tunnel에 ingress 추가**

PURIONS00 터널에 `monitor.purions.com → http://localhost:3400` 추가.

**Step 6: 최종 커밋**
```bash
git add -A
git commit -m "feat: Docker Compose integration + deployment ready"
```

---

## Summary

| Task | 내용 | 예상 파일 수 |
|------|------|------------|
| 1 | 프로젝트 초기화 + Git | 7 |
| 2 | FastAPI 앱 + config | 4 |
| 3 | JWT 인증 | 5 |
| 4 | LocalCollector (psutil) | 2 |
| 5 | PrometheusCollector (NAS) | 2 |
| 6 | 캐시 + SQLite 저장소 | 3 |
| 7 | 스케줄러 + 서버 API | 4 |
| 8 | UI 프레임 (TopBar + Sidebar) | 8 |
| 9 | 로그인 페이지 | 2 |
| 10 | Dashboard 페이지 | 8 |
| 11 | System 페이지 (5탭) | 6 |
| 12 | 알림 엔진 + 페이지 | 4 |
| 13 | Docker 모니터링 | 3 |
| 14 | Cloudflare API | 3 |
| 15 | Docker Compose 배포 | 2 |
| **Total** | | **~60 files** |
