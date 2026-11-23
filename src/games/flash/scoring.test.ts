// 순간 기억 판정·난이도 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import { checkScore } from '../../core/ranking';
import {
  answerLimitMs,
  digitCount,
  exposureMs,
  judgeDigit,
  makeSequence,
  summarizeFlash,
  tapWindow,
  type FlashResult,
} from './scoring';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('difficulty', () => {
  it.each([
    [1, 3],
    [2, 3],
    [3, 4],
    [4, 4],
    [5, 5],
    [14, 9],
    [15, 10],
    [20, 10],
    [100, 10],
    [0, 3],
    [2.5, 3],
  ])('digitCount(%f) = %i', (l, n) => expect(digitCount(l)).toBe(n));

  it.each([
    [1, 1200],
    [2, 1125],
    [12, 375],
    [13, 300],
    [14, 300],
    [100, 300],
    [0, 1200],
    [3.7, 1200],
  ])('exposureMs(%f) = %i', (l, ms) => expect(exposureMs(l)).toBe(ms));

  it('digitCount·exposureMs 범위', () => {
    for (let l = -5; l <= 60; l++) {
      expect(digitCount(l)).toBeGreaterThanOrEqual(3);
      expect(digitCount(l)).toBeLessThanOrEqual(10);
      expect(exposureMs(l)).toBeGreaterThanOrEqual(300);
      expect(exposureMs(l)).toBeLessThanOrEqual(1200);
    }
  });

  it.each([
    [3, 6000],
    [10, 13000],
  ])('answerLimitMs(%i) = %i', (n, ms) => expect(answerLimitMs(n)).toBe(ms));
});

describe('makeSequence', () => {
  it('길이·범위·연속 같은 숫자 없음', () => {
    for (let seed = 1; seed < 300; seed++) {
      const n = 3 + (seed % 8);
      const seq = makeSequence(n, seeded(seed));
      expect(seq).toHaveLength(n);
      for (let i = 0; i < seq.length; i++) {
        expect(Number.isInteger(seq[i])).toBe(true);
        expect(seq[i]).toBeGreaterThanOrEqual(0);
        expect(seq[i]).toBeLessThanOrEqual(9);
        if (i > 0) expect(seq[i]).not.toBe(seq[i - 1]);
      }
    }
  });

  it('극단 rng에서도 연속 같은 숫자 없음', () => {
    for (const v of [0, 0.999999, 1, -1, Number.NaN]) {
      const seq = makeSequence(10, () => v);
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
      for (const d of seq) {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(9);
      }
    }
  });

  it('같은 rng면 같은 결과', () => {
    expect(makeSequence(8, seeded(3))).toEqual(makeSequence(8, seeded(3)));
  });
});

describe('judge', () => {
  it('judgeDigit', () => {
    const seq = [3, 1, 4];
    expect(judgeDigit(seq, 0, 3)).toBe('correct');
    expect(judgeDigit(seq, 1, 1)).toBe('correct');
    expect(judgeDigit(seq, 2, 4)).toBe('complete');
    expect(judgeDigit(seq, 1, 4)).toBe('wrong');
    expect(judgeDigit(seq, 3, 4)).toBe('wrong');
    expect(judgeDigit(seq, -1, 3)).toBe('wrong');
  });

  it('tapWindow 경계', () => {
    expect(tapWindow(1000, 1099, 6000)).toBe('ignore');
    expect(tapWindow(1000, 1100, 6000)).toBe('ok');
    expect(tapWindow(1000, 7000, 6000)).toBe('ok');
    expect(tapWindow(1000, 7001, 6000)).toBe('timeout');
    expect(tapWindow(1000, Number.NaN, 6000)).toBe('ignore');
  });
});

describe('summarizeFlash', () => {
  it('레벨별 입력 시간', () => {
    const run: FlashResult[] = [{ kind: 'clear', ms: 1500.4 }, { kind: 'clear', ms: 900.6 }, { kind: 'wrong' }, { kind: 'clear', ms: 100 }];
    const s = summarizeFlash(run);
    expect(s).toEqual({ rounds: 2, avgMs: 1201, bestMs: 901, endReason: 'wrong' });
    expect(checkScore('flash', s.rounds, s.avgMs, s.bestMs)).toBeNull();
  });

  it('rounds 0이면 null', () => {
    expect(summarizeFlash([])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'none' });
    expect(summarizeFlash([{ kind: 'timeout' }])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'timeout' });
    expect(summarizeFlash([{ kind: 'wrong' }])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'wrong' });
  });
});
