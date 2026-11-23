# 게임 가이드 명세 (승인됨 · 2026-11-23)

## 목표
게임마다 처음 시작할 때 가이드(제목·하는 법 3단계·게임 오버·정적 SVG·기록 기준)를 띄우고, 이후에는 게임 HUD의 "?"로 다시 연다. 측정·판정·인터페이스·기록 키·랭킹은 바꾸지 않는다.

## 결정 사항 (사용자 확인)
- 첫 가이드는 **코인 차감 전**에 보여 준다: `requestPlay`에서 `pb:guide-seen:<id>`가 없으면 가이드 화면(상단 바·뒤로가기 포함)을 먼저 띄우고, "시작하기"를 누르면 seen을 기록한 뒤 기존 코인 차감 → 게임 시작으로 간다. 가이드에서 뒤로 나가면 코인을 쓰지 않는다.
- "?"(`.hud-help`)는 게임 ready 상태에서만 쓸 수 있다. slot의 첫 pointerdown(가이드 밖) 이후 disabled. ready에서 다시 연 가이드는 게임 slot 위 시트로 뜨고, 닫으면 ready 그대로(닫는 탭은 시작 탭이 아님).
- Escape로 닫아도 seen으로 기록한다.

## 데이터 (`src/games/guides.ts`)
`GameGuide {title, steps[3], gameOver, record, svg}`, `GUIDES`, `guideFor(id)`, `guideSeenKey(id) = pb:guide-seen:<id>`. 문구는 아래 표 그대로. svg는 `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" aria-hidden="true" focusable="false">`로 시작하는 정적 문자열(rect·circle·line·polyline·path·text·g), script·href·url(·on*=·id=·주석·animate·style 없음, 1500자 이하.

| id · 제목 | 하는 법 1 / 2 / 3 | 게임 오버 | 기록 기준 |
|---|---|---|---|
| reaction · 반응속도 | 화면을 탭하면 시작해요 / 버튼이 나타나면 바로 누르세요 / 라운드마다 빨라지고 여러 개가 떠요 | 버튼을 제한 시간 안에 누르지 못하면 끝나요. 빗나간 탭은 무시돼요. | 버틴 라운드 수, 같으면 평균 반응이 빠른 쪽 |
| vision · 동체시력 | 날아가는 공의 숫자를 읽으세요 / 공이 사라지면 보기 4개가 떠요 / 본 숫자를 골라 누르세요 | 틀린 숫자를 고르거나 5초 안에 고르지 못하면 끝나요. | 맞힌 라운드 수, 같으면 평균 반응이 빠른 쪽 |
| gonogo · 선택 반응 | 초록 원이 뜨면 바로 누르세요 / 빨간 사각형은 누르지 말고 참으세요 / 갈수록 제한 시간이 줄어요 | 빨간 사각형을 누르거나 초록 원을 제한 시간 안에 못 누르면 끝나요. | 성공한 신호 수, 같으면 초록 원 평균 반응이 빠른 쪽 |
| timing · 타이밍 예측 | 공이 왼쪽에서 오른쪽으로 움직여요 / 공이 세로선을 지나는 순간 탭하세요 / 갈수록 빨라지고 선 앞이 가려져요 | 허용 오차보다 이르거나 늦게 탭하거나, 탭하지 않으면 끝나요. | 성공한 라운드 수, 같으면 평균 오차가 작은 쪽 |
| flash · 순간 기억 | 잠깐 보이는 숫자를 기억하세요 / 숫자가 사라지면 키패드가 떠요 / 본 순서대로 숫자를 누르세요 | 숫자를 하나라도 틀리거나 제한 시간(3초+자리당 1초)을 넘기면 끝나요. | 성공한 레벨 수, 같으면 평균 입력 시간이 빠른 쪽 |
| peripheral · 주변시야 | 가운데를 보고 기다리세요 / 가운데 글자와 가장자리 점이 잠깐 떠요 / 점의 방향, 글자 순서로 고르세요 | 방향이나 글자를 틀리거나 6초 안에 답하지 못하면 끝나요. | 성공한 레벨 수, 같으면 평균 응답이 빠른 쪽 |
| tapspeed · 연타 속도 | 탭하면 3초 뒤에 시작해요 / 화면 왼쪽과 오른쪽을 번갈아 탭하세요 / 같은 쪽을 연속으로 탭하면 안 세요 | 10초가 지나면 끝나요. | 10초 동안 인정된 탭 수, 같으면 마지막 탭이 빠른 쪽 |
| stroop · 색-단어 간섭 | 색 이름 글자가 다른 색으로 떠요 / 글자 뜻 말고 글자 색을 고르세요 / 갈수록 빨라지고 버튼이 섞여요 | 다른 색을 고르거나 제한 시간 안에 고르지 못하면 끝나요. | 맞힌 라운드 수, 같으면 평균 판단이 빠른 쪽 |
| mot · 다중 물체 추적 | 처음에 표시된 공을 기억하세요 / 공이 움직이는 동안 눈으로 따라가세요 / 멈추면 표시됐던 공을 모두 누르세요 | 표시되지 않은 공을 누르거나 10초 안에 다 고르지 못하면 끝나요. | 성공한 레벨 수, 같으면 평균 선택 시간이 빠른 쪽 |
| balance · 균형 | 폰을 기울여 공을 굴리세요(안 되면 드래그) / 공이 길을 벗어나지 않게 하세요 / 초록 골에 닿으면 다음 레벨이에요 | 공이 길을 벗어나거나 한 레벨에서 60초를 넘기면 끝나요. | 성공한 레벨 수, 같으면 평균 클리어 시간이 빠른 쪽 |

## 렌더 (`src/app/guide.ts`)
`section.guide`(role=dialog, aria-modal, aria-labelledby), `h2.guide-title`, `div.guide-art`(svg), "하는 법" `ol.guide-steps`, "게임 오버" `p.guide-over`, "기록 기준" `p.guide-record`, `button.guide-start` "시작하기"(포커스). `.guide-start` click 또는 Escape로 닫힘, close는 한 번만. 시작하기 버튼은 390x844에서 스크롤 없이 보임, 애니메이션 없음.

## 수용 기준
- AC-1 typecheck·test·build·build:mock·build:toss 종료 코드 0
- AC-2 `guides.test.ts`: allGames 10종 모두 guide 있음, title = game.title, steps 3개·비어 있지 않음·30자 이하, gameOver·record 비어 있지 않음, `guideFor('nope')` null, `guideSeenKey('reaction')` = 'pb:guide-seen:reaction'
- AC-3 SVG: `<svg`로 시작·`</svg>`로 끝·1500자 이하, `/<script|href|url\(|on[a-z]+=|\sid=|<!--|<animate|<style/i` 없음, xmlns 값 외 `http` 없음
- AC-4 표의 문구가 `guides.ts`에 그대로
- AC-5 E2E 첫 시작(mock, 390x844): storage 비우고 반응속도 카드 → 가이드(제목 "반응속도", 포커스 `.guide-start`), **코인 그대로 5** → 시작하기 → 코인 4, 게임 ready 힌트, `data-phase` ready, seen = '1'
- AC-6 두 번째 시작은 가이드 없이 바로 ready
- AC-7 ready에서 `.hud-help` 활성 → 누르면 가이드 시트 → 닫으면 ready 그대로 → 게임 영역 탭 후 `.hud-help` disabled
- AC-8 카드 10개 각각 첫 시작 가이드 제목 = 카드 제목, 가이드에서 뒤로 가면 코인이 줄지 않음
- AC-9 Escape로 닫으면 seen 기록, 나간 뒤 keydown 리스너 남지 않음
- AC-10 기존 E2E는 seen 플래그를 미리 넣고 reaction·vision 흐름이 그대로
- AC-11 메인 번들 gzip 200KB 이하
- AC-12 새·수정 `.ts`는 첫 줄 타이틀 주석만, styles.css 주석 없음
- AC-13 `src/games/<id>/`, `types.ts`, `registry.ts` 변경 없음
