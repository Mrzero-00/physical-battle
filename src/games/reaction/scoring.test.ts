// 반응속도 판정·난이도 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import {
  BUTTON_SIZE,
  EDGE_MARGIN,
  HUD_HEIGHT,
  isHit,
  judgeTap,
  pickDelay,
  randomPosition,
  summarizeRun,
  timeLimitFor,
} from './scoring';

describe('timeLimitFor', () => {
  it.each([
    [1, 1000],
    [2, 950],
    [22, 341],
    [45, 105],
    [46, 100],
    [100, 100],
  ])('%i라운드는 %ims', (round, expected) => {
    expect(timeLimitFor(round)).toBe(expected);
  });

  it('라운드가 올라가면 제한 시간이 늘지 않는다', () => {
    for (let n = 1; n < 200; n++) expect(timeLimitFor(n + 1)).toBeLessThanOrEqual(timeLimitFor(n));
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

  it('최소 제한 시간 100ms에서는 정확히 100ms만 성공', () => {
    expect(judgeTap(0, 100, 100, true)).toEqual({ kind: 'hit', ms: 100 });
    expect(judgeTap(0, 101, 100, true)).toEqual({ kind: 'timeout' });
  });
});

describe('summarizeRun', () => {
  it('성공 0회면 라운드 0, ms는 null', () => {
    expect(summarizeRun([{ kind: 'timeout' }])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'timeout' });
  });

  it('성공 라운드만 집계하고 첫 실패를 종료 사유로 쓴다', () => {
    expect(
      summarizeRun([
        { kind: 'hit', ms: 300 },
        { kind: 'hit', ms: 250 },
        { kind: 'hit', ms: 201 },
        { kind: 'miss' },
      ]),
    ).toEqual({ rounds: 3, avgMs: 250, bestMs: 201, endReason: 'miss' });
  });
});
