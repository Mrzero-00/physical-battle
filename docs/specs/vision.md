# 동체시력 게임 명세 (사용자 사전 승인 · 2026-11-23)

## 목표
홈의 "동체시력 · 준비 중" 카드를 플레이 가능한 `GameModule`(id `'vision'`)로 바꾼다. 매 라운드 숫자가 적힌 공이 화면을 빠르게 가로지르고, 공이 사라지면 4지선다에서 숫자를 고른다. 끝없는 라운드, 갈수록 빨라지고 작아지며 2자리 수와 여러 경로가 더해진다. 한 번 틀리면 게임 오버. 근거: 동체시력은 움직이는 대상의 작은 세부를 알아보는 능력이고, 빠른 공의 숫자 읽기·턴테이블 글자 읽기가 현장 연습법이다. UI에 의학·훈련 효과를 주장하지 않는다.

## 범위
- 포함: `src/games/vision/{index,scoring,scoring.test,stage}.ts`, `registry.ts`, `src/core/{ranking,share,leaderboard}.ts`와 테스트, `api/_lib/service.test.ts`, `src/app/{router,home,records,global-ranking,result}.ts`, `src/app/game-tabs.ts`, `src/platform/mock.ts`, `src/styles.css`
- 제외: Rapier(직선 등속 운동, 번들 예산), 스킨, 토스 리더보드 추가, 반응속도 규칙·측정 변경, 기록·랭킹 키 버전 변경, 3자리 수

## 동작
- 공은 DOM `.vision-ball`(원형·굵은 숫자·고대비), `transform: translate3d`만 변경, 위치는 rAF 타임스탬프 기준 `pointAt(path, ts − flightStart, exposure)`. Three.js는 배경 톤만
- 정답 누출 방지: 공 텍스트는 비행 시작 rAF에서만 채우고 화면을 벗어나는 프레임에서 비움. 대기·비행 중 `.vision-choice` 없음. 숨은 정답 속성 없음
- 흐름: 준비 → 탭 → 대기 500~1000ms → 비행 → 공이 나가는 프레임에 2×2 선택지(`choiceShownAt`) → 탭. 정답이면 다음 라운드, 오답·시간 초과면 정답 표시 후 종료
- 무시: 대기·비행 중 탭, 선택지 밖 탭, 선택지 표시 후 100ms 미만 탭
- 답 제한 `ANSWER_LIMIT_MS = 5000`(넘기면 timeout 종료). 판단 시간 = `pointerdown` `event.timeStamp` − `choiceShownAt`
- HUD `라운드 n · 노출 Ems · 직전 xms`. reduced-motion이면 CSS transition/animation 없음(비행은 측정 대상이라 유지)

## 순수 함수 (`src/games/vision/scoring.ts`)
- `exposureFor(n) = max(250, round(1200×0.9^(n−1)))` (비정수·1 미만은 1)
- `fontSizeFor(n) = max(14, 56 − 3(n−1))`, `ballSizeFor(n) = max(36, round(fontSizeFor×1.5))`
- `digitsFor(n)`: 1~5 → 1(1~9), 6~ → 2(10~99)
- `pathKindsFor(n)`: 1~3 ltr, 4~7 ltr·rtl, 8~ ltr·rtl·diag-down·diag-up / `pathFor(n, rng, area, size)` / `pointAt(path, elapsed, duration)` 선형 보간(0..1 고정)
- `answerFor(n, rng, prev)`(prev와 다름), `makeChoices(answer, digits, rng)`(비슷한 숫자 맵 기반, 항상 4개·서로 다름·정답 포함·같은 자릿수·Fisher–Yates)
- `judge(choice, answer, decisionMs, limitMs)` → ignore | timeout | wrong | {correct, ms}
- `summarizeRun(results)`: ignore 건너뜀, rounds = correct 수, avg/best = 판단 시간, endReason wrong|timeout|none
- 기록 avgMs·bestMs = 맞힌 라운드의 판단 시간(100~5000), 기존 검증·정렬 그대로

## 공통 변경
- `RANKED_GAME_IDS = ['reaction','vision']`, `usesTossLeaderboard(gameId)`(reaction만), `shareText(gameTitle, rounds, avgMs, url?)`, 결과 `END_REASON.wrong='오답'`·vision 통계 라벨 "평균 판단"/"최고 판단"
- `game-tabs.ts`(tablist), `showRecords(gameId)`·`showRanking(gameId)`, 닉네임 변경 시 모든 게임의 제출 표시 초기화, 홈 동체시력 카드 플레이 가능

## 수용 기준
- AC-1 typecheck·test·build·build:mock·build:toss 종료 코드 0
- AC-2 `vision/scoring.ts` three import 없음·함수 export, `vision/index.ts` GameModule(id 'vision', title '동체시력')이 registry.games에 있음
- AC-3 경계값: exposureFor 1→1200, 2→1080, 6→709, 15→275, 16→250, 100→250, 0·1.5→1200 · fontSizeFor 1→56, 14→17, 15→14 · ballSizeFor 1→84, 15→36 · digitsFor 5→1, 6→2 · pathKindsFor 3·4·7·8 · pointAt
- AC-4 makeChoices: 여러 rng와 answer 1·8·9·10·11·47·99에서 4개·서로 다름·정답 포함·같은 범위·결정적, answer 8(1자리) 후보에 0 없음, answerFor prev 회피·범위
- AC-5 judge: null·99·NaN → ignore, 100 정답 → correct 100, 5000 → correct, 5001 → timeout, 오답 → wrong · summarizeRun [c,c,ignore,c,wrong] → 3·wrong, [ignore] → 0·null·none
- AC-6 validateSubmission이 'vision' 허용·'dynamic-vision' 거부, service: vision POST가 `pb:rank:v2:vision`에 기록·reaction total 불변
- AC-7 records: vision이 reaction에 영향 없음, share: 게임 제목·라운드·평균·URL, leaderboard: usesTossLeaderboard reaction true·vision false
- AC-8 `data-answer`·`dataset.answer` 없음, vision에 pointerdown·timeStamp·rAF 있고 'click'·Date.now()·@dimforge 없음, package.json에 rapier 없음
- AC-9 `src/games/reaction/` 변경 없음, 첫 줄 타이틀 주석만
- AC-10 dist JS gzip 200KB 이하, reduced-motion 블록에 vision transition/animation none
- AC-11 E2E 웹(390x844): 홈 → vision → 대기 중 공 텍스트 비어 있고 선택지 0 → 비행 중 숫자 읽기 → 선택지 4개 중 정답 → 3라운드 이상 → 오답 → 결과 "오답" → 내 기록 동체시력 탭 선택·최근 1행 이상·`pb:records:v3:vision` → 전체 랭킹 동체시력 요청 gameId=vision → 반응속도도 정상, 가로 스크롤 없음
- AC-12 E2E 목업: vision 결과에 `.rank-row-toss` 없음·`.rank-row-global` "N위", reaction은 토스 행 유지, 가짜 랭킹 게임별 저장
