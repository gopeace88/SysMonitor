# SysMonitor PRD (Product Requirements Document)

> 본 프로젝트의 UI/UX는 ntopng 웹 인터페이스를 기준으로 하며,
> 운영자 학습 비용 최소화를 위해 레이아웃·정보 구조·인터랙션을 동일하게 유지한다.

---

## 1. 프로젝트 개요

### 1.1 목적
Ubuntu 워크스테이션 서버와 NAS 서버를 통합 모니터링하는 웹 기반 실시간 관제 시스템 구축

### 1.2 대상 인프라

| 서버 | IP | OS | 역할 | 주요 스펙 |
|------|----|----|------|----------|
| Purions00 (로컬) | 192.192.192.169 | Ubuntu 24.04 LTS | 워크스테이션 / Docker Host / KVM | i9-10900 (20T), 32GB RAM, NVMe+SSD×3 |
| RTK NAS (원격) | 192.192.192.145 | Synology DSM 7.3.2 | 스토리지 / Docker Host | DS1522+, Ryzen R1600 (4T), 24GB RAM, RAID5 21TB |

### 1.3 Cloudflare 환경

#### 계정 / Zone
| 항목 | 내용 |
|------|------|
| Account | Gopeace88@gmail.com (Free Plan) |
| purions.com | 메인 서비스 도메인 (NS: dana/quincy.ns.cloudflare.com) |
| rtk.ai | NAS / Vercel 도메인 (NS: dana/quincy.ns.cloudflare.com) |
| humancapital.kr | Google Workspace 전용 |
| runvision.ai | (예비) |

#### Cloudflare Tunnel

**PURIONS00 터널** (`553acef3`) → Purions00 서버 (ICN PoP, v2026.1.1)

| Public Hostname | Service |
|----------------|---------|
| openweb.purions.com | http://localhost:3000 (Open WebUI) |
| dify.purions.com | http://localhost:3005 (Dify) |
| n8n.purions.com | http://localhost:5678 (n8n) |
| webhook.purions.com | http://localhost:5678 (n8n webhook) |
| langflow.purions.com | http://localhost:7860 (Langflow) |
| portainer.purions.com | http://localhost:9000 (Portainer) |
| webmin.purions.com | http://localhost:10000 (Webmin) |
| ollama.purions.com | http://localhost:11434 (Ollama) |
| postg.purions.com | tcp://localhost:5432 (PostgreSQL) |
| postg2.purions.com | tcp://localhost:5444 (PostgreSQL 2) |

**RTK 터널** (`1cff6aaa`) → NAS Docker (ICN PoP)

| Public Hostname | Service |
|----------------|---------|
| rtk.ai | http://192.192.192.145 (Synology DSM) |
| www.rtk.ai | http://192.192.192.145 |
| webdav.rtk.ai | https://192.192.192.145:5006 (WebDAV) |
| postg.rtk.ai | tcp://localhost:5432 (PostgreSQL) |
| postg2.rtk.ai | tcp://localhost:5444 (PostgreSQL 2) |

**PURIONS 터널** (`c6d8f7ad`) → SSH/RDP 전용

| Public Hostname | Service |
|----------------|---------|
| ssh.purions.com | SSH (Purions00:2222) |
| rdp.purions.com | RDP |

#### Private Network (WARP → 내부망)
| 네트워크 | 터널 | Virtual Network | 비고 |
|----------|------|----------------|------|
| 192.192.192.0/24 | RTK | default (`e8aafc3a`) | WARP 클라이언트로 내부망 직접 접근 |

#### WARP 등록 디바이스 (9대)
| 디바이스 | OS | 비고 |
|----------|-----|------|
| jhkim-notebook | Windows 2025.6.1400 | 주 사용 |
| DESKTOP-EFBU8AA | Windows | |
| 진희의 Tab S8+ | Android 6.81 | |
| 외 6대 | Windows/Android | |

#### Cloudflare Access
| Application | Domain | Type |
|------------|--------|------|
| ssh | ssh.purions.com | SSH Browser Rendering |
| postgres | webmin.purions.com | SSH |
| postg2 | postg2.rtk.ai | self_hosted |
| warp | purions.com | self_hosted |
| App Launcher | gopeace88.cloudflareaccess.com | app_launcher |

#### purions.com DNS 레코드
| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | dify.purions.com | PURIONS00 터널 | Proxied |
| CNAME | langflow.purions.com | PURIONS00 터널 | Proxied |
| CNAME | n8n.purions.com | PURIONS00 터널 | Proxied |
| CNAME | ollama.purions.com | PURIONS00 터널 | Proxied |
| CNAME | openweb.purions.com | PURIONS00 터널 | Proxied |
| CNAME | portainer.purions.com | PURIONS00 터널 | Proxied |
| CNAME | postg.purions.com | PURIONS00 터널 | Proxied |
| CNAME | postg2.purions.com | PURIONS00 터널 | Proxied |
| CNAME | webmin.purions.com | PURIONS00 터널 | Proxied |
| CNAME | webhook.purions.com | PURIONS00 터널 | Proxied |
| CNAME | rdp.purions.com | PURIONS 터널 | Proxied |
| CNAME | ssh.purions.com | PURIONS 터널 | Proxied |
| CNAME | rtk.purions.com | RTK 터널 | Proxied |
| CNAME | *.purions.com | purions.com (Wildcard) | Proxied |
| CNAME | www.purions.com | purions.com | Proxied |
| CNAME | yuandi.purions.com | Vercel | DNS-only |
| MX | purions.com | mx.yandex.net | - |
| TXT | purions.com | v=spf1 redirect=_spf.yandex.net | - |

#### rtk.ai DNS 레코드
| Type | Name | Target | Proxy |
|------|------|--------|-------|
| A | rtk.ai | 76.76.21.21 (Vercel) | Proxied |
| CNAME | *.rtk.ai | rtk.ai (Wildcard) | Proxied |
| CNAME | www.rtk.ai | rtk.ai | Proxied |
| CNAME | postg.rtk.ai | RTK 터널 | Proxied |
| CNAME | postg2.rtk.ai | RTK 터널 | Proxied |
| CNAME | webdav.rtk.ai | RTK 터널 | Proxied |
| CNAME | yuandi.rtk.ai | Vercel | DNS-only |
| MX | rtk.ai | Google Workspace (5개) | - |
| TXT | rtk.ai | Atlassian, Google, SPF | - |

#### SysMonitor 접근 (예정)
| 항목 | 내용 |
|------|------|
| 내부 접근 | http://192.192.192.169:PORT (직접) |
| 외부 접근 | monitor.purions.com (PURIONS00 터널에 ingress 추가 예정) |
| 인증 | Cloudflare Access + JWT 이중 인증 가능 |

### 1.4 NAS 수집 방식
| 항목 | 내용 |
|------|------|
| SSH 키 인증 | ed25519, `~/.ssh/sysmonitor_nas` → `jhkim@192.192.192.145` |
| 기존 모니터링 | Prometheus + Grafana + Node Exporter + cAdvisor + SNMP Exporter (NAS Docker에서 운영 중) |

### 1.4 핵심 가치
- **실시간성**: 시스템/네트워크 상태를 5초 이내 지연으로 파악
- **정보 밀도**: ntopng 수준의 데이터 밀집 UI
- **운영 친화**: 별도 학습 없이 즉시 사용 가능한 UX
- **통합 관제**: 서버 시스템 메트릭 + 네트워크 트래픽을 단일 화면에서 확인

---

## 2. 모니터링 범위

### 2.1 시스템 메트릭 (Server Metrics)

#### CPU
| 메트릭 | 설명 |
|--------|------|
| Usage % (전체/코어별) | 사용률 시계열 그래프 |
| Load Average | 1m / 5m / 15m |
| Process Count | running / sleeping / zombie |
| Top Processes | CPU 점유율 상위 프로세스 |

#### Memory
| 메트릭 | 설명 |
|--------|------|
| Used / Free / Available | 실시간 사용량 |
| Swap Usage | 스왑 사용률 |
| Buffer / Cache | 버퍼/캐시 분리 표시 |

#### Disk
| 메트릭 | 설명 |
|--------|------|
| Usage per Mount | 마운트별 사용률/잔여 용량 |
| I/O Throughput | Read/Write (MB/s) 시계열 |
| IOPS | 초당 I/O 연산 수 |
| Latency | I/O 지연 시간 |

#### 스토리지 맵 (Purions00)
```
/dev/nvme1n1p2  228G  → / (루트)
/dev/nvme0n1p1  1.8T  → /home/nvme1
/dev/sdb1       917G  → /home/ssd1
/dev/sdc1       917G  → /home/ssd2
/dev/sda        917G  → /home/ssd3
```

#### Network (호스트 단위)
| 메트릭 | 설명 |
|--------|------|
| Bandwidth In/Out | 인터페이스별 트래픽 (bps) |
| Packets In/Out | 패킷 수 |
| Errors / Drops | 오류/드롭 패킷 |
| Connection Count | 활성 연결 수 |
| Top Connections | 상위 연결 (IP:Port 기준) |

#### Services / Processes
| 메트릭 | 설명 |
|--------|------|
| Docker Containers | 컨테이너 상태/리소스 |
| KVM VMs | 가상머신 상태 (virbr0) |
| Systemd Services | 주요 서비스 상태 |
| Uptime | 서버 가동 시간 |

### 2.2 NAS 전용 메트릭 (Synology DS1522+)

| 메트릭 | 설명 |
|--------|------|
| Volume1 사용량 | 21TB RAID5 (현재 368G/21T, 2%) |
| RAID 상태 | md2(RAID5 3디스크 [UUU]), md1/md0(RAID1) |
| 디스크 온도 | S.M.A.R.T 기반 (sata1~3) |
| 공유 폴더 | NetBackup, Work, dev-backup, docker, homes, web, web_packages |
| Docker 컨테이너 | Synology Container Manager (아래 상세) |
| DSM 버전 | 7.3.2 (build 86009) |
| 네트워크 | eth0 (active), eth1~3 (inactive), Docker 브릿지 다수 |
| 활성 세션 | 현재 접속 중인 클라이언트 |

#### NAS Docker 컨테이너 현황
| 컨테이너 | 이미지 | 포트 | 상태 |
|----------|--------|------|------|
| Prometheus | prom/prometheus | 9090 (내부) | Running |
| Grafana | grafana/grafana | 3340→3000 | Running |
| Prometheus-Node | prom/node-exporter | 9100 (내부) | Running |
| Prometheus-cAdvisor | gcr.io/cadvisor/cadvisor | 8080 (내부) | Running |
| Prometheus-SNMP | prom/snmp-exporter | 9116 (내부) | Running |
| PostgreSQL-RTK | rtk-nas-postgres | 5444→5432 | Running |
| Gitea | gitea/gitea | 3052→3000, 2222→22 | Running |
| Gitea-DB | postgres | 5432 (내부) | Running |
| GitLab CE | gitlab-ce | 19080→80, 19443→443, 19022→22 | Running (unhealthy) |
| Portainer | portainer-ce | 9000, 8000 | Running |
| Cloudflared | cloudflare/cloudflared | - | Running (RTK 터널) |
| DocViewer ×2 | synology/docviewer | - | Running |

#### NAS Prometheus 수집 설정 (기존)
| Job | Target | 주기 |
|-----|--------|------|
| prometheus | prometheus:9090 | 10s |
| nodeexporter | nodeexporter:9100 | 5s |
| cadvisor | cadvisor:8080 | 5s |
| snmp (Synology) | 192.192.192.145 (SNMPv3) | 5s |
| speedtest | speedtest:9877 | 60m |

### 2.3 네트워크 모니터링 (ntopng 스타일)

| 기능 | 설명 |
|------|------|
| Traffic Dashboard | 실시간 트래픽 총량, Top Talkers (Sankey) |
| Hosts | 활성 호스트 목록, IP/MAC, 트래픽량 |
| Flows | 활성 플로우 (Src→Dst, Protocol, Bytes) |
| Protocols | 프로토콜별 대역폭 분포 (Pie Chart) |
| Alerts | 임계값 초과, 이상 트래픽, 서비스 다운 알림 |

---

## 3. 기술 아키텍처

### 3.1 시스템 구성도
```
┌─────────────────────────────────────────────────────────┐
│                    Web Browser (Client)                  │
│                   SysMonitor Frontend                    │
│              Next.js + React + Tailwind CSS              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                   SysMonitor Backend                     │
│                  FastAPI (Python 3.12+)                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│  │ REST API │  │ WebSocket │  │ Alert Engine         │  │
│  │          │  │ (실시간)  │  │ (임계값 / 이상탐지) │  │
│  └────┬─────┘  └─────┬─────┘  └──────────┬───────────┘  │
│       │              │                   │              │
│  ┌────▼──────────────▼───────────────────▼───────────┐  │
│  │              Collector Service                     │  │
│  │  - psutil (로컬 시스템)                           │  │
│  │  - paramiko/SSH (NAS 원격 수집)                   │  │
│  │  - Prometheus API (NAS 기존 스택 활용)            │  │
│  │  - Docker SDK                                     │  │
│  │  - libvirt (KVM)                                  │  │
│  └────────────────────┬──────────────────────────────┘  │
│                       │                                 │
│  ┌────────────────────▼──────────────────────────────┐  │
│  │            Time-Series DB (InfluxDB / SQLite)     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

       수집 대상:
       ┌──────────────────┐    ┌──────────────────┐
       │  Purions00       │    │  NAS Server      │
       │  192.192.192.169 │    │  192.192.192.145 │
       │  (로컬 수집)     │    │  (SSH/SNMP 수집) │
       └──────────────────┘    └──────────────────┘
```

### 3.2 기술 스택

| 계층 | 기술 | 선정 사유 |
|------|------|----------|
| **Frontend** | Next.js 14+ (App Router) | SSR + 실시간 업데이트 |
| **UI Framework** | React 18+ | 컴포넌트 기반 UI |
| **스타일링** | Tailwind CSS | Dark Theme, 유틸리티 기반 |
| **차트** | Chart.js / Apache ECharts | 실시간 시계열, Sankey, Pie |
| **상태관리** | Zustand | 경량 상태관리 |
| **Backend** | FastAPI (Python 3.12+) | 비동기 고성능, WebSocket 지원 |
| **데이터 수집** | psutil, paramiko, docker-py, prometheus_client | 시스템 메트릭 수집 (NAS는 기존 Prometheus 활용 가능) |
| **DB** | InfluxDB 2.x 또는 SQLite + TimescaleDB | 시계열 데이터 저장 |
| **인증** | JWT (단일 관리자) | 간소한 인증 |
| **배포** | Docker Compose | 단일 서버 배포 |

### 3.3 데이터 수집 주기

| 데이터 유형 | 수집 주기 | 보존 기간 |
|-------------|----------|----------|
| CPU / Memory / Network (실시간) | 5초 | Raw: 24시간 |
| Disk I/O | 10초 | Raw: 24시간 |
| Disk Usage | 1분 | 1년 |
| Docker / VM 상태 | 15초 | Raw: 24시간 |
| NAS 상태 | 30초 | Raw: 7일 |
| 집계 데이터 (1분 평균) | - | 30일 |
| 집계 데이터 (1시간 평균) | - | 1년 |

---

## 4. API 설계

### 4.1 REST API

```
GET  /api/v1/servers                    # 서버 목록
GET  /api/v1/servers/{id}/overview      # 서버 종합 현황
GET  /api/v1/servers/{id}/cpu           # CPU 메트릭
GET  /api/v1/servers/{id}/memory        # 메모리 메트릭
GET  /api/v1/servers/{id}/disk          # 디스크 메트릭
GET  /api/v1/servers/{id}/network       # 네트워크 메트릭
GET  /api/v1/servers/{id}/processes     # 프로세스 목록
GET  /api/v1/servers/{id}/docker        # Docker 컨테이너
GET  /api/v1/servers/{id}/vms           # KVM 가상머신

GET  /api/v1/network/flows              # 활성 플로우
GET  /api/v1/network/hosts              # 활성 호스트
GET  /api/v1/network/protocols          # 프로토콜 분포
GET  /api/v1/network/traffic            # 트래픽 요약

GET  /api/v1/alerts                     # 알림 목록
GET  /api/v1/alerts/active              # 활성 알림
POST /api/v1/alerts/rules               # 알림 규칙 설정

GET  /api/v1/cloudflare/tunnels              # CF 터널 상태
GET  /api/v1/cloudflare/dns/{zone}           # DNS 레코드
GET  /api/v1/cloudflare/warp/devices         # WARP 디바이스 목록

GET  /api/v1/history/{metric}?from=&to=&interval=  # 이력 조회
```

### 4.2 WebSocket

```
WS /ws/realtime                         # 실시간 전체 메트릭 스트림
WS /ws/alerts                           # 실시간 알림 스트림
```

메시지 포맷:
```json
{
  "type": "metric",
  "server_id": "purions00",
  "timestamp": "2026-02-08T00:00:00Z",
  "data": {
    "cpu": { "usage_percent": 12.5, "cores": [...] },
    "memory": { "used_gb": 10.2, "total_gb": 31.3 },
    "network": { "rx_bps": 1234567, "tx_bps": 987654 }
  }
}
```

---

## 5. UI/UX 디자인 요구사항

### 5.1 디자인 원칙

| 원칙 | 설명 |
|------|------|
| 레퍼런스 준용 | ntopng UI를 Canonical Design Spec으로 사용 |
| 신규 UX 실험 | ❌ 금지 |
| 목표 | "동일한 정보 구조 + 시각 흐름" |
| 학습 비용 | 0에 가까운 운영자 친화 UI |

기준 URL: https://ntopng.nmsglobal.kr/ntopng

### 5.2 전역 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│ Top Bar                                                 │
│ ┌──────┐ ┌──────────────┐    ┌──────┐ ┌─────┐ ┌──────┐│
│ │ Logo │ │서버 선택 드롭│    │ 시간 │ │알림 │ │ User ││
│ └──────┘ └──────────────┘    └──────┘ └─────┘ └──────┘│
│  [서버 처리량 표시]  [상태 배지: Alerts | Hosts | Flows]│
├────────────┬────────────────────────────────────────────┤
│ Left       │ Main Content Area                          │
│ Sidebar    │                                            │
│            │  ┌──────────────────────────────────────┐  │
│ Dashboard  │  │ Charts / Graphs                      │  │
│ Interfaces │  │ - 실시간 트래픽 시계열               │  │
│ Hosts      │  │ - CPU/Memory 사용률                  │  │
│ Flows      │  │ - Top Talkers (Sankey)               │  │
│ Alerts     │  └──────────────────────────────────────┘  │
│ System     │  ┌──────────────────────────────────────┐  │
│ Settings   │  │ Tables                               │  │
│            │  │ - 정렬/필터 가능                     │  │
│            │  │ - IP 클릭 → Drill-down               │  │
│            │  └──────────────────────────────────────┘  │
└────────────┴────────────────────────────────────────────┘
```

### 5.3 Top Bar 상태 배지 (ntopng 동일)

| 배지 | 색상 | 내용 |
|------|------|------|
| Engaged Alerts | 노란 삼각형 | 활성 알림 수 |
| Warning Flows | 노란 삼각형 | 경고 수준 플로우 |
| Error Flows | 빨간 삼각형 | 에러 수준 플로우 |
| Active Hosts | 초록 | 활성 로컬 호스트 수 |
| Devices | 회색 | 원격 호스트/장치 수 |
| Active Flows | 회색 | 활성 플로우 수 |

### 5.4 메뉴 구조

```
Left Sidebar (고정)
├── Dashboard          # 종합 현황
├── Interfaces         # 네트워크 인터페이스 (enp3s0, docker0, virbr0...)
├── Hosts              # 활성 호스트 목록
├── Flows              # 네트워크 플로우
├── Alerts             # 알림 (시스템 + 네트워크)
├── System             # 서버 상세 (CPU, Memory, Disk, Docker, VM)
│   ├── Overview       # 서버 종합 현황
│   ├── CPU            # CPU 상세
│   ├── Memory         # 메모리 상세
│   ├── Disks          # 디스크/스토리지
│   ├── Docker         # 컨테이너 관리
│   └── VMs            # 가상머신
└── Settings           # 설정 (알림 규칙, 수집 주기, 사용자)
```

메뉴 명칭, 순서, 아이콘 변경 불가

### 5.5 색상 / 시각 스타일

**Dark Mode 기본 (고정)**

| 요소 | 색상 |
|------|------|
| Background | Dark Gray (`#1a1a2e` ~ `#16213e`) |
| Surface | Slightly Lighter (`#1e293b`) |
| Text | Light Gray / White (`#e2e8f0`) |
| 정상 | Green (`#22c55e`) |
| 경고 | Orange (`#f59e0b`) |
| 위험 | Red (`#ef4444`) |
| 링크/선택 | Blue (`#3b82f6`) |

### 5.6 타이포그래피

| 항목 | 요구 |
|------|------|
| 본문 | Sans-serif (Inter, Pretendard) |
| 숫자 | Monospace 계열 (JetBrains Mono, Fira Code) |
| 단위 | 자동 표기 (bps → Kbps → Mbps → Gbps) |
| 바이트 | 자동 표기 (B → KB → MB → GB → TB) |
| 시간 | 상대시간 + 절대시간 병행 ("3분 전 / 00:17:32") |

### 5.7 컴포넌트 단위 UX 규칙

#### 그래프 (Charts)
- 실시간 auto-refresh (5초)
- Hover 시 상세 값 툴팁
- Time Range 선택: 5m / 15m / 1h / 6h / 24h / 7d / Custom
- 축 자동 스케일링

#### 테이블
- Sort / Filter 가능
- IP 클릭 → Host 상세 Drill-down
- 상태 컬럼은 색상 강조
- 페이지네이션 또는 가상 스크롤
- CSV/JSON 내보내기

#### Drill-down UX
```
Dashboard
  → Interface (enp3s0)
     → Host (192.192.192.145)
        → Flow (TCP 192.192.192.169:443 → 192.192.192.145:22)
           → Protocol / Port / 상세
```

### 5.8 Dashboard 위젯 구성

| 위젯 | 유형 | 내용 |
|------|------|------|
| 서버 상태 카드 | Summary Card | 서버별 UP/DOWN, CPU, MEM, NET 요약 |
| 실시간 트래픽 | Area Chart | 인터페이스별 In/Out 트래픽 (bps) |
| Top Talkers | Sankey Diagram | 상위 트래픽 호스트 쌍 시각화 |
| Top Hosts | Pie Chart | 호스트별 트래픽 점유율 |
| Top Protocols | Pie Chart | 프로토콜별 대역폭 분포 |
| CPU/Memory 추이 | Line Chart | 서버별 CPU/MEM 시계열 |
| 디스크 사용률 | Bar Chart | 마운트별 사용률 (%) |
| 최근 알림 | Table | 최근 알림 목록 (시간/유형/내용) |
| Docker 상태 | Table | 컨테이너별 상태/CPU/MEM |

---

## 6. 페이지별 상세 명세

### 6.1 Dashboard 페이지
- 모든 서버의 종합 상태 한눈에 파악
- 위젯 기반 레이아웃 (5.8 참조)
- 자동 새로고침 (5초)
- 서버 선택 시 해당 서버 필터링

### 6.2 Interfaces 페이지
- 네트워크 인터페이스 목록 (enp3s0, docker0, virbr0, br-* 등)
- 인터페이스별: 상태(UP/DOWN), 속도, In/Out 트래픽, 패킷, 에러
- 인터페이스 클릭 → 상세 트래픽 그래프 + 연결된 호스트

### 6.3 Hosts 페이지
- 활성 호스트 테이블 (IP, MAC, Name, Traffic, Flows, First/Last Seen)
- 로컬/원격 호스트 분류
- 호스트 클릭 → 호스트 상세 (트래픽, 플로우, 프로토콜, 히스토리)

### 6.4 Flows 페이지
- 활성 네트워크 플로우 테이블
- 컬럼: Client → Server, Protocol, L7 Protocol, Bytes, Duration, Info
- 실시간 업데이트
- 필터: Protocol, Host, Port, Application

### 6.5 Alerts 페이지
- 활성/과거 알림 탭 분리
- 알림 유형: 시스템 (CPU/MEM/Disk 임계값), 네트워크 (트래픽 이상), 서비스 (Docker/VM down)
- 심각도 필터: Info / Warning / Error / Critical
- 알림 확인(acknowledge) 기능

### 6.6 System 페이지
- 서버별 상세 시스템 메트릭
- 탭 구조: Overview / CPU / Memory / Disks / Docker / VMs
- Overview: 전체 리소스 게이지 + 요약
- 각 탭: 시계열 그래프 + 상세 테이블

### 6.7 Settings 페이지
- 서버 관리: 서버 추가/삭제, 연결 설정 (SSH 키, SNMP community)
- 알림 규칙: 메트릭별 임계값 설정
- 수집 설정: 수집 주기, 보존 기간
- 사용자 관리: 비밀번호 변경
- 시스템 정보: 버전, 라이선스

---

## 7. 알림 시스템

### 7.1 기본 알림 규칙

| 알림 | 조건 | 심각도 |
|------|------|--------|
| CPU 높음 | > 90% (5분 지속) | Warning |
| CPU 매우 높음 | > 95% (1분 지속) | Critical |
| 메모리 부족 | Available < 10% | Warning |
| 메모리 고갈 | Available < 5% | Critical |
| 디스크 부족 | Usage > 85% | Warning |
| 디스크 위험 | Usage > 95% | Critical |
| 서비스 다운 | Docker 컨테이너 중단 | Error |
| 호스트 연결 불가 | NAS ping 실패 | Critical |
| 트래픽 이상 | 평소 대비 300% 초과 | Warning |

### 7.2 알림 채널 (Phase 2)
- 웹 UI 실시간 알림 (기본)
- 이메일 (선택)
- Webhook (선택)

---

## 8. 보안 요구사항

| 항목 | 요구 |
|------|------|
| 인증 | JWT 기반 로그인 (관리자 단일 계정) |
| 외부 접근 | Cloudflare Access 경유 (monitor.purions.com) + JWT 이중 인증 |
| HTTPS | Cloudflare Tunnel 경유 시 자동 TLS, 내부 접근 시 self-signed 허용 |
| SSH 키 관리 | NAS 접속용 SSH 키 안전 저장 (`~/.ssh/sysmonitor_nas`) |
| Cloudflare API | Global API Key + Email `.env` 저장, 코드에 하드코딩 금지 |
| API 보호 | 인증 필수, Rate Limiting |
| CORS | 동일 도메인만 허용 |

#### 환경 변수 (.env, .gitignore 필수)
```env
NAS_HOST=192.192.192.145
NAS_SSH_USER=jhkim
NAS_SSH_KEY_PATH=~/.ssh/sysmonitor_nas
CF_API_EMAIL=gopeace88@gmail.com
CF_API_KEY=<Global API Key>
CF_ACCOUNT_ID=28b9de8f436a1a7b49eeb39d61b1fefd
CF_ZONE_PURIONS=4eafbe955e38cac710b7ee7693739a85
CF_ZONE_RTK=084db07a319a721c04f840475a1239ff
JWT_SECRET=<generated>
```

---

## 9. 반응형 정책

| 대상 | 정책 |
|------|------|
| Desktop (1280px+) | Full UI |
| Tablet (768px~) | Read-only 권장, 사이드바 축소 |
| Mobile | ❌ 지원 대상 아님 (운영툴 특성상) |

---

## 10. 개발 단계 (Phases)

### Phase 1: 기반 구축 (MVP)
- [ ] 프로젝트 초기 구조 셋업 (Next.js + FastAPI + Docker Compose)
- [ ] 로컬 서버(Purions00) 시스템 메트릭 수집 (CPU, MEM, Disk, Network)
- [ ] REST API 기본 엔드포인트
- [ ] Dashboard 페이지 (서버 상태 요약 + 트래픽 차트)
- [ ] Dark Theme UI 프레임 (Top Bar + Sidebar + Main Content)
- [ ] JWT 인증

### Phase 2: 핵심 기능
- [ ] WebSocket 실시간 스트리밍
- [ ] NAS 서버(192.192.192.145) 원격 수집 연동
- [ ] Hosts / Flows / Interfaces 페이지
- [ ] Alerts 시스템 (임계값 기반)
- [ ] System 상세 페이지 (CPU/MEM/Disk 탭)
- [ ] Docker 컨테이너 모니터링

### Phase 3: 고도화
- [ ] 이력 데이터 저장 및 조회 (시계열 DB)
- [ ] Top Talkers Sankey Diagram
- [ ] KVM 가상머신 모니터링
- [ ] 알림 채널 확장 (이메일, Webhook)
- [ ] Settings 페이지 완성
- [ ] CSV/JSON 데이터 내보내기

---

## 11. 디자인 레퍼런스 & 법적 주의

### 레퍼런스
- ntopng 공식 UI (https://ntopng.nmsglobal.kr/ntopng)
- 네트워크 운영자에게 검증된 정보 밀도
- 실시간 데이터에 최적화된 레이아웃

### 범위
- ❌ ntopng 소스코드 복제 X
- ✅ 레이아웃, 정보 구조, 인터랙션 패턴, 시각적 톤 준용

### 법적
- UI/UX 패턴 참고는 가능
- 코드/자산 복제 ❌
- ntopng 로고/브랜드 제거 또는 교체

---

## 12. 수용 기준 (Acceptance Criteria)

1. 레퍼런스 URL을 옆에 두고 비교했을 때 정보 위치/흐름/조작 방식이 동일
2. 로컬 서버 CPU/MEM/Disk/Network 실시간 모니터링 가능
3. NAS 서버 연결 상태 및 스토리지 모니터링 가능
4. 알림이 임계값 초과 시 5초 이내 표시
5. 24시간 이력 그래프 조회 가능
6. Docker 컨테이너 상태 확인 가능
7. "디자인 변경 요청 없음" 상태가 되어야 완료

---

## 13. 금지 사항

| 금지 | 사유 |
|------|------|
| Material UI 과도한 사용 | ntopng 톤과 불일치 |
| 카드형 UI 남용 | 정보 밀도 저하 |
| 모바일 앱 느낌의 애니메이션 | 운영툴 특성과 불일치 |
| 신규 UX 패턴 실험 | 학습 비용 증가 |
| 밝은 테마 | Dark Mode 고정 |
