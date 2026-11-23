---
name: ax-loop
description: AX 루프 엔지니어링 실행. 하나의 구현 작업을 "구현 → ax-verifier 독립 검수 → 수정" 반복으로 진행하고, 계속/종료 판정은 .ax/bin/ax.cjs가 성공·종료 기준으로 결정한다. 그래프의 loop 노드나 단일 구현 요청에 사용.
argument-hint: "<작업 설명>"
---

# AX 검수 루프

작업: $ARGUMENTS

## 0. 준비
- `node .ax/bin/ax.cjs status`가 루프(L4) 미설정이면 멈추고 `/ax-setup loop`를 먼저 진행하자고 안내합니다.
- `node .ax/bin/ax.cjs loop start "<작업 한 줄 요약>"` → `runId`, 성공 기준, 종료 기준을 받습니다. 사용자에게 성공 기준을 한 줄로 보여줍니다.
- `.ax/project/prompt.json`의 역할·기법·출력 형식·가드레일, `.ax/project/harness.json`의 규칙을 구현 지침으로 씁니다.
- 관련 코드가 여러 곳이면 `ax-context-scout`에게 맡겨 결론만 받습니다.

## 1. 구현 (메인 에이전트)
- 기준을 충족하도록 변경합니다. 두 번째 반복부터는 직전 판정의 `fix` 목록**만** 고칩니다. 범위를 넓히지 않습니다.
- 끝나면 변경 파일 목록을 정리합니다. 스스로 "완료"라고 판단하지 않습니다. 판단은 검수자가 합니다.

## 2. 검수 (`ax-verifier` 서브에이전트)
- Agent 도구로 `ax-verifier`를 호출합니다. 전달할 것: 작업 설명, 명세·수용 기준(있으면), 변경 파일 목록, runId.
- **전달하지 말 것**: 구현자의 자기 평가·"다 됐다" 같은 결론. 검수자가 독립적으로 판단하게 합니다.
- 검수자가 돌려준 마지막 JSON 블록을 그대로 기록합니다:
  ```bash
  node .ax/bin/ax.cjs loop record <runId> <<'JSON'
  { "criteria": [...], "stop": [...], "failures": [...], "needsUser": false }
  JSON
  ```

## 3. 판정 (CLI 결과를 그대로 따름)
- `CONTINUE` → `fix` 목록을 1단계로 가져가 다시 구현합니다.
- `DONE` → 반복 횟수, 충족 근거 요약, 변경 파일을 보고합니다.
- `STOP` → 이유를 그대로 전합니다. `ask: true`면 AskUserQuestion으로 다음 행동을 묻습니다 (기준 조정 / 반복 추가 허용 / 범위 축소 / 여기서 중단).
  사용자 허락 없이 반복을 더 돌리지 않습니다.

## 규칙
- 검수 결과를 바꾸거나 일부만 기록하지 않습니다. CLI가 성공 기준 누락을 거부하면 검수자에게 빠진 기준 판정을 다시 요청합니다.
- 실행 기록은 `.ax/runs/<runId>.json`에 남습니다(커밋 대상 아님).
