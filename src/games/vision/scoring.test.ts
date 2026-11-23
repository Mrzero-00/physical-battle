// 동체시력 판정·난이도 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import {
  answerFor,
  ballSizeFor,
  digitsFor,
  exposureFor,
  fontSizeFor,
  judge,
  makeChoices,
  pathFor,
  pathKindsFor,
  pointAt,
  rangeFor,
  summarizeRun,
  type VisionJudgement,
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
    [1, 1200],
    [2, 1080],
    [6, 709],
    [10, 465],
    [15, 275],
    [16, 250],
    [100, 250],
    [0, 1200],
    [1.5, 1200],
  ])('exposureFor(%f) = %i', (r, ms) => expect(exposureFor(r)).toBe(ms));

  it.each([
    [1, 56],
    [5, 44],
    [14, 17],
    [15, 14],
    [100, 14],
  ])('fontSizeFor(%i) = %i', (r, px) => expect(fontSizeFor(r)).toBe(px));

  it('ballSizeFor', () => {
    expect(ballSizeFor(1)).toBe(84);
    expect(ballSizeFor(15)).toBe(36);
  });

  it('digitsFor', () => {
    expect(digitsFor(5)).toBe(1);
    expect(digitsFor(6)).toBe(2);
  });

  it('pathKindsFor', () => {
    expect(pathKindsFor(3)).toEqual(['ltr']);
    expect(pathKindsFor(4)).toEqual(['ltr', 'rtl']);
    expect(pathKindsFor(7)).toEqual(['ltr', 'rtl']);
    expect(pathKindsFor(8)).toEqual(['ltr', 'rtl', 'diag-down', 'diag-up']);
  });
});

describe('path', () => {
  const area = { width: 390, height: 500 };

  it('가로 경로는 화면 밖에서 화면 밖으로', () => {
    const p = pathFor(1, () => 0.4, area, 84);
    expect(p.kind).toBe('ltr');
    expect(p.from.x).toBe(-84);
    expect(p.to.x).toBe(390);
    expect(p.from.y).toBe(p.to.y);
    expect(p.from.y).toBeGreaterThanOrEqual(0);
    expect(p.from.y).toBeLessThanOrEqual(500 - 84);
  });

  it('대각선은 높이 차이가 영역의 30% 이상', () => {
    for (let seed = 1; seed < 40; seed++) {
      const p = pathFor(10, seeded(seed), area, 36);
      expect(p.from.y).toBeGreaterThanOrEqual(0);
      expect(p.to.y).toBeLessThanOrEqual(500 - 36);
      if (p.kind.startsWith('diag')) expect(Math.abs(p.to.y - p.from.y)).toBeGreaterThanOrEqual(Math.round((500 - 36) * 0.3));
    }
  });

  it('pointAt', () => {
    const p = { kind: 'ltr' as const, from: { x: -84, y: 100 }, to: { x: 390, y: 300 } };
    expect(pointAt(p, 0, 1000)).toEqual({ x: -84, y: 100 });
    expect(pointAt(p, 500, 1000)).toEqual({ x: 153, y: 200 });
    expect(pointAt(p, 1000, 1000)).toEqual({ x: 390, y: 300 });
    expect(pointAt(p, 5000, 1000)).toEqual({ x: 390, y: 300 });
    expect(pointAt(p, -10, 1000)).toEqual({ x: -84, y: 100 });
  });
});

describe('answers & choices', () => {
  it.each([1, 8, 9, 10, 11, 47, 99])('answer %i의 보기는 4개·서로 다름·정답 포함·같은 범위', (answer) => {
    const digits = answer >= 10 ? 2 : 1;
    const [lo, hi] = rangeFor(digits);
    for (let seed = 1; seed < 30; seed++) {
      const c = makeChoices(answer, digits, seeded(seed));
      expect(c).toHaveLength(4);
      expect(new Set(c).size).toBe(4);
      expect(c).toContain(answer);
      for (const n of c) {
        expect(n).toBeGreaterThanOrEqual(lo);
        expect(n).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('같은 rng면 같은 결과', () => {
    expect(makeChoices(47, 2, seeded(7))).toEqual(makeChoices(47, 2, seeded(7)));
  });

  it('1자리 8의 보기에 0이 없다', () => {
    for (let seed = 1; seed < 30; seed++) expect(makeChoices(8, 1, seeded(seed))).not.toContain(0);
  });

  it('answerFor는 이전 값과 겹치지 않고 범위 안', () => {
    for (let seed = 1; seed < 50; seed++) {
      const rng = seeded(seed);
      const prev = answerFor(3, rng, null);
      const next = answerFor(3, () => (prev - 1) / 9, prev);
      expect(next).not.toBe(prev);
      expect(next).toBeGreaterThanOrEqual(1);
      expect(next).toBeLessThanOrEqual(9);
    }
    expect(answerFor(3, () => 0.9999, 9)).toBe(1);
    const two = answerFor(6, () => 0.5, null);
    expect(two).toBeGreaterThanOrEqual(10);
    expect(two).toBeLessThanOrEqual(99);
  });
});

describe('judge & summarize', () => {
  it('judge', () => {
    expect(judge(null, 5, 300, 5000)).toEqual({ kind: 'ignore' });
    expect(judge(5, 5, 99, 5000)).toEqual({ kind: 'ignore' });
    expect(judge(5, 5, Number.NaN, 5000)).toEqual({ kind: 'ignore' });
    expect(judge(5, 5, 100, 5000)).toEqual({ kind: 'correct', ms: 100 });
    expect(judge(5, 5, 5000, 5000)).toEqual({ kind: 'correct', ms: 5000 });
    expect(judge(5, 5, 5001, 5000)).toEqual({ kind: 'timeout' });
    expect(judge(6, 5, 300, 5000)).toEqual({ kind: 'wrong' });
  });

  it('summarizeRun', () => {
    const run: VisionJudgement[] = [
      { kind: 'correct', ms: 400 },
      { kind: 'correct', ms: 300 },
      { kind: 'ignore' },
      { kind: 'correct', ms: 500 },
      { kind: 'wrong' },
    ];
    const s = summarizeRun(run);
    expect(s).toEqual({ rounds: 3, avgMs: 400, bestMs: 300, endReason: 'wrong' });
    expect(s.bestMs as number).toBeLessThanOrEqual(s.avgMs as number);
    expect(summarizeRun([{ kind: 'ignore' }])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'none' });
    expect(summarizeRun([{ kind: 'timeout' }]).endReason).toBe('timeout');
  });
});
