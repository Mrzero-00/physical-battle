# 연속 버튼 안내 명세 (승인됨 · 2026-11-23)

## 목표
연속 버튼 수가 늘어나는 라운드(5·8·11 → 2·3·4개)의 첫 버튼 전에 1500ms 동안 안내를 띄운다. 반응시간 측정, 판정, 기록은 바꾸지 않는다.

## 범위
- 변경: `src/games/reaction/{scoring,scoring.test,index}.ts`, `src/styles.css`(`.reaction-announce*`), `docs/specs/reaction.md`
- 변경 금지: `stage.ts`, `src/core/`, `src/platform/`과 그 테스트, 기존 순수 함수(`judgeTap`·`timeLimitFor`·`nextLimit`·`burstSizeFor`·`advance`·`burstLabel`·`summarizeRun`·`pickDelay`·`randomPosition*`)의 동작과 기존 테스트

## 동작
- `announcementFor(round)`: 2 이상 정수 round에서 `burstSizeFor(round) > burstSizeFor(round-1)`일 때만 `{ size, title: '이제 ${size}개씩 버튼이 나옵니다!', sub: '누르자마자 다음 버튼이 떠요' }`, 그 밖은 null
- `index.ts`: `ANNOUNCE_MS = 1500`, phase `'announce'`. next-round에서 안내가 있으면 HUD 갱신 → 안내 표시 → announce phase(배경은 waiting 톤) → 1500ms 뒤 숨기고 기존 `scheduleRound()`
- 안내 중 탭은 `measure`에서 바로 return(판정·측정 없음)
- `clearTimers()`가 안내 타이머도 해제, `start()`에서 안내 숨김
- 안내 요소 `div.reaction-announce`(`role="status"`, `aria-live="polite"`), 제목 `.reaction-announce-title`, 부제 `.reaction-announce-sub`, `pointer-events: none`, reduced-motion이면 전환 효과 없음

## 수용 기준
- AC-1 `npm run typecheck`, `npm test`, `npm run build` 종료 코드 0
- AC-2 `announcementFor`: 1·4·6·7·10·12·16·100→null, 5→2·8→3·11→4, title·sub 문구 정확
- AC-3 기존 `scoring.test.ts` 케이스 기대값 변경 없음(diff는 import 추가와 새 describe만)
- AC-4 `scoring.ts`의 기존 export 함수 본문 변경 없음
- AC-5 `index.ts`에 `ANNOUNCE_MS = 1500`, `'announce'` phase, announce에서 measure return, `clearTimers`에 안내 타이머 해제, `role="status"`·`aria-live="polite"`
- AC-6 `shownAt` 대입은 rAF 콜백 ts와 null 초기화뿐, `'click'`·`Date.now()` 없음
- AC-7 `styles.css`에 `.reaction-announce`(가운데 정렬, `pointer-events: none`), 전환 효과는 reduced-motion에서 끔
- AC-8 headless Chrome 390x844: 5라운드 진입 시 안내 문구 표시와 `data-phase="announce"`, 이때 탭해도 `over`가 되지 않음, 약 1500ms 뒤 `waiting` → 버튼 → HUD `1/2`, 1~4라운드에는 안내 없음, 잘림·가로 스크롤 없음
- AC-9 안내 중 dispose하거나 재시작하면 남은 타이머로 `scheduleRound`가 다시 돌지 않음
- AC-10 `docs/specs/reaction.md` 규칙 표와 순수 함수 목록에 안내 반영
- AC-11 바뀐 `src/**/*.ts`는 첫 줄 타이틀 주석 외 주석 없음
- AC-12 `src/core/`, `src/platform/`, `stage.ts`와 그 테스트 변경 없음
