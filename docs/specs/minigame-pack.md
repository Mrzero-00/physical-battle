# 미니게임 팩 명세 (8종 · 사용자 사전 승인 · 2026-11-23)

사용자가 "추천대로 전부 만들고, 재미없는 건 숨기겠다"고 했다. 공용 기반(F0)은 이미 구현돼 있다: `src/games/visibility.ts`(HIDDEN_GAME_IDS), `src/core/labels.ts`(ScoreLabels·formatMs), `src/core/ranking.ts`(RANKED_GAME_IDS 10종·SCORE_RULES·checkScore·encodeScore(gameId)), `src/games/test-hook.ts`(exposeTest — mock 빌드 전용), `src/app/game-tabs.ts`(resolveGameId), 결과 화면 END_REASON(wrong, no-go-tap, off-timing, time-up, off-path, timeout).

## 공통 규칙 (모든 게임)
- 파일: `src/games/<id>/{index,scoring,scoring.test}.ts` + 스타일은 `src/games/<id>/style.css`(index.ts에서 `import './style.css'`). balance는 `physics.ts` 추가. 공용 파일(registry, styles.css, router 등)은 통합 단계에서만 바꾼다.
- `scoring.ts`: 순수 함수만, three·rapier·DOM import 없음, 무작위는 `rng: () => number` 인자. 난이도 함수에 정수가 아니거나 1 미만이 오면 1로 본다.
- `index.ts`: `GameModule`(id·title·description·labels?·create). 구조는 `src/games/vision/index.ts`를 따른다: 영역 div에 `touch-action:none`, 영역에 `pointerdown` 하나(`preventDefault`), 입력 시각은 `event.timeStamp`, 자극 시각은 rAF 콜백 ts. `'click'`·`Date.now()` 금지. 'ready' 단계 hint "화면을 탭하면 시작합니다", 탭하면 시작. 관계없는 단계 탭은 무시. 사람 한계 100ms 미만 탭은 무시. HUD는 `ctx.setStatus`. 끝나면 `ctx.onFinish({gameId, rounds, avgMs, bestMs, endReason})` 한 번. `start()`는 재시작 가능, `dispose()`는 rAF·타이머·리스너·(balance는 rapier world) 해제. `document.visibilityState === 'hidden'`이 되면 진행 중 판은 timeout으로 끝낸다.
- Three.js 쓰지 않음(DOM 또는 Canvas2D). 외부 에셋·폰트·사운드 없음. 의료·효능 문구 없음.
- 요약 `summarize*` → `{rounds, avgMs, bestMs, endReason}`, rounds 0이면 avg·best null. 기록 값은 `src/core/ranking.ts`의 `checkScore(gameId, …)`를 통과해야 한다(DEFAULT: rounds 1..999, avg 100..99999, best 100..avg / timing: avg 0..120, best 0..avg / tapspeed: rounds ≤248, avg 100..10000, best ≥40, 간격 일관성).
- 테스트 훅: `exposeTest(gameId, api)`로 E2E 봇이 정답을 읽을 수 있게 한다(mock 빌드에서만 동작). 운영 DOM에는 정답이 남지 않게 노출 단계가 끝나면 정답 텍스트·클래스·data 속성을 지운다.
- 주석 규칙: 코드 파일은 첫 줄 한 줄 타이틀 주석만.

## 1. gonogo · 선택 반응 · "초록이면 누르고 빨강이면 참으세요"
- go = 초록 원, no-go = 빨간 사각형 + ✕. 위치는 `../reaction/scoring`의 `randomPositionAwayFrom`·`isHit` 재사용(reaction 파일 수정 금지). 버튼 72px.
- 신호 사이 대기 `pickDelay(rng) = 500+round(700·rng)`.
- `limitMs(r) = max(350, 900−25(r−1))` (r1 900, r2 875, r23 350, r24 350)
- `redRatio(r) = r<3 ? 0 : min(0.45, 0.15+0.015(r−3))` (r3 0.15, r23 0.45, r30 0.45)
- `pickKind(r, rng, redStreak)`: r<3 또는 redStreak≥2면 go, `rng()<redRatio(r)`면 nogo, 아니면 go
- `noGoHoldMs(r) = limitMs(r)+150`: 빨강을 이 시간 동안 참으면 성공
- `judgeGoNoGo(kind, shownAt, tapAt, limit, hit)`: shownAt null 또는 hit false → ignore / nogo에 hit → no-go-tap / go에서 100ms 미만 → ignore, limit 초과 → timeout, 그 밖 → hit{ms}. go는 limit+30ms 타이머로 timeout.
- rounds = 성공 신호 수(go+nogo), avg·best = go 반응시간. 훅 `{phase, kind, rect}`.

## 2. timing · 타이밍 예측 · "공이 선을 지나는 순간 탭하세요"
- DOM 트랙, 공이 왼→오(transform), 세로선은 폭의 75% 지점. startAt = 첫 rAF ts, crossAt = startAt+travel. 위치는 시각으로 계산.
- `travelMs(r, rng) = round(max(450, 1600−80(r−1))·(0.9+0.2·clamp01(rng())))`
- `toleranceMs(r) = max(30, 120−6(r−1))` (r1 120, r16 30, r17 30)
- `occlusion(r) = r<6 ? 0 : min(0.5, 0.1(r−5))` (r5 0, r6 0.1, r10 0.5, r11 0.5): 선 직전 이 비율 구간은 공을 가린다.
- `judgeTiming(startAt, crossAt, tapAt, tol)`: tapAt−startAt<100 → ignore / |tapAt−crossAt| ≤ tol → hit{errMs} / 그 밖 → off-timing. crossAt+tol+30ms까지 탭 없으면 timeout.
- avg = 평균 절대 오차, best = 최소 오차(ms, 반올림). labels: avgLabel '평균 오차', bestLabel '최소 오차', compareAvg '평균 오차'. 훅 `{phase, crossAt}`.

## 3. flash · 순간 기억 · "잠깐 보인 숫자를 순서대로 누르세요"
- 숫자열 노출 → 지움 → 3×4 키패드(1-9, 0) 순서 입력.
- `digitCount(L) = min(10, 3+floor((L−1)/2))` (L1 3, L2 3, L3 4, L15 10, L20 10)
- `exposureMs(L) = max(300, 1200−75(L−1))` (L1 1200, L13 300, L14 300)
- `answerLimitMs(n) = 3000+1000n`
- `makeSequence(n, rng)`: 0~9, 같은 숫자 연속 없음
- `judgeDigit(seq, index, digit)` → correct | complete | wrong. 노출 중 키패드 비활성(탭 무시), 입력 시작 후 100ms 미만 탭 무시, 하나라도 틀리면 wrong 종료, 제한 초과 timeout.
- avg·best = 레벨별 입력 시간(입력 시작 → 마지막 정답). labels: avgLabel '평균 입력', bestLabel '최고 입력', roundsWord '레벨', roundsUnit 'L', roundsLabel '레벨 성공'. 훅 `{phase, sequence}`.

## 4. peripheral · 주변시야 · "가운데 글자와 가장자리 점의 방향을 맞히세요"
- 고정점 + 대기 `fixationDelay(rng) = 600+round(600·rng)` → 같은 rAF에서 가운데 글자(ㄱㄴㄷㄹㅁㅂ 중 하나)와 8방향 중 한 곳의 점(24px) 표시 → `ts−shownAt ≥ flashMs`인 첫 프레임에 숨기고 마스크 → 방향 8버튼 선택 → 글자 보기 4개(`letterChoices(answer, rng)`) 선택.
- `radiusRatio(L) = min(0.95, 0.35+0.05(L−1))` (L1 0.35, L13 0.95, L14 0.95)
- `flashMs(L) = max(80, 300−20(L−1))` (L1 300, L12 80, L13 80)
- `flashPosition(dir, ratio, viewport, size)`: dir 0 = 위, 시계 방향 45°씩. 결과는 영역 안.
- 둘 중 하나라도 틀리면 wrong. 입력 6000ms 제한(timeout). 답 화면 뜬 뒤 100ms 미만 탭 무시.
- avg = 답 화면 시작부터 두 번째 정답까지. labels: avgLabel '평균 응답', bestLabel '최고 응답', roundsWord '레벨', roundsUnit 'L', roundsLabel '레벨 성공'. 훅 `{phase, dir, letter}`.

## 5. tapspeed · 연타 속도 · "10초 동안 좌우를 번갈아 최대한 빨리 탭하세요"
- 한 판에 한 번 측정. rounds = 인정된 탭 수. 탭해서 시작 → 3-2-1 카운트다운(3000ms) → goAt부터 10000ms.
- 영역 중앙 기준 L/R. `acceptTap(state, {t, side})`: t−goAt < 100 또는 > 10000 → 버림 / 직전 인정 탭과 같은 쪽 → 버림 / 직전 인정 탭과 40ms 미만 → 버림 / 첫 탭은 어느 쪽이든 인정. 모든 pointerdown을 같은 규칙으로(멀티터치 포함).
- `summarizeTaps`: rounds = count, avgMs = ceil(lastAt−goAt), bestMs = ceil(최소 간격)(탭 1번이면 avg와 같음), endReason = time-up. rounds 0이면 null.
- labels: roundsWord '회', roundsUnit '회', roundsLabel '회 연타', avgLabel '마지막 탭', bestLabel '최소 간격', compareAvg '마지막 탭', shareAvg false. 남은 시간은 HUD. 훅 `{phase, goAt}`.

## 6. stroop · 색-단어 간섭 · "글자 뜻이 아니라 글자 색을 고르세요"
- 색: 빨강 #e5484d, 파랑 #3b82f6, 초록 #22c55e, 노랑 #eab308. 버튼 4개(중립 배경, 흰 글자 색 이름).
- `limitMs(r) = max(600, 2000−70(r−1))` (r1 2000, r21 600, r22 600)
- `congruentRatio(r) = max(0.1, 0.5−0.05(r−1))` (r1 0.5, r9 0.1, r10 0.1)
- `shuffleButtons(r) = r≥10`, `makeTrial(r, rng)` → {word, ink}
- `judgeStroop(trial, shownAt, tapAt, limit, picked)` → ignore(100ms 미만 또는 picked null) | hit{ms} | wrong | timeout. 라운드 사이 빈 화면 300ms. 잉크 색은 style에만(data 속성 노출 금지).
- labels: avgLabel '평균 판단', bestLabel '최고 판단'. 훅 `{phase, ink}`.

## 7. mot · 다중 물체 추적 · "표시된 공을 끝까지 따라가 고르세요"
- 표시 1500ms(목표 공 강조) → 같은 모양으로 trackMs 이동 → 정지 후 K개 탭. Canvas2D 하나, 공 반지름 22px, 터치 반경 28px.
- `ballCount(L) = min(12, 6+floor((L−1)/2))` (L1 6, L13 12, L14 12)
- `targetCount(L) = min(5, 2+floor((L−1)/3))` (L1 2, L4 3, L10 5, L11 5)
- `speedPx(L, scale) = min(320, 120+15(L−1))·scale` (scale = min(w,h)/390; L1 120, L14 315, L15 320)
- `trackMs(L) = min(8000, 4000+300(L−1))` (L1 4000, L14 7900, L15 8000)
- `placeBalls(n, bounds, r, rng)`(겹치지 않게), `stepBalls(balls, dtMs, bounds)`(벽 반사 + 같은 질량 탄성 충돌, dt ≤ 50ms로 자름), `hitBall(point, balls, hitR)` → index | −1
- `judgePick(targets, picked, i)` → ignore(이미 고른 공·빈 곳) | correct | complete | wrong. 비목표 공이면 wrong, 답 제한 10000ms(timeout), 답 단계 시작 후 100ms 미만 무시.
- avg = 답 단계 시작부터 K번째 정답까지. labels: roundsWord '레벨', roundsUnit 'L', roundsLabel '레벨 성공', avgLabel '평균 선택', bestLabel '최고 선택'. 훅 `{phase, targets, balls}`(CSS 좌표).

## 8. balance · 균형 · "폰을 기울여 공을 골까지 굴리세요"
- `@dimforge/rapier2d-compat`(dependencies 추가). `physics.ts`에서만 `await import('@dimforge/rapier2d-compat')` → `init()`. 'ready' 탭 뒤 "물리 엔진 불러오는 중…", 실패하면 "불러오지 못했어요 · 다시 시도". 별도 청크.
- 1m = 50px, 고정 스텝 1/60(accumulator), 공 dynamic ball 반지름 12px·linearDamping 0.5, 매 프레임 `world.gravity = g·12m/s²`, 장애물은 원형 static collider.
- `segmentCount(L) = min(8, 3+floor((L−1)/2))`, `halfWidthPx(L) = max(18, 48−3(L−1))·scale` (L1 48, L11 18, L12 18), `obstacleCount(L) = min(4, max(0, L−3))` (L3 0, L4 1, L7 4), `LEVEL_LIMIT_MS = 60000`
- `makePath(L, viewport, rng)`(위→아래 지그재그 꺾은선), `distanceToPath(p, path)`, `isOnPath(p, path, hw)`(거리 ≤ hw), `reachedGoal(p, path, hw)`(마지막 꼭짓점에서 hw 이내)
- 입력: `tiltToGravity(beta, gamma, base, screenAngle)`(±30°에서 ±1로 자름, 레벨 시작 자세 기준), `dragToGravity(dx, dy)`(80px에서 ±1), `autopilotGravity(ball, path)`(mock 훅 전용). iOS(`DeviceOrientationEvent.requestPermission` 존재): 'ready'에 "기울기 사용" 버튼, 그 클릭 안에서 권한 요청, granted면 기울기·아니면 드래그. 그 밖: 1000ms 안에 beta가 null이 아닌 이벤트가 없으면 드래그. HUD에 모드 표시. (권한 버튼은 예외적으로 element의 click 리스너 허용 — 사용자 제스처 요구 때문)
- 길 이탈 off-path, 골 도달 = 레벨 성공, 60초 초과 timeout. avg·best = 레벨 클리어 시간(DEFAULT 규칙). labels: roundsWord '레벨', roundsUnit 'L', roundsLabel '레벨 성공', avgLabel '평균 클리어', bestLabel '최고 클리어'. Canvas2D. 훅 `{phase, level, autopilot(on)}`.

## 수용 기준
- AC-1 `npm run typecheck`, `npm test`, `npm run build`, `npm run build:mock`, `npm run build:toss` 종료 코드 0
- AC-2 게임 8종 `scoring.test.ts`: 위 난이도 함수 경계값이 표의 값과 같음, 판정 ignore 경계(99/100ms, tol±1, 40ms 간격, 같은 쪽 탭, 이미 고른 공), rounds 0 → null, 그리고 gonogo redStreak 2면 go, timing occlusion 경계, flash 연속 같은 숫자 없음, peripheral 8방향 좌표가 영역 안, tapspeed ceil·1탭 best=avg, stroop r10 섞기, mot 벽 반사·겹치지 않는 배치, balance isOnPath hw 경계·tilt 클램프·autopilot 방향
- AC-3 ranking/records/service/share/labels/visibility/game-tabs/registry 테스트(F0) 통과, allGames id가 모두 RANKED_GAME_IDS에 있음
- AC-4 `src/games/reaction/` 변경 없음, reaction 결과·공유 문구 그대로
- AC-5 `src/games/*/scoring.ts`에 three·rapier·document 없음, rapier는 `src/games/balance/physics.ts`에서만 동적 import, `__pbTest`가 dist·dist-toss에 없고 dist-mock에는 있음, 새·수정 코드 파일은 첫 줄 타이틀 주석만
- AC-6 웹 빌드 첫 진입 JS gzip ≤ 200KB, rapier 청크는 별도(실측 크기 보고)
- AC-7 E2E mock(390x844): 게임마다 `__pbTest`로 정답을 읽고 실제 포인터 입력으로 2라운드 이상(tapspeed는 rounds>0, balance는 autopilot 2레벨), 일부러 틀리거나 시간 초과로 결과 화면과 END_REASON 문구, 내 기록 탭 선택·최근 1행 이상, 결과 화면 `.rank-row-toss`는 reaction에만, 가로 스크롤 없음
- AC-8 운영(web) 빌드 mot 답 단계·flash 입력 단계·peripheral 답 단계 DOM에 정답 정보 없음
- AC-9 `HIDDEN_GAME_IDS=['stroop']`로 바꾸면 홈 카드와 탭에서 stroop이 사라짐(확인 후 되돌림)
- AC-10 mock 빌드에서 게임 시작마다 코인 1 감소

## 확인 필요
- rapier2d-compat 실제 청크 크기, 토스 .ait 용량, 토스 웹뷰의 DeviceOrientation, 기울기·드래그를 같은 랭킹에 둘지(기본: 같은 랭킹), timing의 표시 지연(약 1프레임), 가로 화면에서 tilt 축
