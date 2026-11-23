// 반응속도 판정·난이도 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import {
  advance,
  announcementFor,
  BUTTON_SIZE,
  burstLabel,
  burstSizeFor,
  EDGE_MARGIN,
  HUD_HEIGHT,
  isHit,
  judgeTap,
  MIN_CENTER_GAP,
  nextLimit,
  pickDelay,
  randomPosition,
  randomPositionAwayFrom,
  summarizeRun,
  timeLimitFor,
  type Judgement,
  type Progress,
} from './scoring';

describe('timeLimitFor', () => {
  it.each([
    [1, 1000],
    [2, 900],
    [4, 729],
    [5, 656],
    [7, 531],
    [8, 478],
    [10, 378],
    [11, 328],
    [15, 128],
    [16, 100],
    [17, 100],
    [100, 100],
  ])('%i라운드는 %ims', (round, expected) => {
    expect(timeLimitFor(round)).toBe(expected);
  });

  it('라운드가 올라가면 제한 시간이 늘지 않는다', () => {
    for (let n = 1; n < 200; n++) expect(timeLimitFor(n + 1)).toBeLessThanOrEqual(timeLimitFor(n));
  });
});

describe('nextLimit', () => {
  it.each([
    [1000, 900],
    [729, 656],
    [478, 428],
    [314, 264],
    [130, 100],
    [128, 100],
    [100, 100],
  ])('%ims 다음은 %ims', (limit, expected) => {
    expect(nextLimit(limit)).toBe(expected);
  });
});

describe('burstSizeFor', () => {
  it.each([
    [1, 1],
    [4, 1],
    [5, 2],
    [7, 2],
    [8, 3],
    [10, 3],
    [11, 4],
    [15, 4],
    [16, 4],
    [17, 4],
    [100, 4],
  ])('%i라운드는 버튼 %i개', (round, expected) => {
    expect(burstSizeFor(round)).toBe(expected);
  });
});

describe('advance', () => {
  const hit: Judgement = { kind: 'hit', ms: 200 };
  it.each([
    [{ round: 4, index: 0 }, { kind: 'next-round', round: 5, index: 0 }],
    [{ round: 5, index: 0 }, { kind: 'next-button', round: 5, index: 1 }],
    [{ round: 5, index: 1 }, { kind: 'next-round', round: 6, index: 0 }],
    [{ round: 11, index: 3 }, { kind: 'next-round', round: 12, index: 0 }],
  ])('%j + hit → %j', (progress, expected) => {
    expect(advance(progress, hit)).toEqual(expected);
  });

  it.each<Judgement>([{ kind: 'timeout' }, { kind: 'miss' }, { kind: 'false-start' }])('실패 %j는 over', (j) => {
    expect(advance({ round: 1, index: 0 }, j)).toEqual({ kind: 'over' });
    expect(advance({ round: 11, index: 2 }, j)).toEqual({ kind: 'over' });
  });

  it('hit만 이어 가면 5라운드에서 처음으로 연속 버튼이 나온다', () => {
    let p: Progress = { round: 1, index: 0 };
    let firstBurst: number | null = null;
    for (let i = 0; i < 20 && firstBurst === null; i++) {
      const next = advance(p, hit);
      if (next.kind === 'over') throw new Error('unexpected');
      if (next.kind === 'next-button') firstBurst = next.round;
      p = { round: next.round, index: next.index };
    }
    expect(firstBurst).toBe(5);
  });
});

describe('announcementFor', () => {
  it.each([1, 4, 6, 7, 10, 12, 16, 100, 0, -3, 2.5, Number.NaN])('%f라운드는 안내 없음', (round) => {
    expect(announcementFor(round)).toBeNull();
  });

  it.each([
    [5, 2],
    [8, 3],
    [11, 4],
  ])('%i라운드는 %i개 안내', (round, size) => {
    expect(announcementFor(round)).toEqual({
      size,
      title: `이제 ${size}개씩 버튼이 나옵니다!`,
      sub: '누르자마자 다음 버튼이 떠요',
    });
  });
});

describe('burstLabel', () => {
  it.each([
    [4, 0, ''],
    [5, 0, '1/2'],
    [5, 1, '2/2'],
    [11, 2, '3/4'],
  ])('(%i, %i) → "%s"', (round, index, expected) => {
    expect(burstLabel(round, index)).toBe(expected);
  });
});

describe('randomPositionAwayFrom', () => {
  const viewport = { width: 390, height: 844 };
  const margin = { top: HUD_HEIGHT + EDGE_MARGIN, right: EDGE_MARGIN, bottom: EDGE_MARGIN, left: EDGE_MARGIN };
  const center = (p: { x: number; y: number }) => ({ x: p.x + BUTTON_SIZE / 2, y: p.y + BUTTON_SIZE / 2 });
  const inside = (p: { x: number; y: number }) =>
    p.x >= 16 && p.y >= 64 + 16 && p.x + BUTTON_SIZE <= 390 - 16 && p.y + BUTTON_SIZE <= 844 - 16;

  it.each([0, 0.5, 0.999])('rng %f가 늘 앞 버튼 자리를 주면 꼭짓점으로 피한다', (r) => {
    const prev = randomPosition(() => r, viewport, BUTTON_SIZE, margin);
    const p = randomPositionAwayFrom(() => r, viewport, BUTTON_SIZE, margin, prev, MIN_CENTER_GAP);
    expect(inside(p)).toBe(true);
    const a = center(p);
    const b = center(prev);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(MIN_CENTER_GAP);
  });

  it('앞 버튼이 없으면 randomPosition과 같다', () => {
    expect(randomPositionAwayFrom(() => 0.3, viewport, BUTTON_SIZE, margin, null, MIN_CENTER_GAP)).toEqual(
      randomPosition(() => 0.3, viewport, BUTTON_SIZE, margin),
    );
  });

  it('앞 버튼이 멀리 있으면 첫 후보를 그대로 쓴다', () => {
    const first = randomPosition(() => 0, viewport, BUTTON_SIZE, margin);
    expect(randomPositionAwayFrom(() => 0, viewport, BUTTON_SIZE, margin, { x: 300, y: 700 }, MIN_CENTER_GAP)).toEqual(first);
  });
});

describe('pickDelay', () => {
  it('rng 0이면 600ms', () => {
    expect(pickDelay(() => 0)).toBe(600);
  });

  it('rng 0.999이면 1800ms 이하', () => {
    const delay = pickDelay(() => 0.999);
    expect(delay).toBeLessThanOrEqual(1800);
    expect(delay).toBeGreaterThanOrEqual(600);
  });
});

describe('randomPosition', () => {
  const viewport = { width: 390, height: 844 };
  const margin = { top: HUD_HEIGHT + EDGE_MARGIN, right: EDGE_MARGIN, bottom: EDGE_MARGIN, left: EDGE_MARGIN };

  it.each([0, 0.5, 0.999])('rng %f에서 버튼 전체가 배치 영역 안에 있다', (r) => {
    const p = randomPosition(() => r, viewport, BUTTON_SIZE, margin);
    expect(p.x).toBeGreaterThanOrEqual(16);
    expect(p.y).toBeGreaterThanOrEqual(64 + 16);
    expect(p.x + BUTTON_SIZE).toBeLessThanOrEqual(390 - 16);
    expect(p.y + BUTTON_SIZE).toBeLessThanOrEqual(844 - 16);
  });
});

describe('isHit', () => {
  const rect = { x: 100, y: 200, width: 72, height: 72 };

  it('경계 안쪽은 맞음', () => {
    expect(isHit({ x: 100, y: 200 }, rect)).toBe(true);
    expect(isHit({ x: 172, y: 272 }, rect)).toBe(true);
  });

  it('경계 바깥 1px은 빗나감', () => {
    expect(isHit({ x: 99, y: 236 }, rect)).toBe(false);
    expect(isHit({ x: 173, y: 236 }, rect)).toBe(false);
    expect(isHit({ x: 136, y: 199 }, rect)).toBe(false);
    expect(isHit({ x: 136, y: 273 }, rect)).toBe(false);
  });
});

describe('judgeTap', () => {
  it('버튼 표시 전 탭은 부정출발', () => {
    expect(judgeTap(null, 500, 1000, false)).toEqual({ kind: 'false-start' });
  });

  it('99ms는 부정출발, 100ms는 성공', () => {
    expect(judgeTap(1000, 1099, 1000, true)).toEqual({ kind: 'false-start' });
    expect(judgeTap(1000, 1100, 1000, true)).toEqual({ kind: 'hit', ms: 100 });
  });

  it('제한 시간 정각은 성공, 1ms 넘으면 시간 초과', () => {
    expect(judgeTap(1000, 1500, 500, true)).toEqual({ kind: 'hit', ms: 500 });
    expect(judgeTap(1000, 1501, 500, true)).toEqual({ kind: 'timeout' });
  });

  it('버튼 밖 탭은 빗나감', () => {
    expect(judgeTap(1000, 1300, 1000, false)).toEqual({ kind: 'miss' });
  });

  it('최소 제한 시간 100ms에서는 정확히 100ms만 통과한다', () => {
    expect(judgeTap(0, 100, 100, true)).toEqual({ kind: 'hit', ms: 100 });
    expect(judgeTap(0, 101, 100, true)).toEqual({ kind: 'timeout' });
  });
});

describe('summarizeRun', () => {
  it('성공 0회면 라운드 0, ms는 null', () => {
    expect(summarizeRun([{ kind: 'timeout' }])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'timeout' });
  });

  const hits = (...ms: number[]): Judgement[] => ms.map((m) => ({ kind: 'hit', ms: m }));

  it('1~4라운드는 탭 1번이 1라운드다', () => {
    expect(summarizeRun([...hits(300, 250, 201), { kind: 'miss' }])).toEqual({
      rounds: 3,
      avgMs: 250,
      bestMs: 201,
      endReason: 'miss',
    });
  });

  it('5라운드 연속 버튼 중 1개만 맞히면 그 라운드는 세지 않는다', () => {
    expect(summarizeRun([...hits(300, 300, 300, 300, 200), { kind: 'timeout' }])).toEqual({
      rounds: 4,
      avgMs: 280,
      bestMs: 200,
      endReason: 'timeout',
    });
  });

  it('5라운드 버튼 2개를 모두 맞히면 5라운드 통과', () => {
    expect(summarizeRun([...hits(300, 300, 300, 300, 200, 220), { kind: 'miss' }]).rounds).toBe(5);
  });

  it('4라운드 뒤 부정출발이면 4라운드', () => {
    expect(summarizeRun([...hits(300, 300, 300, 300), { kind: 'false-start' }]).rounds).toBe(4);
  });
});
