# 반응속도 버튼 모양(스킨) 선택 명세 (승인됨 · 2026-11-23)

## 목표
반응속도 버튼 모양을 기본 버튼·모기·나비·바퀴벌레 중에서 고른다. 모두 무료이고 웹·토스·mock 빌드 공통이다. 벌레 스킨은 제자리에서 gif처럼 살짝 움직인다. 스킨은 보이는 모양만 바꾸고 판정 영역(72px), 표시 시각, 점수는 그대로 둔다.

## 결정 사항
- `src/core/skins.ts`: `SkinId`, `SKINS`(기본 버튼·모기·나비·바퀴벌레), `SKIN_KEY='pb:skin'`, `parseSkin`(목록 밖·빈 값 → 'default'), `loadSkin`/`saveSkin`, `skinMarkup(id)`(루트 `<svg class="skin skin-<id>" … aria-hidden="true" focusable="false">`)
- `GameContext.skin?`를 router가 `loadSkin`으로 넘긴다. `reaction/index.ts`는 `button.innerHTML = skinMarkup(...)`과 `button.dataset.skin`만 더한다
- 벌레 스킨은 밝은 원판(#f4f6f8) 위에 진한 벌레, default는 지금의 초록 원
- 애니메이션은 안쪽 부품 `.skin-part`에만, keyframes는 transform만, `.reaction-target`·svg 루트에는 transition·animation 없음, `prefers-reduced-motion: reduce`면 `.skin-part { animation: none }`
- `src/app/skins.ts` 선택 화면: `button.skin-option[data-skin]` 4개(72px 미리보기·이름·✓·`aria-pressed`), 탭하면 저장. 홈 `home-nav`는 2열 + "버튼 모양" 전체 폭

## 수용 기준
- AC-1 `npm run typecheck`, `npm test`, `npm run build`, `npm run build:mock` 종료 코드 0 (`build:toss`도 가능하면 0)
- AC-2 `skins.test.ts`: SKINS 순서·이름, `parseSkin`('butterfly' 유지, null·''·'bee'·' butterfly'·'DEFAULT' → 'default'), `saveSkin`→`loadSkin`·키 `pb:skin`, 빈 storage 'default'
- AC-3 `skinMarkup` 4종: `<svg`로 시작·`class="skin skin-<id>"`, `<script`·`href`·`url(`·`http`·`on[a-z]+=`·`id=` 없음, 벌레 3종은 `skin-part` 1개 이상, 각 1500자 이하
- AC-4 `src/games/reaction/scoring.ts`·`scoring.test.ts`·`stage.ts`, `src/core`(skins 제외), `src/platform` 변경 없음
- AC-5 `reaction/index.ts` diff는 import와 innerHTML·dataset.skin 줄만, `shownAt`·rAF·`isHit`·`judgeTap`·타이머 줄 변경 없음
- AC-6 `.reaction-target`·`.skin` 루트에 transition·animation 없음, 스킨 keyframes는 transform만, reduced-motion 블록에 `.skin-part { animation: none }`
- AC-7 headless Chrome 390x844 웹 빌드: 홈 "버튼 모양" → 상단 바 제목·뒤로가기, `.skin-option` 4개·처음 default만 pressed, 나비 선택 후 reload해도 `pb:skin`='butterfly'·나비만 pressed, 플레이 중 `.reaction-target.visible`에 `svg.skin-butterfly`·72x72(±0.5), 봇으로 3라운드 이상, `.skin-part` animationName ≠ none·running, reduced-motion 에뮬레이트 시 none, 모든 화면 가로 스크롤 없음
- AC-8 dist JS+CSS gzip 합계 200KB 이하
- AC-9 바뀐 `src/**/*.ts`는 첫 줄 타이틀 주석만
- AC-10 새 이미지 파일 없음
