# 빗나간 탭 허용 명세 (승인됨 · 2026-11-23)

## 목표
반응속도 게임 오버 조건을 시간 초과 하나로 줄인다. 버튼 밖 탭, 버튼 표시 전 탭(대기·연속 버튼 사이·안내 중), 100ms 미만 탭은 화면 반응도 벌칙도 없이 무시한다. 이전 결과와 비교할 수 없으므로 로컬 기록·전체 랭킹·제출 표시 키 버전을 올려 초기화한다(데이터 이전 없음).

## 범위
- 포함: `src/games/reaction/{scoring,scoring.test,index}.ts`, `src/core/{records,records.test}.ts`, `api/_lib/{service,service.test}.ts`, `src/app/global-status.ts`, `docs/specs/reaction.md`
- 제외: 난이도 곡선, 연속 버튼, 안내, 스킨, 코인, 측정 방식, 72px 영역, 결과 화면 `END_REASON` 문구, 토스 게임센터 리더보드 초기화

## 동작
- `Judgement` = hit | timeout | ignore. `EndReason`은 `'timeout'|'miss'|'false-start'|'none'` 리터럴로 직접 선언(실제 값은 timeout·none)
- `judgeTap`: shownAt null → ignore, 버튼 밖 → ignore, 100ms 미만·비유한수 → ignore, limit 초과 → timeout, 그 밖 → hit
- `advance(progress, ignore)` → `{kind:'stay', round, index}`, timeout → over, hit은 기존과 같음
- `summarizeRun`은 ignore를 건너뛰고 timeout에서만 끝남
- `index.ts` `measure()`: ignore면 상태·타이머·results·hint·버튼 그대로 두고 return. `END_HINT`에서 miss·false-start 제거
- 키: `pb:records:v3:<gameId>`, `pb:rank:v2:<gameId>`(+`:meta`), `pb:rank:submitted:v2:<gameId>`(`submittedKey` export). 예전 키는 읽지도 지우지도 않음

## 수용 기준
- AC-1 `npm run typecheck`, `npm test`, `npm run build`, `npm run build:mock`, `npm run build:toss` 종료 코드 0
- AC-2 `judgeTap`: (null,500,1000,false)·(null,500,1000,true) → ignore, (1000,1300,1000,false) → ignore, 99ms → ignore, 100ms → hit 100, limit → hit, limit+1 → timeout
- AC-3 `advance`: ignore → stay(그대로), timeout → over, hit은 기존과 같음. 예전 miss·false-start 케이스는 지우거나 바꿈(허용)
- AC-4 `summarizeRun`: [hit×3, ignore, hit, timeout]은 ignore를 뺀 결과와 같고 endReason timeout, [ignore, ignore] → rounds 0·null·'none'
- AC-5 `recordsKey('reaction')==='pb:records:v3:reaction'`, v2 데이터는 읽히지 않음
- AC-6 `service.test.ts`: v1 랭킹 데이터가 있어도 GET total 0·me null, POST 뒤 `pb:rank:v2:reaction`과 `:meta`에 기록
- AC-7 제출 표시 키가 `pb:rank:submitted:v2:<gameId>`
- AC-8 `grep -n "false-start\|'miss'" src/games/reaction/scoring.ts src/games/reaction/index.ts`가 `EndReason` 선언 외에 없음
- AC-9 E2E(390x844 웹 빌드): 대기 중 빈 곳 탭·버튼이 떠 있을 때 버튼 밖 탭으로 끝나지 않음, 탭하지 않으면 시간 초과로 끝나고 "시간 초과" 표시, 1라운드 이상 통과 후 `pb:records:v3:reaction` 생성·v2 키에는 쓰지 않음
- AC-10 `docs/specs/reaction.md` 게임 오버 행 "시간 초과만"·무시 규칙 행 추가·기록 키 v3·`judgeTap` 반환형·AC-5 문구 갱신
- AC-11 바뀐 `.ts`는 첫 줄 타이틀 주석만
