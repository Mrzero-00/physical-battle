// 게임별 시작 전 가이드 데이터
export interface GameGuide {
  title: string;
  steps: readonly [string, string, string];
  gameOver: string;
  record: string;
  svg: string;
}

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" aria-hidden="true" focusable="false">${body}</svg>`;

const BG = '<rect x="0" y="0" width="120" height="80" rx="10" fill="#141922"/>';

export const GUIDES: Record<string, GameGuide> = {
  reaction: {
    title: '반응속도',
    steps: ['화면을 탭하면 시작해요', '버튼이 나타나면 바로 누르세요', '라운드마다 빨라지고 여러 개가 떠요'],
    gameOver: '버튼을 제한 시간 안에 누르지 못하면 끝나요. 빗나간 탭은 무시돼요.',
    record: '버틴 라운드 수, 같으면 평균 반응이 빠른 쪽',
    svg: svg(
      `${BG}<circle cx="70" cy="36" r="16" fill="#3ddc84"/><circle cx="70" cy="36" r="21" fill="none" stroke="#3ddc84" stroke-opacity="0.35" stroke-width="3"/>` +
        `<path d="M58 70 L58 54 C58 50 64 50 64 54 L64 48 C64 44 70 44 70 48 L70 60" fill="none" stroke="#f2f4f8" stroke-width="3" stroke-linecap="round"/>`,
    ),
  },
  vision: {
    title: '동체시력',
    steps: ['날아가는 공의 숫자를 읽으세요', '공이 사라지면 보기 4개가 떠요', '본 숫자를 골라 누르세요'],
    gameOver: '틀린 숫자를 고르거나 5초 안에 고르지 못하면 끝나요.',
    record: '맞힌 라운드 수, 같으면 평균 반응이 빠른 쪽',
    svg: svg(
      `${BG}<line x1="12" y1="34" x2="70" y2="34" stroke="#8b93a7" stroke-width="2" stroke-dasharray="4 4"/>` +
        `<path d="M64 29 L72 34 L64 39" fill="none" stroke="#8b93a7" stroke-width="2"/>` +
        `<circle cx="88" cy="34" r="14" fill="#f7f7f2"/><text x="88" y="40" font-size="16" font-weight="900" text-anchor="middle" fill="#10131a">7</text>` +
        `<rect x="16" y="56" width="20" height="14" rx="3" fill="#202633"/><rect x="40" y="56" width="20" height="14" rx="3" fill="#202633"/>` +
        `<rect x="64" y="56" width="20" height="14" rx="3" fill="#3ddc84"/><rect x="88" y="56" width="20" height="14" rx="3" fill="#202633"/>`,
    ),
  },
  gonogo: {
    title: '선택 반응',
    steps: ['초록 원이 뜨면 바로 누르세요', '빨간 사각형은 누르지 말고 참으세요', '갈수록 제한 시간이 줄어요'],
    gameOver: '빨간 사각형을 누르거나 초록 원을 제한 시간 안에 못 누르면 끝나요.',
    record: '성공한 신호 수, 같으면 초록 원 평균 반응이 빠른 쪽',
    svg: svg(
      `${BG}<circle cx="36" cy="38" r="18" fill="#3ddc84"/><text x="36" y="72" font-size="9" text-anchor="middle" fill="#3ddc84">누르기</text>` +
        `<rect x="66" y="20" width="36" height="36" rx="4" fill="#e5484d"/><path d="M74 28 L94 48 M94 28 L74 48" stroke="#fff" stroke-width="4"/>` +
        `<text x="84" y="72" font-size="9" text-anchor="middle" fill="#ff5d6c">참기</text>`,
    ),
  },
  timing: {
    title: '타이밍 예측',
    steps: ['공이 왼쪽에서 오른쪽으로 움직여요', '공이 세로선을 지나는 순간 탭하세요', '갈수록 빨라지고 선 앞이 가려져요'],
    gameOver: '허용 오차보다 이르거나 늦게 탭하거나, 탭하지 않으면 끝나요.',
    record: '성공한 라운드 수, 같으면 평균 오차가 작은 쪽',
    svg: svg(
      `${BG}<rect x="10" y="36" width="100" height="8" rx="4" fill="#202633"/><line x1="90" y1="20" x2="90" y2="60" stroke="#ffd34d" stroke-width="3"/>` +
        `<circle cx="44" cy="40" r="9" fill="#f2f4f8"/><path d="M58 40 L74 40 M68 35 L74 40 L68 45" fill="none" stroke="#8b93a7" stroke-width="2"/>` +
        `<text x="90" y="72" font-size="9" text-anchor="middle" fill="#ffd34d">지금 탭!</text>`,
    ),
  },
  flash: {
    title: '순간 기억',
    steps: ['잠깐 보이는 숫자를 기억하세요', '숫자가 사라지면 키패드가 떠요', '본 순서대로 숫자를 누르세요'],
    gameOver: '숫자를 하나라도 틀리거나 제한 시간(3초+자리당 1초)을 넘기면 끝나요.',
    record: '성공한 레벨 수, 같으면 평균 입력 시간이 빠른 쪽',
    svg: svg(
      `${BG}<text x="32" y="44" font-size="20" font-weight="900" text-anchor="middle" fill="#f2f4f8">3 8 1</text>` +
        `<g fill="#202633"><rect x="70" y="12" width="12" height="12" rx="2"/><rect x="85" y="12" width="12" height="12" rx="2"/><rect x="100" y="12" width="12" height="12" rx="2"/>` +
        `<rect x="70" y="27" width="12" height="12" rx="2"/><rect x="85" y="27" width="12" height="12" rx="2"/><rect x="100" y="27" width="12" height="12" rx="2"/>` +
        `<rect x="70" y="42" width="12" height="12" rx="2"/><rect x="85" y="42" width="12" height="12" rx="2"/><rect x="100" y="42" width="12" height="12" rx="2"/>` +
        `<rect x="85" y="57" width="12" height="12" rx="2"/></g><rect x="100" y="12" width="12" height="12" rx="2" fill="#3ddc84"/>`,
    ),
  },
  peripheral: {
    title: '주변시야',
    steps: ['가운데를 보고 기다리세요', '가운데 글자와 가장자리 점이 잠깐 떠요', '점의 방향, 글자 순서로 고르세요'],
    gameOver: '방향이나 글자를 틀리거나 6초 안에 답하지 못하면 끝나요.',
    record: '성공한 레벨 수, 같으면 평균 응답이 빠른 쪽',
    svg: svg(
      `${BG}<g stroke="#2a3040" stroke-width="1.5"><line x1="60" y1="40" x2="60" y2="8"/><line x1="60" y1="40" x2="92" y2="40"/><line x1="60" y1="40" x2="60" y2="72"/>` +
        `<line x1="60" y1="40" x2="28" y2="40"/><line x1="60" y1="40" x2="83" y2="17"/><line x1="60" y1="40" x2="37" y2="63"/><line x1="60" y1="40" x2="83" y2="63"/><line x1="60" y1="40" x2="37" y2="17"/></g>` +
        `<text x="60" y="46" font-size="16" font-weight="900" text-anchor="middle" fill="#f2f4f8">ㄱ</text><circle cx="88" cy="16" r="6" fill="#ffd34d"/>`,
    ),
  },
  tapspeed: {
    title: '연타 속도',
    steps: ['탭하면 3초 뒤에 시작해요', '화면 왼쪽과 오른쪽을 번갈아 탭하세요', '같은 쪽을 연속으로 탭하면 안 세요'],
    gameOver: '10초가 지나면 끝나요.',
    record: '10초 동안 인정된 탭 수, 같으면 마지막 탭이 빠른 쪽',
    svg: svg(
      `${BG}<rect x="10" y="12" width="46" height="56" rx="8" fill="#1d3a2a"/><rect x="64" y="12" width="46" height="56" rx="8" fill="#1b2b45"/>` +
        `<text x="33" y="46" font-size="18" font-weight="900" text-anchor="middle" fill="#3ddc84">L</text>` +
        `<text x="87" y="46" font-size="18" font-weight="900" text-anchor="middle" fill="#7fb2ff">R</text>` +
        `<path d="M44 22 C56 14 64 14 76 22 M70 18 L76 22 L70 26" fill="none" stroke="#ffd34d" stroke-width="2"/>`,
    ),
  },
  stroop: {
    title: '색-단어 간섭',
    steps: ['색 이름 글자가 다른 색으로 떠요', '글자 뜻 말고 글자 색을 고르세요', '갈수록 빨라지고 버튼이 섞여요'],
    gameOver: '다른 색을 고르거나 제한 시간 안에 고르지 못하면 끝나요.',
    record: '맞힌 라운드 수, 같으면 평균 판단이 빠른 쪽',
    svg: svg(
      `${BG}<text x="60" y="36" font-size="20" font-weight="900" text-anchor="middle" fill="#e5484d">파랑</text>` +
        `<rect x="12" y="50" width="22" height="18" rx="3" fill="#202633" stroke="#e5484d" stroke-width="2"/><rect x="38" y="50" width="22" height="18" rx="3" fill="#202633"/>` +
        `<rect x="64" y="50" width="22" height="18" rx="3" fill="#202633"/><rect x="90" y="50" width="22" height="18" rx="3" fill="#202633"/>` +
        `<circle cx="23" cy="59" r="4" fill="#e5484d"/><circle cx="49" cy="59" r="4" fill="#3b82f6"/><circle cx="75" cy="59" r="4" fill="#22c55e"/><circle cx="101" cy="59" r="4" fill="#eab308"/>`,
    ),
  },
  mot: {
    title: '다중 물체 추적',
    steps: ['처음에 표시된 공을 기억하세요', '공이 움직이는 동안 눈으로 따라가세요', '멈추면 표시됐던 공을 모두 누르세요'],
    gameOver: '표시되지 않은 공을 누르거나 10초 안에 다 고르지 못하면 끝나요.',
    record: '성공한 레벨 수, 같으면 평균 선택 시간이 빠른 쪽',
    svg: svg(
      `${BG}<g fill="#8b93a7"><circle cx="22" cy="22" r="7"/><circle cx="58" cy="58" r="7"/><circle cx="96" cy="24" r="7"/><circle cx="30" cy="60" r="7"/></g>` +
        `<circle cx="62" cy="24" r="7" fill="#ffd34d"/><circle cx="92" cy="58" r="7" fill="#ffd34d"/>` +
        `<path d="M70 28 L84 50" fill="none" stroke="#ffd34d" stroke-width="1.5" stroke-dasharray="3 3"/>`,
    ),
  },
  balance: {
    title: '균형',
    steps: ['폰을 기울여 공을 굴리세요(안 되면 드래그)', '공이 길을 벗어나지 않게 하세요', '초록 골에 닿으면 다음 레벨이에요'],
    gameOver: '공이 길을 벗어나거나 한 레벨에서 60초를 넘기면 끝나요.',
    record: '성공한 레벨 수, 같으면 평균 클리어 시간이 빠른 쪽',
    svg: svg(
      `${BG}<polyline points="20,10 90,28 30,48 96,70" fill="none" stroke="#202633" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/>` +
        `<polyline points="20,10 90,28 30,48 96,70" fill="none" stroke="#2f3647" stroke-width="2" stroke-dasharray="4 4"/>` +
        `<circle cx="96" cy="70" r="7" fill="#3ddc84"/><circle cx="56" cy="19" r="6" fill="#f2f4f8"/>`,
    ),
  },
};

export function guideFor(gameId: string): GameGuide | null {
  return Object.prototype.hasOwnProperty.call(GUIDES, gameId) ? GUIDES[gameId] : null;
}

export function guideSeenKey(gameId: string): string {
  return `pb:guide-seen:${gameId}`;
}
