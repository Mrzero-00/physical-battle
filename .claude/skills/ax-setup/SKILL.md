---
name: ax-setup
description: AX AI 엔지니어링 킷 초기 세팅 인터뷰. "어떤 서비스를 만드실건가요?"부터 시작해 서비스 유형별 추천을 보여주고 프로젝트 변수·프롬프트·컨텍스트·하네스·루프(검수 서브에이전트, 성공·종료 기준)·그래프를 한 단계씩 확정한다. 세팅이 안 된 프로젝트의 첫 세션, 또는 사용자가 AI 세팅 변경을 원할 때 사용.
argument-hint: "[profile|prompt|context|harness|loop|graph]"
---

# AX 킷 세팅 인터뷰

목표: 사용자가 **한 번에 하나씩** 결정하도록 돕고, 결정할 때마다 바로 저장해서 중간에 멈춰도 이어갈 수 있게 합니다.
모든 저장은 `node .ax/bin/ax.cjs set <layer>`로만 합니다. 이 CLI가 형식을 검증하므로 JSON 파일을 직접 편집하지 않습니다.

## 진행 규칙
- 시작 전에 `node .ax/bin/ax.cjs status`를 실행합니다. `$ARGUMENTS`에 단계가 있으면 그 단계만, 없으면 `next` 단계부터 진행합니다.
- 질문은 AskUserQuestion으로 합니다. 추천안을 첫 선택지에 "(추천)"으로 두고, 사용자가 "Other"로 직접 쓸 수 있게 합니다.
- 각 단계마다 `node .ax/bin/ax.cjs recommend <serviceType> <layer>`로 추천값을 받아 **왜 이 서비스에 맞는지 한두 줄**로 설명합니다. 추천값 전체를 길게 붙여 넣지 않습니다.
- 사용자가 고른 값으로 JSON을 만들어 아래처럼 저장합니다. 검증 오류가 나면 오류 내용을 보고 고친 뒤 다시 저장합니다.
  ```bash
  node .ax/bin/ax.cjs set loop <<'JSON'
  { ... }
  JSON
  ```
- 단계가 끝날 때마다 "저장됨 · 다음: …" 한 줄만 말하고 다음 질문으로 넘어갑니다.
- 사용자가 "나중에", "기본값으로" 등을 말하면 추천값을 그대로 저장하고 넘어갑니다.

## 0단계 · init (클론 직후 한 번)
`status` 결과가 `initialized: false`이고 세팅한 단계가 없으면, 이 폴더가 킷 원본을 막 클론한 상태입니다.
1. AskUserQuestion으로 묻습니다: "이 폴더를 새 프로젝트로 시작할까요?"
   - 선택지: "새 프로젝트로 시작 (추천)" / "킷 자체를 수정하려는 것" 
   - 킷 수정이면 세팅을 멈추고 그 작업을 돕습니다.
2. 시작이면 `node .ax/bin/ax.cjs init`을 실행하고, 결과의 `done` 항목을 짧게 알려줍니다.
   (원격 origin → ax로 이름 변경, README 교체, 킷 개발용 테스트 제거, `.ax/kit.lock.json` 기록)
3. 새 프로젝트 저장소 주소가 있으면 `git remote add origin <주소>`로 연결할지 묻습니다. 없으면 나중에 해도 된다고 안내합니다.

## L0 · 서비스와 프로젝트 변수 (profile)
1. 가장 먼저 묻습니다: **"어떤 서비스를 만드실건가요?"**
   선택지는 `node .ax/bin/ax.cjs presets`의 항목 중 대표 3개 + 나머지는 Other로 받습니다. 사용자가 자유롭게 설명하면 가장 가까운 `serviceType`을 제안해 확인받고, 맞는 게 없으면 `custom`을 씁니다.
2. 이어서 한 번에 묻습니다 (자유 입력): 서비스 이름, 한 줄 요약, 주요 사용자. 스택·플랫폼은 추천 힌트를 선택지로 보여줍니다.
   제약·용어집은 선택 사항이라고 알려주고, 비워도 된다고 말합니다.
3. 저장: `{serviceType, name, summary, platform, stack, users, constraints, glossary}` → `set profile` (README의 서비스 소개가 이 값으로 자동 갱신됩니다)

## L1 · 프롬프트 엔지니어링 (prompt)
1. 추천 역할·문체·출력 형식을 보여주고 "이대로 / 수정" 중 고르게 합니다.
2. 추천 기법(`techniques`)을 multiSelect로 묻습니다. 각 선택지 설명에는 `techniqueNotes`의 한 줄 설명을 씁니다.
3. 가드레일: 추천 목록을 보여주고 추가할 것이 있는지 묻습니다. 사용자가 쓴 문장은 그대로 `guardrails`에 추가합니다.
4. 저장: `{role, style, techniques, outputFormat, guardrails, extra}` → `set prompt`

## L2 · 컨텍스트 엔지니어링 (context)
1. 추천 `include`(먼저 읽을 자료)와 `exclude`를 보여줍니다. 실제 저장소에 있는 경로인지 Glob으로 확인하고, 없는 것은 "아직 없음"이라고 표시합니다.
2. 사용자가 꼭 읽혀야 할 문서(기획서·디자인 가이드 등)가 있는지 묻습니다.
3. 저장: `{include, exclude, maxFileChars, strategy}` → `set context`

## L3 · 하네스 엔지니어링 (harness)
1. `package.json`·`pyproject.toml` 등을 읽어 **실제로 존재하는 검사 명령**을 찾고, 추천 검사와 맞춰 봅니다. 없는 명령은 추천하지 말고 "아직 없음 — 나중에 추가"로 안내합니다.
2. 검사별로 필수 여부(required)를 묻습니다 (multiSelect: 필수로 할 검사).
3. 프로젝트 규칙: 추천 규칙을 보여주고 추가·삭제를 받습니다.
4. 저장: `{checks:[{id,title,command,required}], rules}` → `set harness`

## L4 · 루프 엔지니어링 (loop)
루프 구조를 먼저 한 줄로 설명합니다: **구현(메인) → 검수(`ax-verifier` 서브에이전트, 별도 시선) → 미충족이면 수정 후 재검수 → 성공 또는 종료 기준에서 멈춤.**
1. **성공 기준** — "언제 끝났다고 볼까요?"
   추천 성공 기준을 multiSelect로 보여줍니다(추천은 모두 기본 선택이라고 안내). 사용자는 Other로 직접 기준을 쓸 수 있습니다.
   직접 쓴 기준은 검수 에이전트가 **파일이나 명령으로 확인 가능한 문장**인지 확인하고, 모호하면 고쳐 쓰기를 제안합니다.
   하네스 검사와 연결되는 기준은 `check`에 검사 id를 넣습니다.
2. **종료 기준** — "성공하지 못해도 언제 멈출까요?"
   - 최대 반복 횟수: 추천값과 1·3·5 중에서 고르게 합니다.
   - 같은 실패 반복 허용 횟수(`repeatFailureLimit`, 기본 2).
   - 추가 종료 기준: 추천(사용자 결정 필요, 범위 이탈)을 multiSelect로 보여주고 Other로 직접 쓰게 합니다.
   - 멈췄을 때: 사용자에게 묻기(`ask-user`, 추천) / 그냥 중단(`stop`).
3. **검수 서브에이전트** — 기본 `ax-verifier` 사용(추천). 검수 중점(`focus`)을 추천에서 고르거나 직접 씁니다.
   검수를 끄겠다고 하면 "같은 에이전트가 자기 결과를 검수하게 되어 루프 품질이 떨어진다"는 점을 한 번 알리고 따릅니다.
4. 저장: `{verifier:{enabled,agent,focus}, successCriteria:[{id,text,check?}], stopCriteria:{maxIterations,repeatFailureLimit,custom:[{id,text}]}, onStop}` → `set loop`

## L5 · 그래프 엔지니어링 (graph)
1. 추천 템플릿을 Mermaid로 보여줍니다(추천 JSON의 nodes·edges를 직접 Mermaid로 그림). 템플릿은 `standard`(명세→승인→구현 루프→검사→리뷰), `explore`(조사→선택→프로토타입), `data`(계약→샘플 루프→전체 실행 승인) 중 고르게 합니다.
2. **사람 승인 지점**을 묻습니다 (multiSelect: 명세 승인, 최종 리뷰 등). 승인 노드를 빼면 그 앞뒤 노드를 직접 잇습니다.
3. 노드별 담당을 확인합니다: `agent` 노드는 `ax-planner`·`ax-context-scout`·`main` 중 하나, `loop` 노드는 L4 설정으로 실행, `check` 노드는 L3 검사 실행.
4. 사용자가 노드를 추가하고 싶다면 `{id,kind,title,agent?}`로 받아 넣습니다. 순환은 반드시 `human` 노드를 거쳐야 합니다(CLI가 검사).
5. 저장: `{title, template, nodes, edges}` → `set graph`, 이어서 `node .ax/bin/ax.cjs graph mermaid`로 최종 그림을 보여줍니다.

## 마무리
1. `node .ax/bin/ax.cjs validate` 결과가 `ok: true`인지 확인합니다.
2. `node .ax/bin/ax.cjs render --open`으로 전체 엔지니어링 맵(`.ax/engineering.html`)을 열어 보여줍니다. 이후 설정이 바뀔 때마다 자동 갱신된다고 안내합니다.
3. 6줄 이내로 요약합니다: 서비스 · 프롬프트 핵심 · 하네스 검사 · 성공/종료 기준 · 그래프.
4. 이제 작업은 `/ax-run <요구사항>`으로 그래프를 따라 진행하고, 단일 구현은 `/ax-loop <작업>`으로 검수 루프를 돌릴 수 있다고 안내합니다.
5. `.ax/project/`를 커밋할지 묻습니다. 사용자가 원할 때만 커밋합니다.
