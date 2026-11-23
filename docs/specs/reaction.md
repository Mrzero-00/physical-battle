# 반응속도 테스트 명세 (승인됨 · 2026-11-23)

## 목표
Vite + TypeScript + Vitest 골격과 첫 피지컬 테스트인 반응속도 테스트를 만든다. 화면 무작위 위치에 버튼이 나타나면 제한 시간 안에 탭한다. 라운드는 끝없이 이어지고 제한 시간은 점점 짧아진다. 기록은 버틴 라운드 수이며 기기(localStorage)에 저장한다.

## 범위
- 포함: 프로젝트 설정, 홈 화면, 공통 게임 인터페이스, `src/games/reaction/`, 순수 판정 함수와 단위 테스트, 기록 저장소, 플랫폼 어댑터(웹 기본 구현)
- 제외: 서버, 온라인 대전, 랭킹 API, 앱인토스 SDK 실제 연동, Rapier(다음 게임에서 도입)
- 홈: "반응속도"만 플레이 가능, "동체시력 · 준비 중"은 비활성 카드

## 규칙
| 항목 | 값 |
|---|---|
| 버튼 표시 전 대기 | 600~1800ms 무작위 |
| 제한 시간 | `max(100, round(1000 × 0.95^(n-1)))` — 1라운드 1000ms, 46라운드부터 100ms |
| 버튼 | 72px 고정, DOM 요소 |
| 배치 영역 | 가장자리 16px + safe-area, 상단 HUD 64px 제외 |
| 게임 오버 | 시간 초과, 버튼 밖 탭, 버튼 표시 전 탭, 100ms 미만 탭 중 하나라도 발생 |
| 기록 | `{ gameId, rounds, avgMs, bestMs, at }`, rounds ≥ 1만 저장, 최근 10개 |
| 최고 기록 | rounds 최대, 같으면 avgMs 낮은 쪽 |

## 측정
- 탭 시각: `pointerdown`의 `event.timeStamp`
- 표시 시각: 버튼을 보이게 바꾼 `requestAnimationFrame` 콜백 타임스탬프
- 반응시간 = 탭 시각 − 표시 시각. setTimeout은 무응답 종료에만 쓰고 측정값에 넣지 않는다.

## 순수 함수 (`src/games/reaction/scoring.ts`)
- `timeLimitFor(n)`, `pickDelay(rng)`, `randomPosition(rng, viewport, size, margin)`, `isHit(point, rect)`
- `judgeTap(shownAt | null, tapAt, limitMs, hit)` → `false-start` | `miss` | `timeout` | `{ kind: 'hit', ms }`
- `summarizeRun(results)` → `{ rounds, avgMs, bestMs, endReason }`

## 수용 기준
- AC-1 `package.json`에 `dev`·`typecheck`·`test`·`build` 스크립트, 의존성 `three`·`@types/three`·`typescript`·`vite`·`vitest`, rapier 없음
- AC-2 `npm run typecheck`, `npm test`, `npm run build` 종료 코드 0
- AC-3 `src/games/types.ts`의 `GameModule`/`GameInstance`/`InputSample`, `src/games/reaction/index.ts`가 `GameModule` export
- AC-4 `scoring.ts`는 three를 import하지 않고 위 함수들을 export
- AC-5 `scoring.test.ts` 경계값: `timeLimitFor` 1→1000, 2→950, 22→341, 45→105, 46→100, 100→100 · `pickDelay` rng 0→600, 0.999→≤1800 · `randomPosition` 390x844에서 영역 안 · `isHit` 경계 안/바깥 1px · `judgeTap` null, 99/100ms, limit/limit+1, 버튼 밖 · `summarizeRun` 성공 0회
- AC-6 `src/core/records.ts`의 `addRecord`·`getBest`·`getRecent`(저장소 주입), 테스트: 10개 유지, rounds 우선 최고 기록, rounds 0·100ms 미만·NaN 거부
- AC-7 `localStorage`는 `src/platform/`에만 존재
- AC-8 `src/games/reaction/`에 `pointerdown`·`timeStamp` 사용, `'click'`·`Date.now()` 없음
- AC-9 viewport 메타 `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`, 게임 영역 `touch-action: none`
- AC-10 390x844에서 홈 → 반응속도 → 여러 라운드 → 게임 오버 → 결과 → 홈 흐름을 터치로 진행, 잘림·가로 스크롤 없음
- AC-11 홈에 반응속도 카드(최고 라운드, 없으면 "-")와 비활성 "동체시력 · 준비 중" 카드
- AC-12 `src/**/*.ts`는 첫 줄 타이틀 주석 외 주석 없음
- AC-13 빌드 JS gzip 200KB 이하, three named import만

## 확인 필요
- 앱인토스 SDK 패키지명·저장소 API·입점 요건(번들 크기, WebGL 허용), 웹뷰의 `event.timeStamp` 정밀도
- 기기별 디스플레이 지연은 보정하지 않음
