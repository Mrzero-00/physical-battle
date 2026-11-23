# 벌레 스킨 아이콘만 보이게 (승인됨 · 2026-11-23)

## 목표
벌레 스킨(모기·나비·바퀴벌레)에서 원판 배경과 링(box-shadow)을 없애 아이콘만 보이게 한다. 게임 화면과 스킨 선택 미리보기 모두 해당. 벌레 색·판정(72px)·애니메이션·reduced-motion·default 스킨은 그대로.

## 수용 기준
- AC-1 `npm run typecheck`, `npm test`, `npm run build` 종료 코드 0
- AC-2 웹 빌드 390x844에서 벌레 3종 각각 플레이 시 `.reaction-target.visible`의 backgroundColor 투명, backgroundImage none, boxShadow none
- AC-3 default 스킨의 backgroundColor는 accent, boxShadow는 none이 아님
- AC-4 벌레 3종과 default 모두 72x72(±0.5)
- AC-5 선택 화면 벌레 3종 `.skin-preview` 배경 투명·boxShadow none, default 미리보기는 accent
- AC-6 나비로 봇 3라운드 이상, 벌레 3종 `.skin-part` animationName ≠ none
- AC-7 `git diff --stat -- src/games/reaction src/core src/app` 비어 있음, 바뀐 파일은 `src/styles.css`·`docs/specs/button-skins.md`(+이 명세 문서)
- AC-8 `src/styles.css`에 `#f4f6f8` 원판 규칙 없음, 새 주석 없음

## 확인 필요
- 진한 색 벌레(모기·바퀴벌레)는 어두운 배경에서 대비가 낮을 수 있음(사용자가 감수)
