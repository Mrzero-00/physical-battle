// 타이밍 예측 판정·난이도 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import { checkScore } from '../../core/ranking';
import {
  ballX,
  isOccluded,
  judgeTiming,
  occlusion,
  progressAt,
  summarizeTiming,
  timeoutAt,
  toleranceMs,
  travelMs,
  type TimingJudgement,
} from './scoring';

describe('difficulty', () => {
  it.each([
    [1, 0, 1440],
    [1, 0.5, 1600],
    [1, 1, 1760],
    [2, 0.5, 1520],
    [15, 0.5, 480],
    [16, 0.5, 450],
    [100, 0.5, 450],
    [0, 0.5, 1600],
    [2.5, 0.5, 1600],
    [1, 2, 1760],
    [1, -1, 1440],
    [1, Number.NaN, 1440],
  ])('travelMs(%f, rng=%f) = %i', (r, v, ms) => expect(travelMs(r, () => v)).toBe(ms));

  it.each([
    [1, 120],
    [2, 114],
    [15, 36],
    [16, 30],
    [17, 30],
    [100, 30],
    [0, 120],
    [-3, 120],
    [1.5, 120],
  ])('toleranceMs(%f) = %i', (r, ms) => expect(toleranceMs(r)).toBe(ms));

  it.each([
    [1, 0],
    [5, 0],
    [6, 0.1],
    [7, 0.2],
    [10, 0.5],
    [11, 0.5],
    [50, 0.5],
    [0, 0],
    [6.5, 0],
  ])('occlusion(%f) = %f', (r, v) => expect(occlusion(r)).toBe(v));
});

describe('motion', () => {
  it('progressAt와 ballX는 시각으로 계산된다', () => {
    expect(progressAt(1000, 2000, 1000)).toBe(0);
    expect(progressAt(1000, 2000, 1500)).toBe(0.5);
    expect(progressAt(1000, 2000, 2000)).toBe(1);
    expect(progressAt(1000, 1000, 1200)).toBe(1);
    expect(ballX(0, 20, 300)).toBe(20);
    expect(ballX(1, 20, 300)).toBe(300);
    expect(ballX(0.5, 20, 300)).toBe(160);
  });

  it('isOccluded는 선 직전 구간만 가린다', () => {
    expect(isOccluded(0.95, 0)).toBe(false);
    expect(isOccluded(0.89, 0.1)).toBe(false);
    expect(isOccluded(0.9, 0.1)).toBe(true);
    expect(isOccluded(0.99, 0.1)).toBe(true);
    expect(isOccluded(1, 0.1)).toBe(false);
    expect(isOccluded(0.49, 0.5)).toBe(false);
    expect(isOccluded(0.5, 0.5)).toBe(true);
  });

  it('timeoutAt = crossAt + tol + 30', () => {
    expect(timeoutAt(2000, 120)).toBe(2150);
  });
});

describe('judgeTiming', () => {
  const start = 1000;
  const cross = 2600;

  it('시작 후 100ms 미만 탭은 무시', () => {
    expect(judgeTiming(start, cross, start + 99, 120)).toEqual({ kind: 'ignore' });
    expect(judgeTiming(start, cross, start + 100, 120)).toEqual({ kind: 'off-timing' });
    expect(judgeTiming(start, start + 150, start + 99, 120)).toEqual({ kind: 'ignore' });
    expect(judgeTiming(start, start + 150, start + 100, 120)).toEqual({ kind: 'hit', errMs: -50 });
    expect(judgeTiming(start, cross, Number.NaN, 120)).toEqual({ kind: 'ignore' });
  });

  it('허용 오차 ±1 경계', () => {
    expect(judgeTiming(start, cross, cross - 120, 120)).toEqual({ kind: 'hit', errMs: -120 });
    expect(judgeTiming(start, cross, cross - 121, 120)).toEqual({ kind: 'off-timing' });
    expect(judgeTiming(start, cross, cross + 120, 120)).toEqual({ kind: 'hit', errMs: 120 });
    expect(judgeTiming(start, cross, cross + 121, 120)).toEqual({ kind: 'off-timing' });
    expect(judgeTiming(start, cross, cross, 30)).toEqual({ kind: 'hit', errMs: 0 });
    expect(judgeTiming(start, cross, cross + 30, 30)).toEqual({ kind: 'hit', errMs: 30 });
    expect(judgeTiming(start, cross, cross + 31, 30)).toEqual({ kind: 'off-timing' });
  });
});

describe('summarizeTiming', () => {
  it('평균 절대 오차와 최소 오차', () => {
    const run: TimingJudgement[] = [
      { kind: 'hit', errMs: -40.4 },
      { kind: 'ignore' },
      { kind: 'hit', errMs: 10.6 },
      { kind: 'hit', errMs: 70 },
      { kind: 'off-timing' },
      { kind: 'hit', errMs: 1 },
    ];
    const s = summarizeTiming(run);
    expect(s).toEqual({ rounds: 3, avgMs: 40, bestMs: 11, endReason: 'off-timing' });
    expect(checkScore('timing', s.rounds, s.avgMs, s.bestMs)).toBeNull();
  });

  it('완벽한 탭은 0ms도 기록 규칙을 통과', () => {
    const s = summarizeTiming([{ kind: 'hit', errMs: 0 }, { kind: 'timeout' }]);
    expect(s).toEqual({ rounds: 1, avgMs: 0, bestMs: 0, endReason: 'timeout' });
    expect(checkScore('timing', s.rounds, s.avgMs, s.bestMs)).toBeNull();
  });

  it('rounds 0이면 null', () => {
    expect(summarizeTiming([])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'none' });
    expect(summarizeTiming([{ kind: 'timeout' }])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'timeout' });
    expect(summarizeTiming([{ kind: 'off-timing' }])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'off-timing' });
  });
});
