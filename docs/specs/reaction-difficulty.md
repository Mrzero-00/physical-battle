# 반응속도 난이도 강화 명세 (승인됨 · 2026-11-23)

## 목표
제한 시간이 더 빨리 줄어들고, 5라운드부터 한 라운드 안에서 버튼이 연달아 나온다. 측정 방식, 기록 단위(버틴 라운드 수), 부정 기록 거르기는 그대로 둔다.

## 결정 사항
- 제한 시간: `L(1)=1000`, `L(n+1)=max(100, L(n) − max(50, Math.round(L(n)×0.1)))` → 1000, 900, 810, 729, 656, 590, 531, 478, 428, 378, 328, 278, 228, 178, 128, 16라운드부터 100
- 라운드당 버튼 수: 1~4라운드 1개, 5~7라운드 2개, 8~10라운드 3개, 11라운드부터 4개(최대)
- 첫 버튼은 600~1800ms 무작위 대기 뒤, 다음 버튼은 앞 버튼을 맞히는 즉시 다음 rAF에 새 위치로 표시
- 연속 버튼 중심 간격 108px 이상(8번 시도 후 실패하면 앞 버튼에서 가장 먼 꼭짓점)
- 버튼마다 그 버튼의 rAF 표시 시각부터 제한 시간을 따로 잰다. 연속 버튼 사이(다음 버튼 표시 전)의 탭은 부정출발
- 라운드는 버튼을 모두 맞혀야 통과. rounds는 통과한 라운드 수, avgMs·bestMs는 성공한 탭 전부
- HUD: `라운드 n · 제한 Lms · 직전 xms`, 연속 구간이면 ` · k/m`
- 기존 기록 초기화: 기록 저장 키를 `pb:records:v2:<gameId>`로 바꾼다(예전 키는 읽지 않음)

## 범위
- 변경: `src/games/reaction/{scoring,scoring.test,index}.ts`, `docs/specs/reaction.md`, `src/core/records.ts`·`records.test.ts`(저장 키만)
- 변경 금지: `src/core/{coins,ads,leaderboard}.ts`와 테스트, `src/platform/`, `stage.ts`
- 허용: 옛 공식을 담은 기존 테스트 기대값(`timeLimitFor` 2→950, 22→341, 45→105, 46→100)과 `summarizeRun` 기대값 교체

## 수용 기준
- AC-1 `npm run typecheck`, `npm test`, `npm run build` 종료 코드 0
- AC-2 `timeLimitFor`: 1→1000, 2→900, 4→729, 5→656, 7→531, 8→478, 10→378, 11→328, 15→128, 16→100, 17→100, 100→100, 1~199에서 늘지 않음
- AC-3 `nextLimit`: 1000→900, 729→656, 478→428, 314→264, 130→100, 128→100, 100→100
- AC-4 `burstSizeFor`: 1→1, 4→1, 5→2, 7→2, 8→3, 10→3, 11→4, 15→4, 16→4, 17→4, 100→4
- AC-5 `randomPositionAwayFrom`(390x844): rng 0·0.5·0.999에서 앞 버튼과 같은 후보만 나오면 영역 안 꼭짓점으로 108px 이상, prev null이면 `randomPosition`과 같음, prev가 멀면 첫 후보
- AC-6 `advance`: (4,0)+hit→next-round(5,0), (5,0)+hit→next-button(5,1), (5,1)+hit→next-round(6,0), (11,3)+hit→next-round(12,0), 실패는 over, hit만 이어 가면 5라운드에서 처음 next-button
- AC-7 `burstLabel`: (4,0)→'', (5,0)→'1/2', (5,1)→'2/2', (11,2)→'3/4'
- AC-8 `summarizeRun`: 성공 0회→rounds 0·ms null, 성공 5회 뒤 timeout→rounds 4(avg·best는 5회 전부), 성공 6회 뒤 miss→rounds 5, 성공 4회 뒤 false-start→rounds 4
- AC-9 `index.ts`는 맞힌 뒤 `advance`를 따른다. next-button이면 `pickDelay`·지연 setTimeout 없이 바로 rAF로 표시하고 `randomPositionAwayFrom`에 앞 버튼 위치를 넘긴다. `shownAt`과 무응답 타이머는 버튼마다 새로
- AC-10 `src/games/reaction/`에 `pointerdown`·`timeStamp` 사용, `'click'`·`Date.now()` 없음, 72px DOM 버튼과 Three.js 배경 유지
- AC-11 headless Chrome 390x844에서 홈 → 반응속도 → 여러 라운드 → 게임 오버 → 결과 → 홈, 잘림·가로 스크롤 없음, 5라운드 도달 시 HUD `1/2`
- AC-12 `docs/specs/reaction.md` 규칙 표·순수 함수·AC-5가 새 규칙으로 바뀌고 `0.95^`가 없음
- AC-13 바뀐 `src/**/*.ts`는 첫 줄 타이틀 주석 외 주석 없음
- AC-14 `src/core/{coins,ads,leaderboard}.ts`, `src/platform/`과 그 테스트는 바뀌지 않음
- 추가(기록 초기화): `recordsKey('reaction') === 'pb:records:v2:reaction'`이고 예전 키의 기록은 읽지 않음(테스트)
