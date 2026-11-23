# 코인·랭킹 UI/UX + 전체 랭킹 서버 명세 (승인됨 · 2026-11-23)

## 목표
토스·목업 빌드에 코인 상단 바와 코인 패널(애니메이션 없음)을 넣는다. 모든 빌드에 내 기록 화면, 결과 화면 개선(개인 최고 비교·신기록 강조·공유), 전체 플레이어 누적 TOP 100 랭킹(Vercel Functions + Upstash Redis)을 넣는다. 일반 웹은 코인 없이 전체 랭킹만 쓴다. 측정·판정 로직과 `src/core/coins.ts` 규칙은 바꾸지 않는다.

## 범위
- 포함: `src/core/{ranking,coin-view,share}.ts`와 테스트, `api/ranking.ts`·`api/_lib/{service,store,memory-store,upstash-store}.ts`·`api/_lib/service.test.ts`, `src/app/{ranking-client,topbar,coin-sheet,records,global-ranking,nickname}.ts`, 기존 `home/result/coins/router/ranking` 수정, `PlatformAdapter`의 `identity()`·`share()`, `src/platform/mock.ts`, `VITE_PLATFORM=mock`·`dev:mock`·`build:mock`, `@upstash/redis`
- 제외: 주간 랭킹, 욕설 필터 본체(훅만), 서버의 토스 신원 검증, 닉네임 중복 금지, 측정·판정·코인 규칙 변경, 토스 딥링크 공유, 애니메이션

## 동작 요약
- 코인(`platform.name !== 'web'`): 홈·결과·코인 부족·내 기록·전체 랭킹 화면의 `.top-bar` 안 `.coin-bar`에 총 코인, `.coin-breakdown`("무료 n · 보너스 n"), `.coin-refill`(`refillText`: free 5면 "무료 코인 가득", 아니면 "무료 5코인까지 H시간 M분"/"M분"/"곧", 기준 다음 로컬 자정). 60초마다 다시 그림, 게임 HUD에는 없음, 애니메이션·전환 없음. 누르면 `.coin-sheet`(role=dialog): 내역, 충전 문구, "광고 보고 +3코인"(코인이 남아도 가능, bonus 99면 disabled), 닫기. 광고 처리는 router `watchAd()` 하나로, 실제 증가량(`appliedBonus`)을 안내
- 내 기록: 홈에 "내 기록"·"전체 랭킹" 버튼. `.best-card`(없으면 "아직 기록이 없어요"), `.recent-list` 최대 10행, "전체 랭킹 보기"
- 결과: `bestComparisonText`("첫 기록이에요"/"최고 기록 경신!"/"최고 기록까지 N라운드"/"최고 기록과 같은 라운드 · 평균 +Nms"), 신기록이면 "순위 확인하기". `.result-ranking`에 `.rank-row-toss`(토스만)와 `.rank-row-global`(올리는 중/전체 N위/기존 최고 유지 · N위/닉네임 정하기/오프라인·다시 시도). `.share-btn`: `shareText` → 토스 `share`, 웹 `navigator.share` → 클립보드 → 실패
- 전체 랭킹 서버: 점수 `rounds*100000 + (99999 - round(avgMs))`, `validateSubmission`(gameId 화이트리스트, rounds 1..999, avgMs 100..99999, bestMs 100..avgMs, playerId `^(toss|web):[A-Za-z0-9+/=_-]{8,128}$`, 닉네임), `validateNickname`(NFC·trim·공백 1칸, 2~12자, `^[가-힣A-Za-z0-9 _-]+$`, isBlocked 훅), `sanitizeNickname`, Redis zset `pb:rank:v1:<gameId>` + meta hash, 레이트리밋 분당 10회(429), 기록이 나아질 때만 갱신, GET TOP 100 + me(플레이어 ID 비노출, no-store), CORS 허용 목록(`https://physical-battle.vercel.app` + `RANKING_ALLOWED_ORIGINS`), 환경변수 없으면 503
- 클라이언트: `VITE_RANKING_API_BASE`(웹 '' / 토스 `https://physical-battle.vercel.app` / 목업은 없으면 브라우저 가짜 저장소), 5초 타임아웃, 결과 `ok|invalid|rate-limited|not-configured|offline|error`(throw 없음), 로컬 최고 기록이 마지막 제출보다 좋을 때만 제출. 신원: 토스 `getUserKeyForGame` HASH → `toss:<hash>` + 게임 닉네임(없으면 "토스 플레이어"), 실패하면 null; 웹 `web:<device-id>` + 저장 닉네임
- 목업(`name:'mock'`): 코인 켜짐, 광고 1500ms 뒤 rewarded(`?mockAd=closed|failed|unavailable`), 가짜 토스 리더보드·프로필, 가짜 랭킹(봇 5명), 웹·토스 빌드에서는 트리셰이킹으로 빠짐

## 수용 기준
- AC-1 `npm run typecheck`, `npm test`, `npm run build`, `npm run build:mock` 종료 코드 0
- AC-2 `ranking.test.ts`: encodeScore 순서·최댓값 99,999,899·왕복·반올림, validateSubmission 거부 케이스, validateNickname 코드·정규화, sanitizeNickname 대체값, rateLimitDecision(10,10) 허용·(11,10) 거부, shouldSubmit
- AC-3 `coin-view.test.ts`: refillText(23:59:30 "곧", 22:00 "2시간 0분", 23:10 "50분", free 5 "무료 코인 가득"), canWatchAd(bonus 99 false), appliedBonus(98+3 → 1)
- AC-4 공유 문구에 rounds·avgMs·URL 포함, 비교 문구 4종과 무효 기록 null
- AC-5 `api/_lib/service.test.ts`(memory-store): improved·rank 1, kept, 11번째 429, 잘못된 body·JSON 400, GET top ≤100·정렬·isMe·me.rank, 응답에 "toss:"·"web:" 없음, 허용 안 된 Origin에 ACAO 없음, 허용 Origin OPTIONS 204, 스토어 없음 503
- AC-6 `ranking-client.test.ts`: 200 ok, 429 rate-limited, 503 not-configured, throw offline, 5초 타임아웃 offline, 이상한 JSON error, base 결합
- AC-7 `apps-in-toss.test.ts` 추가: identity HASH → `toss:<hash>`, ERROR·undefined·throw·버전 미달 → null, PROFILE_NOT_FOUND → "토스 플레이어", share 성공 shared·throw failed, 기존 테스트 통과
- AC-8 `mock.test.ts`: 광고 1500ms 뒤 rewarded, mockAd=failed면 failed, 가짜 랭킹 정렬
- AC-9 grep: `@upstash`가 src·dist·dist-toss에 없음, "목업 플레이어"·`mockAd`가 dist·dist-toss에 없음, `@apps-in-toss`는 src/platform/에만, src/core·api에 three·`@apps-in-toss` import 없음, `api/_lib/service.ts`가 `src/core/ranking` 검증을 import
- AC-10 `src/core/coins.ts`, `src/games/reaction/` 변경 없음, 새 코드 파일은 첫 줄 타이틀 주석만
- AC-11 웹 빌드 JS gzip 200KB 이하, `showFullScreenAd` 없음
- AC-12 E2E 웹(390x844, /api 없음): 홈에 `.coin-bar` 없음·"내 기록"·"전체 랭킹" 있음, 1판 뒤 비교 문구·`.share-btn`, 닉네임 "a" 오류·"테스터" 저장 후 오프라인 문구·다시 시도, 전체 랭킹 `.rank-error`, 홈 복귀·재플레이, 가로 스크롤 없음
- AC-13 E2E 목업(390x844): `.coin-bar` 총 5·"무료 5 · 보너스 0"·`.coin-refill`, 애니메이션 none·전환 0s, 시트 광고 후 약 1.5초 뒤 총 8, 결과에 `.rank-row-toss`·`.rank-row-global` "N위", 신기록이면 "순위 확인하기" → `.rank-list .is-me`, 내 기록 `.recent-list` 1행 이상, 게임 화면에 `.top-bar` 없음

## 확인 필요
- Upstash Redis 통합 설치 후 환경변수 이름(`KV_REST_API_*` 또는 `UPSTASH_REDIS_REST_*`), 프로덕션 재배포
- 토스 웹뷰 Origin(`RANKING_ALLOWED_ORIGINS`), 앱인토스 외부 도메인 호출 규정
- 서버의 토스 신원 검증(`User.createAnonymousKeyAuthCode` 등)은 범위 밖, playerId 위조·점수 조작 위험 수용
- deprecated SDK 별칭(`getUserKeyForGame`·`share`·`getGameCenterGameProfile`) 실기기 동작, hash 문자 집합
- Vite 프로젝트에서 `api/*.ts` Web Request 시그니처 동작은 배포 후 확인
