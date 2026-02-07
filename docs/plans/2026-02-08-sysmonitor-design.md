# SysMonitor 상세 설계 (Design Document)

> 승인일: 2026-02-08
> PRD 기반, brainstorming 세션에서 확정된 아키텍처 결정 반영

---

## 1. 아키텍처 결정 사항

| 결정 | 선택 | 사유 |
|------|------|------|
| NAS 데이터 수집 | 기존 Prometheus API 활용 | 중복 수집 방지, NAS에 이미 Node Exporter + cAdvisor + SNMP 운영 중 |
| 로컬 데이터 수집 | psutil 직접 수집 | 외부 의존성 최소화 |
| 시계열 DB | SQLite + 메모리 캐시 | 외부 DB 없이 즉시 시작, 운영 부담 최소 |
| 수집 주기 | 60초 (1분) | 개인 관리 용도, 실시간성보다 전체 상태 파악 우선 |
| 실시간 통신 | REST polling (SWR 60초) | WebSocket 불필요, 아키텍처 단순화 |
| Phase 1 범위 | 시스템 메트릭 + UI 프레임 + Dashboard/System | Flow/Host 네트워크 모니터링은 Phase 2 |

---

## 2. 시스템 구성도

```
┌─────────────────────────────────────────────────┐
│              Web Browser (Client)                │
│         Next.js 14 + ECharts + Tailwind          │
│         SWR auto-refresh (60초 polling)          │
└────────────────────┬────────────────────────────┘
                     │ HTTPS (CF Tunnel) / HTTP (내부)
┌────────────────────▼────────────────────────────┐
│              FastAPI Backend                      │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │ Scheduler (APScheduler, 60초 간격)          │ │
│  │  → LocalCollector (psutil)                  │ │
│  │  → PrometheusCollector (NAS PromQL)         │ │
│  │  → DockerCollector (docker-py)              │ │
│  │  → CloudflareCollector (CF API)             │ │
│  └──────────────────┬──────────────────────────┘ │
│                     ▼                            │
│  ┌─────────────────────────────────────────────┐ │
│  │ MetricsCache (in-memory, 최신 + 최근 1시간)│ │
│  │ SQLiteStore (집계, 24h+ 이력)               │ │
│  └─────────────────────────────────────────────┘ │
│                     │                            │
│  ┌─────────────────▼──────────────────────────┐  │
│  │ REST API Routes                             │  │
│  │  /api/v1/servers/*/overview|cpu|mem|disk|..  │  │
│  │  /api/v1/alerts/*                           │  │
│  │  /api/v1/cloudflare/*                       │  │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
         │                          │
    ┌────▼──────────┐     ┌────────▼──────────┐
    │  Purions00     │     │  NAS (RTK)        │
    │  .169          │     │  .145             │
    │  psutil 직접   │     │  Prometheus:9090  │
    │  docker-py     │     │  (Node/cAdvisor/  │
    │                │     │   SNMP 기존 운영) │
    └────────────────┘     └───────────────────┘
```

---

## 3. 백엔드 상세 설계

### 3.1 디렉토리 구조

```
backend/
├── app/
│   ├── main.py                   # FastAPI 앱 초기화, CORS, 라우터 등록, 스케줄러 시작
│   ├── config.py                 # pydantic-settings 기반 .env 로딩
│   ├── auth/
│   │   └── jwt.py                # JWT 발급/검증, login 라우트
│   ├── collectors/
│   │   ├── base.py               # BaseCollector ABC
│   │   ├── local.py              # psutil: CPU/MEM/Disk/Network/Process
│   │   ├── prometheus.py         # PromQL 쿼리 → NAS 메트릭 조회
│   │   ├── docker_collector.py   # docker-py: 로컬 컨테이너 상태
│   │   └── cloudflare.py         # CF API: 터널/DNS/WARP 조회
│   ├── storage/
│   │   ├── cache.py              # 인메모리 캐시 (dict + deque, 최근 1시간)
│   │   └── sqlite_store.py       # SQLite: 1분/1시간 집계, 이력 조회
│   ├── scheduler.py              # APScheduler: 60초 수집 + 집계 작업
│   ├── alerts/
│   │   └── engine.py             # 임계값 체크, 알림 생성/해제
│   ├── routes/
│   │   ├── auth.py               # POST /api/v1/auth/login
│   │   ├── servers.py            # GET /api/v1/servers/*
│   │   ├── alerts.py             # GET /api/v1/alerts/*
│   │   └── cloudflare.py         # GET /api/v1/cloudflare/*
│   └── models/
│       ├── metrics.py            # Pydantic 응답 모델
│       └── alerts.py             # Alert 모델
├── requirements.txt
├── Dockerfile
└── tests/
```

### 3.2 핵심 컬렉터 설계

#### LocalCollector (psutil)
```python
# 60초마다 수집하는 데이터
{
  "cpu": {
    "usage_percent": float,         # 전체 사용률
    "per_core": [float, ...],       # 코어별 사용률 (20개)
    "load_avg": [float, float, float],  # 1m/5m/15m
    "count": {"physical": 10, "logical": 20}
  },
  "memory": {
    "total_gb": float,
    "used_gb": float,
    "available_gb": float,
    "percent": float,
    "swap_used_gb": float,
    "swap_percent": float
  },
  "disks": [
    {
      "device": "/dev/nvme1n1p2",
      "mountpoint": "/",
      "total_gb": float,
      "used_gb": float,
      "percent": float,
      "io_read_mb": float,          # 이전 대비 delta
      "io_write_mb": float
    }
  ],
  "network": {
    "interfaces": [
      {
        "name": "enp3s0",
        "is_up": bool,
        "rx_bytes_sec": float,      # 이전 대비 delta / 60초
        "tx_bytes_sec": float,
        "rx_packets_sec": float,
        "tx_packets_sec": float,
        "errors": int,
        "drops": int
      }
    ]
  },
  "uptime_seconds": int,
  "process_count": {"total": int, "running": int, "sleeping": int, "zombie": int},
  "top_processes": [
    {"pid": int, "name": str, "cpu_percent": float, "memory_percent": float}
  ]  # 상위 10개
}
```

#### PrometheusCollector (NAS)
```python
# NAS Prometheus (192.192.192.145:9090) PromQL 쿼리
QUERIES = {
    "cpu_usage": '100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)',
    "memory_used": 'node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes',
    "memory_total": 'node_memory_MemTotal_bytes',
    "disk_usage": 'node_filesystem_size_bytes - node_filesystem_avail_bytes',
    "disk_total": 'node_filesystem_size_bytes',
    "network_rx": 'irate(node_network_receive_bytes_total[2m])',
    "network_tx": 'irate(node_network_transmit_bytes_total[2m])',
    "load_avg": 'node_load1',
    # cAdvisor 쿼리
    "container_cpu": 'rate(container_cpu_usage_seconds_total[2m])',
    "container_mem": 'container_memory_usage_bytes',
    # SNMP (Synology 전용)
    "disk_temp": 'snmp_disk_temperature',
    "raid_status": 'snmp_raid_status',
}
```

### 3.3 저장소 설계

#### MetricsCache (인메모리)
```python
# 서버별 최신값 + 최근 60개 (1시간분) 보관
cache = {
    "purions00": {
        "latest": {...},                    # 최신 수집 결과
        "history": deque(maxlen=60),        # 최근 60분 (1분 간격)
        "updated_at": datetime
    },
    "rtk_nas": {
        "latest": {...},
        "history": deque(maxlen=60),
        "updated_at": datetime
    }
}
```

#### SQLite 스키마
```sql
-- 1분 집계 (30일 보존)
CREATE TABLE metrics_1m (
    server_id TEXT,
    timestamp INTEGER,      -- unix epoch
    metric_type TEXT,        -- 'cpu', 'memory', 'disk', 'network'
    metric_name TEXT,        -- 'usage_percent', 'rx_bytes_sec', ...
    value REAL,
    metadata TEXT,           -- JSON (device, mountpoint 등)
    PRIMARY KEY (server_id, timestamp, metric_type, metric_name)
);

-- 1시간 집계 (1년 보존)
CREATE TABLE metrics_1h (
    server_id TEXT,
    timestamp INTEGER,
    metric_type TEXT,
    metric_name TEXT,
    avg_value REAL,
    max_value REAL,
    min_value REAL,
    PRIMARY KEY (server_id, timestamp, metric_type, metric_name)
);

-- 알림 이력
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT,
    severity TEXT,           -- info, warning, error, critical
    type TEXT,               -- cpu_high, memory_low, disk_full, ...
    message TEXT,
    created_at INTEGER,
    resolved_at INTEGER,
    acknowledged BOOLEAN DEFAULT FALSE
);

-- 인덱스
CREATE INDEX idx_metrics_1m_ts ON metrics_1m(server_id, timestamp);
CREATE INDEX idx_metrics_1h_ts ON metrics_1h(server_id, timestamp);
CREATE INDEX idx_alerts_active ON alerts(resolved_at) WHERE resolved_at IS NULL;
```

---

## 4. 프론트엔드 상세 설계

### 4.1 디렉토리 구조

```
frontend/src/
├── app/
│   ├── layout.tsx              # TopBar + Sidebar + Main (ntopng 프레임)
│   ├── page.tsx                # → /dashboard 리다이렉트
│   ├── login/page.tsx
│   ├── dashboard/page.tsx      # Phase 1
│   ├── interfaces/             # Phase 2
│   ├── hosts/                  # Phase 2
│   ├── flows/                  # Phase 2
│   ├── alerts/page.tsx         # Phase 1 (기본)
│   ├── system/
│   │   ├── page.tsx            # Phase 1: Overview
│   │   ├── cpu/page.tsx        # Phase 1
│   │   ├── memory/page.tsx     # Phase 1
│   │   ├── disks/page.tsx      # Phase 1
│   │   ├── docker/page.tsx     # Phase 1
│   │   └── vms/page.tsx        # Phase 2
│   └── settings/page.tsx       # Phase 2
├── components/
│   ├── layout/
│   │   ├── TopBar.tsx
│   │   ├── Sidebar.tsx
│   │   └── StatusBadges.tsx
│   ├── charts/
│   │   ├── TimeSeriesChart.tsx  # ECharts line/area
│   │   ├── PieChart.tsx         # ECharts pie
│   │   ├── GaugeChart.tsx       # ECharts gauge
│   │   └── BarChart.tsx         # ECharts bar
│   ├── tables/
│   │   └── DataTable.tsx        # 범용 (정렬/필터/페이지네이션)
│   └── cards/
│       └── ServerCard.tsx       # 서버 요약 카드
├── hooks/
│   ├── useMetrics.ts            # SWR + 60초 polling
│   └── useAuth.ts               # JWT 인증
├── stores/
│   └── serverStore.ts           # Zustand: 선택된 서버, 시간 범위
└── lib/
    ├── api.ts                   # fetch wrapper + JWT 인터셉터
    └── format.ts                # formatBytes, formatBps, formatDuration
```

### 4.2 Tailwind 커스텀 테마

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',  // 항상 dark
  theme: {
    extend: {
      colors: {
        'sm-bg': '#1a1a2e',
        'sm-bg-dark': '#16213e',
        'sm-surface': '#1e293b',
        'sm-surface-hover': '#334155',
        'sm-text': '#e2e8f0',
        'sm-text-dim': '#94a3b8',
        'sm-ok': '#22c55e',
        'sm-warn': '#f59e0b',
        'sm-error': '#ef4444',
        'sm-link': '#3b82f6',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'Pretendard', 'sans-serif'],
      }
    }
  }
}
```

### 4.3 Dashboard 페이지 레이아웃

```
┌──────────────────────────────────────────────────┐
│ [Purions00 ●] [RTK NAS ●]   서버 상태 카드 (2개) │
├────────────────────────┬─────────────────────────┤
│ CPU/Memory 추이        │ 디스크 사용률           │
│ (Line Chart, 1시간)    │ (Bar Chart, 마운트별)   │
├────────────────────────┼─────────────────────────┤
│ 네트워크 트래픽        │ Docker 컨테이너         │
│ (Area Chart, In/Out)   │ (Table, 상태/CPU/MEM)   │
├────────────────────────┴─────────────────────────┤
│ 최근 알림 (Table, 최근 10건)                      │
└──────────────────────────────────────────────────┘
```

---

## 5. Docker Compose 설계

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8400:8000"
    volumes:
      - ./data:/app/data          # SQLite 저장
      - ~/.ssh/sysmonitor_nas:/app/.ssh/sysmonitor_nas:ro
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

Cloudflare Tunnel ingress 추가 (배포 시):
```
monitor.purions.com → http://localhost:3400
```

---

## 6. Phase 1 구현 범위 (MVP)

### 포함
- [x] 프로젝트 셋업 (Next.js + FastAPI + Docker Compose)
- [x] .env 기반 설정 관리
- [x] JWT 로그인
- [x] LocalCollector (psutil): CPU/MEM/Disk/Network/Docker
- [x] PrometheusCollector: NAS 메트릭 PromQL 조회
- [x] MetricsCache + SQLite 저장
- [x] 60초 스케줄러
- [x] REST API (servers, alerts 기본)
- [x] ntopng 스타일 UI 프레임 (TopBar + Sidebar + Dark Theme)
- [x] Dashboard 페이지 (서버 카드 + 차트 4종 + 알림 테이블)
- [x] System 페이지 (Overview/CPU/Memory/Disks/Docker 탭)
- [x] Alerts 페이지 (기본 임계값 알림)
- [x] CloudflareCollector: 터널 상태 조회

### 제외 (Phase 2+)
- [ ] Interfaces/Hosts/Flows 페이지 (패킷 캡처 기반)
- [ ] WebSocket 실시간 스트리밍
- [ ] KVM VM 모니터링
- [ ] Settings 페이지
- [ ] 이메일/Webhook 알림
- [ ] Sankey Diagram
- [ ] CSV/JSON 내보내기

---

## 7. 구현 순서 (Phase 1 태스크)

### Step 1: 프로젝트 초기화
- git init + .gitignore
- backend: FastAPI 프로젝트 생성, requirements.txt
- frontend: Next.js 14 (App Router) + Tailwind + ECharts
- docker-compose.yml
- .env.example

### Step 2: 백엔드 코어
- config.py (.env 로딩)
- collectors/local.py (psutil)
- collectors/prometheus.py (NAS PromQL)
- storage/cache.py + storage/sqlite_store.py
- scheduler.py (60초 수집 루프)

### Step 3: API 레이어
- auth/jwt.py + routes/auth.py (로그인)
- routes/servers.py (서버 메트릭 API)
- routes/alerts.py (알림 API)
- routes/cloudflare.py (CF 터널/DNS API)

### Step 4: 프론트엔드 프레임
- layout.tsx (TopBar + Sidebar)
- Tailwind 커스텀 테마 (Dark Mode)
- components/layout/* (ntopng 스타일)
- hooks/useMetrics.ts (SWR polling)
- hooks/useAuth.ts (JWT)

### Step 5: 페이지 구현
- login/page.tsx
- dashboard/page.tsx (서버 카드 + 차트 4종 + 알림)
- system/page.tsx + cpu + memory + disks + docker 탭
- alerts/page.tsx

### Step 6: Docker 컨테이너 모니터링
- collectors/docker_collector.py
- 로컬 Docker + NAS Docker (cAdvisor 경유)

### Step 7: 통합 테스트 + 배포
- Docker Compose 빌드/실행 테스트
- Cloudflare Tunnel ingress 추가 (monitor.purions.com)
