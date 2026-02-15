# Port Allocation Skill Design

## Problem
- Claude 세션들이 ports.yml을 참조하지 않고 포트를 임의 할당
- 수동 업데이트 필요 → stale registry
- 중앙 통제 없이 20+ 프로젝트가 각자 포트 사용

## Solution
ports.yml을 직접 읽기/쓰기하는 3개 스킬 제공. 서버 불필요, 같은 시스템 내 파일 직접 조작.

## Architecture

```
Claude Session → /port-allocate → Read ports.yml → 빈 포트 선택 → Edit ports.yml
Claude Session → /port-release  → Read ports.yml → 엔트리 삭제 → Edit ports.yml
Claude Session → /port-query    → Read ports.yml → 현황 출력
```

- Registry: /home/nvme1/jhkim/00.Projects/SysMonitor/ports.yml
- Dashboard: http://192.192.192.169:3400/ports (기존 SysMonitor API 유지, 조회 전용)

## Skills

### port-allocate
1. 서비스명, 프로젝트명, 카테고리 수집
2. ports.yml 읽어 카테고리 범위에서 사용 중인 포트 파악
3. 범위 내 가장 낮은 빈 포트 선택
4. ports.yml에 새 엔트리 추가
5. 할당 결과 보고

Edge cases:
- 범위 가득 참 → 오류 + 인접 범위 제안
- 같은 이름 서비스 존재 → 기존 할당 안내, 중복 방지
- 카테고리 미지정 → 서비스 유형으로 추론 (frontend→infrastructure, api→backend, db→database)

### port-release
1. 포트번호 또는 서비스명으로 대상 특정
2. 삭제 전 확인 프롬프트
3. ports.yml에서 엔트리 삭제

### port-query
1. ports.yml 읽어 카테고리별 현황 출력
2. 필터: 카테고리별, 프로젝트별, 전체

## CLAUDE.md Rules
```
- 새 포트 필요 시: /port-allocate 스킬 사용 (수동 할당 금지)
- 포트 해제 시: /port-release 스킬 사용
- 현황 확인: /port-query 스킬 사용
```

## Skill Trigger Conditions
- docker-compose.yml에 ports: 작성 시 → port-allocate
- .env에 PORT= 설정 시 → port-allocate
- 서비스/컨테이너 삭제 시 → port-release
- "포트", "port" 언급 시 → port-query
