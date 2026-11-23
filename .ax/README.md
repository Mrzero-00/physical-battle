# AX AI 엔지니어링 킷 — 구조와 동작

```
┌────────────── 킷 (모든 프로젝트 공통 · 업데이트로 교체) ──────────────┐
│ L1 Prompt   무엇을 어떻게 지시하나    역할 · 기법 · 출력 형식 · 가드레일   │
│ L2 Context  무엇을 읽히나            포함/제외 · 파일당 예산 · scout       │
│ L3 Harness  무엇으로 검사하나        검사 명령 · 프로젝트 규칙             │
│ L4 Loop     언제 다시/언제 멈추나    독립 검수 · 성공 기준 · 종료 기준     │
│ L5 Graph    어떤 순서로 잇나         agent/loop/check/human 노드 · 엣지   │
└──────────────────────────────────────────────────────────────────────┘
┌──── L0 프로젝트 변수 (프로젝트마다 다름 · 인터뷰로 결정) ────┐
│ 서비스 유형 · 이름 · 요약 · 플랫폼 · 스택 · 사용자 · 제약 · 용어 │
└──────────────────────────────────────────────────────────────┘
킷은 "틀"(각 계층의 추천값·검증·실행 절차)을, 프로젝트는 "값"(.ax/project/*.json)을 가집니다.
```

## 파일 구성

| 경로 | 소유 | 역할 |
|---|---|---|
| `CLAUDE.md` | 프로젝트 | 프로젝트 고유 지침 + `@.ax/CLAUDE.md` 불러오기 |
| `.ax/CLAUDE.md` | 킷 | 세팅 전/후 행동 규칙 |
| `.claude/settings.json` | 킷* | SessionStart 훅(상태 안내·맵 갱신), PostToolUse 훅(설정 편집 시 맵 갱신) |
| `.claude/skills/ax-setup` | 킷 | init + 단계별 세팅 인터뷰 (`/ax-setup [단계]`) |
| `.claude/skills/ax-loop` | 킷 | 구현 → 독립 검수 → 수정 루프 |
| `.claude/skills/ax-run` | 킷 | 그래프 노드 순서대로 실행 |
| `.claude/agents/ax-verifier` | 킷 | 독립 검수자 (읽기 전용, 기준별 JSON 판정) |
| `.claude/agents/ax-planner` | 킷 | 명세·수용 기준 작성 |
| `.claude/agents/ax-context-scout` | 킷 | 컨텍스트 예산 안에서 관련 파일 요약 |
| `.ax/presets/services.json` | 킷 | 서비스 유형 7종 + custom 추천값, 프롬프트 기법 설명, 그래프 템플릿 3종 |
| `.ax/bin/ax.cjs` | 킷 | init · 설정 검증/저장 · 추천 · 루프 판정 · 맵 생성 (의존성 없음, Node 18+) |
| `.ax/bin/render.cjs` | 킷 | `.ax/engineering.html` 생성기 |
| `.ax/project/*.json` | 프로젝트 | 세팅 결과 — 커밋 대상 |
| `.ax/kit.lock.json` | 프로젝트 | init 시점의 킷 버전·출처·커밋 |
| `.ax/runs/`, `.ax/engineering.html` | 로컬 | 루프 기록, 자동 생성 맵 (gitignore) |

\* 프로젝트가 훅·권한을 추가하면 업데이트 시 직접 합칩니다.

## 흐름

```
git clone … && claude
  └─ SessionStart 훅 → ax.cjs status --hook
       킷 원본 상태 → 새 프로젝트로 시작할지 질문 → /ax-setup 0단계 init
       세팅 전/중   → "어떤 서비스를 만드실건가요?"부터 / 멈춘 단계부터
       세팅 완료    → 서비스·프롬프트·검사·루프 기준·그래프 요약을 매 세션 주입

/ax-setup   init → L0 서비스 → L1 프롬프트 → L2 컨텍스트 → L3 하네스 → L4 루프 → L5 그래프
            각 단계: ax.cjs recommend <서비스> <단계> → 이유 설명 → 추천/직접 작성 선택 → ax.cjs set
/ax-run     graph.json 순서: human=사용자 승인, agent=서브에이전트, loop=/ax-loop, check=검사 명령
/ax-loop    구현(main) → ax-verifier 검수 → ax.cjs loop record 판정 → CONTINUE/DONE/STOP
```

## 루프 판정 — 모델이 아니라 `ax.cjs loop record`가 결정

```
검수 결과 {criteria[], stop[], failures[], needsUser}
  1 모든 성공 기준 충족 & 결함 없음          → DONE
  2 needsUser                               → STOP (사용자에게 질문)
  3 사용자 정의 종료 기준 발동               → STOP
  4 반복 횟수 ≥ maxIterations               → STOP
  5 최근 repeatFailureLimit회 실패 서명 동일 → STOP (진전 없음)
  6 그 외                                   → CONTINUE (fix 목록 = 미충족 기준 + 결함)
```
- 성공 기준 판정이 하나라도 빠진 검수 결과는 기록을 거부합니다.
- 구현자의 자기 평가는 검수자에게 넘기지 않습니다.
- 그래프의 순환은 반드시 `human` 노드를 거칩니다 (`ax.cjs set graph`에서 검증).

## 엔지니어링 맵 `.ax/engineering.html`
설정 저장 · 루프 시작/기록 · 세션 시작 · 설정 파일 직접 편집 때마다 다시 생성됩니다. 수동: `node .ax/bin/ax.cjs render --open`.
진행도, 계층별 요약, L0~L5 상세, 루프 흐름도와 실제 값이 들어간 판정 규칙, 그래프 다이어그램, 서브에이전트 사용처, 최근 루프 실행 기록을 보여줍니다.

## 킷 업데이트 받기 (init 이후 프로젝트에서)
init이 원본을 `ax` 원격으로 남겨 두었으므로 킷 파일만 골라 가져옵니다.
```bash
git fetch ax
git checkout ax/main -- .ax/bin .ax/presets .ax/CLAUDE.md .ax/README.md .claude/skills .claude/agents
git diff --staged                    # 변경 확인 (프로젝트가 추가한 스킬·에이전트가 지워지지 않았는지 포함)
node .ax/bin/ax.cjs validate         # 기존 설정이 새 킷과 맞는지
git commit -m "AX 킷 업데이트"
```
`.claude/settings.json`과 루트 `CLAUDE.md`는 프로젝트 소유이므로 필요할 때 직접 비교해 합칩니다. `.ax/project/`는 원본에 없으므로 덮어써지지 않습니다.

## 확장
| 추가하려는 것 | 수정 위치 |
|---|---|
| 서비스 유형 | `presets/services.json`의 `services` |
| 프롬프트 기법 | `presets/services.json`의 `techniques` (L1 검증에 자동 반영) |
| 그래프 템플릿 | `presets/services.json`의 `graphs` |
| 서브에이전트 | `.claude/agents/<이름>.md` (그래프 agent 노드·루프 검수자로 지정 가능) |
| 설정 필드 검증 | `bin/ax.cjs`의 `VALIDATE` |

킷을 바꾸면 `presets/services.json`의 `kitVersion`을 올리고 `node --test .ax/tests/*.test.cjs`로 검증합니다.
