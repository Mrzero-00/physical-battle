# AX AI 엔지니어링 킷

이 저장소는 새 프로젝트의 **AI 작업 기반 세팅**입니다. 세션 시작 시 훅(`.ax/bin/ax.cjs status --hook`)이 세팅 상태를 알려줍니다.

- 클론 직후(킷 원본 상태)이면: 새 프로젝트로 시작할지 물은 뒤 `/ax-setup` 0단계에서 `node .ax/bin/ax.cjs init`을 실행합니다.
- 세팅 전이면: 사용자의 첫 요청을 확인한 뒤 `/ax-setup` 절차로 **"어떤 서비스를 만드실건가요?"**부터 한 단계씩 진행합니다.
- 세팅 후에는: 구현 요청은 `/ax-run`(그래프 순서), 단일 구현은 `/ax-loop`(검수 루프), 설정 변경은 `/ax-setup <layer>`.
- 프로젝트 설정은 `.ax/project/*.json`에 있고, 수정은 반드시 `node .ax/bin/ax.cjs set <layer>`로 합니다(형식 검증).
- 전체 엔지니어링 맵: `.ax/engineering.html` (설정·루프 기록이 바뀔 때마다 자동 갱신, 열기: `node .ax/bin/ax.cjs render --open`)
- 서비스별 추천값은 `.ax/presets/services.json`, 서브에이전트는 `.claude/agents/`(ax-verifier · ax-planner · ax-context-scout).

## 5계층 요약
| 계층 | 설정 파일 | 무엇을 정하나 |
|---|---|---|
| L0 변수 | profile.json | 어떤 서비스인지 (매 프로젝트 다름) |
| L1 프롬프트 | prompt.json | 역할 · 기법 · 출력 형식 · 가드레일 |
| L2 컨텍스트 | context.json | 무엇을 읽히고 무엇을 빼는지 · 예산 |
| L3 하네스 | harness.json | 검사 명령 · 프로젝트 규칙 |
| L4 루프 | loop.json | 검수 서브에이전트 · 성공 기준 · 종료 기준 |
| L5 그래프 | graph.json | 노드(agent/loop/check/human) 순서 · 사람 승인 지점 |

## 항상 지킬 것
- **코드 주석 금지:** 코드 파일에는 맨 위(셔뱅이 있으면 그 다음 줄)에 어떤 기능의 코드인지 한 줄 타이틀 주석만 둡니다. 그 밖의 주석(설명·구분선·TODO·주석 처리된 코드)은 쓰지 않으며, 기존 파일을 수정할 때도 남아 있는 주석을 지웁니다.
- 확인되지 않은 사실은 "확인 필요"로 표시하고, 테스트·실행 결과를 꾸며내지 않습니다.
- 루프의 계속/종료는 `ax.cjs loop record`의 판정을 따릅니다. 검수 결과를 임의로 바꾸지 않습니다.
- 그래프의 `human` 노드는 사용자 응답 없이 통과하지 않습니다.

## 킷 파일과 프로젝트 파일
- 킷이 관리(업데이트 시 교체될 수 있음): `.ax/bin`, `.ax/presets`, `.ax/CLAUDE.md`, `.claude/skills/ax-*`, `.claude/agents/ax-*`
- 프로젝트 소유: 루트 `CLAUDE.md`·`README.md`, `.ax/project/`, 그 밖의 모든 코드. 프로젝트 고유 지침은 루트 `CLAUDE.md`에 씁니다.
- 킷 설명: `.ax/README.md`
