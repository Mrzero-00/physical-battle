# 토스 랭킹 + 오락실식 코인 명세 (2026-11-23)

## 목표
앱인토스 배포를 전제로 두 기능을 넣는다. 자체 서버는 두지 않는다.
- 토스 게임센터 리더보드에 "버틴 라운드 수"를 제출하고 토스 랭킹 화면을 연다.
- 오락실식 코인: 1판 1코인. 무료 코인은 하루 5개까지 채워지고, 보상형 광고를 끝까지 보면 광고 코인 +3.

일반 웹 빌드는 지금처럼 무료 플레이와 기기 기록만 있고, 코인·광고·랭킹·SDK가 없다.

## 범위
- 포함: `PlatformAdapter`의 `leaderboard`·`profile()`·`ads`(보상형), 웹 no-op 구현, `src/platform/apps-in-toss.ts`(SDK 동적 import), 순수 함수 `src/core/{leaderboard,coins,ads}.ts`와 테스트, 코인 UI·코인 부족 화면, 결과 화면 제출 상태·랭킹 버튼, 홈 랭킹 진입점·닉네임, `@apps-in-toss/web-framework` 의존성
- 제외: 전면 광고, 자체 서버·서버 측 검증, 리더보드 순위 읽기(API 없음), `getUserKeyForGame`, 결제, 배너, storage 전환, 측정 방식 변경

## 플랫폼
- `PlatformAdapter`
  - `leaderboard: { available(): Promise<boolean>; submit(score: string): Promise<SubmitOutcome>; open(): Promise<void> }`
  - `profile(): Promise<{ nickname: string; imageUri: string } | null>`
  - `ads: { preload(): void; isReady(): boolean; showRewarded(): Promise<RewardOutcome> }`
  - `SubmitOutcome = 'submitted' | 'unsupported' | 'leaderboard-not-found' | 'profile-not-found' | 'invalid-score' | 'error'`
  - `RewardOutcome = 'rewarded' | 'closed' | 'unavailable' | 'failed'`
- 웹: SDK import 없음. `available` false, `submit` 'unsupported', `open` 즉시 resolve, `profile` null, 광고는 `isReady` false·`showRewarded` 'unavailable'.
- 선택: `import.meta.env.VITE_PLATFORM === 'apps-in-toss'`일 때만 앱인토스 어댑터. 기본 빌드에는 SDK 청크가 없다. 코인은 `platform.name === 'apps-in-toss'`일 때만 켠다.
- 앱인토스 어댑터: `createAppsInTossPlatform(loadSdk = () => import('@apps-in-toss/web-framework'))`, storage는 웹 구현 재사용
  - `available()`: SDK 로드 + `isMinVersionSupported({ android: '5.221.0', ios: '5.221.0' })`를 1500ms 안에 확인, 실패·타임아웃·false면 false, 세션 캐시
  - `submit`: `submitGameCenterLeaderBoardScore({ score })` → `mapSubmitResponse`, throw면 'error'
  - `open`: `openGameCenterLeaderboard()`, 실패 시 reject
  - `profile`: SUCCESS일 때만 값, 그 밖은 null
  - 광고 ID: `import.meta.env.VITE_AD_REWARDED_ID || 'ait-ad-test-rewarded-id'`
  - `preload()`: loading·ready이거나 `loadFullScreenAd.isSupported()` false면 무시. `loaded` → ready, onError·throw → idle. 앱 시작과 광고 종료 직후에만 호출, 클릭 시 로드 금지
  - `showRewarded()`: ready가 아니면 'unavailable'. ready면 `showFullScreenAd` 이벤트·`visibilitychange`·타이머를 `reduceAdEvent`에 넣고, 종료 시 1회 resolve → unregister → `preload()`. reject 없음

## 광고 순수 로직 (`src/core/ads.ts`)
- `reduceAdEvent(state, ev)`, ev: `requested | show | impression | clicked | userEarnedReward | dismissed | failedToShow | error | visible | tick`
- 보상은 `userEarnedReward`로만 판단, 중복 무시
- `dismissed` → 보상 있으면 rewarded, 없으면 closed
- 보상 전 `failedToShow`·`error` → failed
- dismissed 누락 대비(Android 5.255.0): show 이후 visible 복귀 + 1000ms → 보상 있으면 rewarded, 없으면 closed
- 호출 후 5000ms 안에 show 없음 → failed / 90000ms 강제 종료(보상 있으면 rewarded, 없으면 failed)
- done 이후 이벤트 무시

## 코인 순수 로직 (`src/core/coins.ts`)
- 상수: `DAILY_FREE = 5`, `AD_REWARD = 3`, `FALLBACK_GRANT = 1`, `BONUS_CAP = 99`, 키 `pb:coins`
- 상태: `CoinState = { free: number; bonus: number; lastRefillDay: string }`
  - `free`: 무료 코인(0~5), `bonus`: 광고·대체 지급 코인(0~99), 화면 표시는 `free + bonus`
- `localDayKey(now)`: 로컬 날짜 `YYYY-MM-DD`
- `applyDailyRefill(s, now)`: 날짜가 바뀌었으면 `free = 5`(남은 무료 코인이 쌓이지 않음, 2 → 5), `bonus`는 그대로, `lastRefillDay` 갱신. 같은 날이면 변화 없음
- `total(s)`, `canPlay(s)`: total ≥ 1
- `spend(s)`: free가 있으면 free에서, 없으면 bonus에서 1 차감. total 0이면 `{ ok: false }`
- `grantBonus(s, n)`: 정수 n ≥ 0만, bonus를 99에서 자름
- `rewardDelta(outcome, total)`: rewarded → 3, total 0이고 unavailable·failed → 1, 그 밖(closed 포함) → 0. 지급은 bonus로
- `parseCoinState(raw, now)`: null·손상·음수·소수·NaN·누락 필드 → `{ free: 5, bonus: 0, lastRefillDay: 오늘 }`, free는 0~5로 자름
- `loadCoins(storage, now)` / `saveCoins(storage, s)`

## 플레이 흐름 (코인이 켜진 경우)
- 홈 카드·"다시 하기": `applyDailyRefill` → `spend`. 성공하면 저장 후 게임 시작(기존 ready 상태부터). 실패하면 코인 부족 화면(`src/app/coins.ts`)
- 코인 부족 화면: "코인이 없어요", "광고 보고 3코인 받기", "홈으로"
  - 광고 버튼: disabled → `showRewarded()` → `rewardDelta`만큼 bonus 지급·저장
  - rewarded: "3코인 받았어요" / unavailable·failed: "광고를 불러올 수 없어 1코인을 드려요" / closed: "끝까지 시청해야 코인을 받아요"(버튼 재활성)
  - total ≥ 1이 되면 "시작하기" 버튼(누르면 spend 후 시작)
- 광고는 이 화면에서 사용자가 누를 때만. 게임 중 호출 금지
- 게임 중 ✕로 나가도 쓴 코인은 돌려주지 않음
- UI: 홈 헤더·결과 화면에 `.coin-badge`("COIN 7"), 게임 카드 "1코인", 재시작 "다시 하기 (1코인)". 홈 렌더마다 일일 충전 적용

## 랭킹
- `toLeaderboardScore(record)`: `isValidRecord` 통과 시 `String(rounds)`, 아니면 null
- `mapSubmitResponse(res)`: SUCCESS/LEADERBOARD_NOT_FOUND/PROFILE_NOT_FOUND/UNPARSABLE_SCORE 매핑, undefined → unsupported, 그 밖 → error
- `submitOutcomeMessage(o)`: 한국어 문구
- 게임 종료 시 `addRecord(...).saved === true`이고 `available()` true면 1회 제출. 결과 화면 `.result-ranking`에 "제출 중…" → 최종 문구, "토스 랭킹 보기". 화면이 바뀐 뒤(`isConnected` false)에는 DOM 갱신 안 함. 검증 실패 기록은 "이번 기록은 제출되지 않아요"
- 홈: `available()` true면 `.home-ranking`(닉네임 "○○님" + "토스 랭킹 보기")
- 랭킹 열기 중 버튼 disabled, 실패 시 "랭킹을 열 수 없어요"

## 수용 기준
- AC-1 `npm run typecheck`, `npm test`, `npm run build` 종료 코드 0
- AC-2 `grep -rl "@apps-in-toss" src` 결과가 `src/platform/` 하위뿐
- AC-3 `package.json`에 `@apps-in-toss/web-framework`, 기존 스크립트 유지
- AC-4 `coins.test.ts`: 자정 경계(23:59:59.999와 다음 날 00:00), 같은 날 변화 없음, 다음 날 free 0→5·2→5·bonus 유지, spend는 free 먼저·free 0이면 bonus·total 0이면 실패, grantBonus 99 상한·음수·소수 거부, parseCoinState 손상값 기본값·free 5 초과 자름, rewardDelta(rewarded 3, total 0의 unavailable·failed 1, total 0의 closed 0, total 2의 failed 0)
- AC-5 `ads.test.ts`: show→reward→dismissed rewarded, show→dismissed closed, failedToShow·error failed, reward 후 dismissed 없이 visible+1000ms rewarded, 보상 2회는 1회 처리, 5000ms show 없음 failed, 90000ms 강제 종료, done 이후 무시
- AC-6 `leaderboard.test.ts`: toLeaderboardScore(23→"23", 0·avgMs 99·NaN·소수 → null), mapSubmitResponse(4종, undefined, `{}`, null, 문자열), 모든 outcome 메시지
- AC-7 `apps-in-toss.test.ts`(가짜 SDK + fake timers): submit throw → error, undefined → unsupported, available false/throw/타임아웃 → false, profile 매핑, 로드 전 showRewarded → unavailable, loaded 후 보상+dismissed → rewarded와 preload 재호출, dismissed 없이도 resolve, isSupported false면 load 안 함, 중복 preload는 load 1회, 기본 adGroupId 테스트 ID
- AC-8 `src/core/{coins,ads,leaderboard}.ts`는 three·`@apps-in-toss` import 없음, `web.ts`는 SDK import 없음
- AC-9 기본 빌드 JS에 `showFullScreenAd`·`submitGameCenterLeaderBoardScore` 없음, gzip 합계 200KB 이하
- AC-10 일반 웹 390x844에서 홈 → 반응속도 → 게임 오버 → 결과 → 다시 하기·홈 흐름, 즉시 시작, `.coin-badge`·랭킹 UI 없음
- AC-11 `src`에 실제 광고 ID 리터럴 없음(`VITE_AD_REWARDED_ID`와 테스트 ID 기본값만), `interstitial` 없음
- AC-12 라우터는 `saved === true`일 때만 submit, 코인이 켜진 경우 spend 성공 뒤에만 `game.create`, 지급량은 `rewardDelta`로만(코드 확인)
- AC-13 첫 줄 타이틀 외 주석 없음, 기존 `scoring.test.ts`·`records.test.ts` 미수정·통과

## 확인 필요
- SDK의 Vite 연동(granite.config, `ait build`/`ait dev`, 출력 경로), 브라우저 import 시 예외 여부, 광고 API 실제 타입
- 테스트 광고 ID(`ait-ad-test-rewarded-id` vs `ait.dev.43daa14da3ae487b`), 광고 지원 버전(5.239.0 / 5.247.0), dismissed 누락 대비 시간값
- 코인은 localStorage라 조작·기기 시간 변경 악용 가능(서버 없음으로 감수), 토스 웹뷰의 localStorage 유지 여부
- 리더보드가 최고 점수를 유지하는지 마지막 점수를 유지하는지, 게임 프로필 생성 흐름
- 운영: 콘솔 게임 카테고리 등록·승인, 리더보드 단위 "라운드"·높을수록 상위, 보상형 광고 그룹 발급(실제 ID는 릴리스 빌드에서만 `VITE_AD_REWARDED_ID`), 토스 앱 QR 테스트, `.ait` 100MB 이하
