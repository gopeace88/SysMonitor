# Port Allocation Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ports.yml을 직접 읽기/쓰기하는 3개 스킬(port-allocate, port-release, port-query)을 만들어 모든 Claude 세션이 포트를 자동 할당/해제/조회할 수 있게 한다.

**Architecture:** 스킬이 `~/.claude/skills/` 디렉토리에 배치되어 모든 프로젝트의 Claude 세션에서 사용 가능. 스킬은 ports.yml 파일을 Read/Edit 도구로 직접 조작. SysMonitor 서버 의존 없음.

**Tech Stack:** Claude Code skills (SKILL.md), YAML (ports.yml)

---

### Task 1: port-allocate 스킬 작성

**Files:**
- Create: `~/.claude/skills/port-allocate/SKILL.md`

**Step 1: 스킬 파일 작성**

```markdown
---
name: port-allocate
description: Use when a new service, container, or application needs a TCP port assigned. Triggers include writing docker-compose.yml ports, setting PORT in .env, or any mention of needing a new port for a service.
---

# Port Allocate

## Overview
포트 레지스트리(ports.yml)에서 빈 포트를 찾아 할당하고 기록한다.

## Registry Path
`/home/nvme1/jhkim/00.Projects/SysMonitor/ports.yml`

## Process

1. 사용자에게 확인할 정보:
   - **name**: 서비스명 (예: my-api-server)
   - **project**: 프로젝트명 (예: MyProject)
   - **category**: 카테고리 (아래 범위 참조). 미지정 시 서비스 유형으로 추론:
     - frontend/dashboard/client → infrastructure
     - api/backend/server → backend
     - db/postgres/mysql → database
     - redis/cache → cache
     - dev/vite → dev
     - prometheus/grafana/exporter → monitoring

2. ports.yml을 Read 도구로 읽는다

3. 해당 카테고리의 범위에서 사용 중인 포트를 파악한다:
   - system: 1-1023
   - infrastructure: 3000-3499
   - dev: 5000-5999
   - database: 5400-5499
   - cache: 6300-6399
   - backend: 8000-8999
   - monitoring: 9000-9199

4. 범위 내 가장 낮은 빈 포트를 선택한다

5. ports.yml의 해당 카테고리 섹션에 새 엔트리를 Edit 도구로 추가한다:
   ```yaml
     - name: <service-name>
       port: <allocated-port>
       project: <project-name>
       category: <category>
   ```

6. 할당 결과를 보고한다:
   ```
   Port allocated: <port>
   Service: <name>
   Project: <project>
   Category: <category>
   ```

## Edge Cases
- 범위 가득 참 → "category 범위 (start-end)에 빈 포트가 없습니다" 오류
- 같은 name이 이미 존재 → "이미 <name>이 port <N>에 할당되어 있습니다. 기존 할당을 사용하세요." 안내
- ports.yml 파일 없음 → 오류 메시지 출력

## Common Mistakes
- 포트를 할당하고 ports.yml에 기록하지 않음 → 이 스킬이 자동으로 기록
- 범위 밖 포트 사용 → 이 스킬은 범위 내에서만 할당
```

**Step 2: 커밋**

```bash
git add ~/.claude/skills/port-allocate/SKILL.md
git commit -m "feat: add port-allocate skill"
```

---

### Task 2: port-release 스킬 작성

**Files:**
- Create: `~/.claude/skills/port-release/SKILL.md`

**Step 1: 스킬 파일 작성**

```markdown
---
name: port-release
description: Use when removing a service, deleting a container, or decommissioning an application that has an assigned TCP port. Triggers include removing docker-compose services, deleting projects, or any mention of freeing or releasing a port.
---

# Port Release

## Overview
포트 레지스트리(ports.yml)에서 서비스 엔트리를 제거하여 포트를 해제한다.

## Registry Path
`/home/nvme1/jhkim/00.Projects/SysMonitor/ports.yml`

## Process

1. 사용자에게 확인할 정보 (둘 중 하나):
   - **port**: 해제할 포트 번호
   - **name**: 해제할 서비스명

2. ports.yml을 Read 도구로 읽어 대상 엔트리를 찾는다

3. 대상을 찾으면 사용자에게 확인:
   ```
   다음 포트를 해제합니다:
     Port: <port>
     Name: <name>
     Project: <project>
   계속할까요?
   ```

4. 승인 시 Edit 도구로 해당 엔트리(name, port, project, category 4줄 + 빈 줄)를 삭제한다

5. 결과 보고:
   ```
   Port <port> (<name>) released.
   ```

## Edge Cases
- 존재하지 않는 포트/서비스 → "<port> 또는 <name>이 레지스트리에 없습니다" 안내
- system 카테고리 포트 해제 시도 → "시스템 포트(22, 53 등)는 해제할 수 없습니다" 경고
```

**Step 2: 커밋**

```bash
git add ~/.claude/skills/port-release/SKILL.md
git commit -m "feat: add port-release skill"
```

---

### Task 3: port-query 스킬 작성

**Files:**
- Create: `~/.claude/skills/port-query/SKILL.md`

**Step 1: 스킬 파일 작성**

```markdown
---
name: port-query
description: Use when checking port assignments, looking up which ports are in use, finding available ports, or reviewing port allocation status. Triggers include questions about ports, checking for conflicts, or planning port assignments.
---

# Port Query

## Overview
포트 레지스트리(ports.yml)를 읽어 카테고리별 현황을 출력한다.

## Registry Path
`/home/nvme1/jhkim/00.Projects/SysMonitor/ports.yml`

## Process

1. ports.yml을 Read 도구로 읽는다

2. 카테고리별로 정리하여 출력:
   ```
   ## Port Registry (<total> services)

   ### <category> (<start>-<end>) — <used>/<total_slots> used
     <port>  <name>                <project>
     ...
   ```

3. 필터가 지정된 경우:
   - 카테고리별: 해당 카테고리만 표시
   - 프로젝트별: 해당 프로젝트의 포트만 표시
   - 빈 포트 조회: 특정 카테고리의 빈 포트 목록

## Edge Cases
- ports.yml 없음 → "레지스트리 파일이 없습니다" 안내
- 빈 카테고리 → 해당 카테고리는 "(empty)" 표시
```

**Step 2: 커밋**

```bash
git add ~/.claude/skills/port-query/SKILL.md
git commit -m "feat: add port-query skill"
```

---

### Task 4: CLAUDE.md 업데이트

**Files:**
- Modify: `/home/nvme1/jhkim/00.Projects/CLAUDE.md`

**Step 1: Port Registry 섹션 교체**

기존:
```markdown
## Port Registry

이 서버(purions00)의 모든 프로젝트는 TCP 포트 할당 시 아래 규칙을 따라야 합니다.

- 레지스트리 파일: `/home/nvme1/jhkim/00.Projects/SysMonitor/ports.yml`
- 대시보드: http://192.192.192.169:3400/ports

### 포트 할당 절차
1. 새 서비스에 포트를 할당하기 전에 `ports.yml`을 읽어 사용 중인 포트를 확인
2. 권장 범위 내에서 빈 포트를 선택:
   ...
3. 포트 할당 후 반드시 `ports.yml`에 등록 (name, port, project, category 필수)
```

교체:
```markdown
## Port Registry

이 서버(purions00)의 모든 프로젝트는 TCP 포트 할당 시 아래 규칙을 따라야 합니다.

- 새 포트 필요 시: `/port-allocate` 스킬 사용 (수동 할당 금지)
- 포트 해제 시: `/port-release` 스킬 사용
- 현황 확인: `/port-query` 스킬 사용
- 레지스트리: `/home/nvme1/jhkim/00.Projects/SysMonitor/ports.yml`
- 대시보드: http://192.192.192.169:3400/ports
```

**Step 2: 커밋**

```bash
git add /home/nvme1/jhkim/00.Projects/CLAUDE.md
# Note: CLAUDE.md is outside SysMonitor repo, commit separately if needed
```

---

### Task 5: 스킬 테스트

**Step 1: port-query 테스트**
- 새 Claude 세션에서 `/port-query` 실행
- ports.yml이 올바르게 읽히고 카테고리별로 출력되는지 확인

**Step 2: port-allocate 테스트**
- `/port-allocate` 실행하여 테스트 서비스 할당
- ports.yml에 엔트리가 추가되었는지 확인
- 같은 이름으로 중복 할당 시도 → 중복 방지 확인

**Step 3: port-release 테스트**
- `/port-release`로 테스트 서비스 해제
- ports.yml에서 엔트리가 제거되었는지 확인

**Step 4: 최종 push**

```bash
git push origin master
```
