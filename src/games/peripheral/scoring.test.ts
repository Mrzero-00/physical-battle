// 주변시야 판정·난이도 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import { checkScore } from '../../core/ranking';
import {
  DOT_SIZE,
  LETTERS,
  fixationDelay,
  flashMs,
  flashPosition,
  judgeAnswer,
  letterChoices,
  pickDirection,
  pickLetter,
  radiusRatio,
  summarizePeripheral,
  type PeripheralResult,
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
    [1, 0.35],
    [2, 0.4],
    [13, 0.95],
    [14, 0.95],
    [100, 0.95],
    [0, 0.35],
    [2.5, 0.35],
  ])('radiusRatio(%f) = %f', (l, r) => expect(radiusRatio(l)).toBeCloseTo(r, 10));

  it.each([
    [1, 300],
    [2, 280],
    [12, 80],
    [13, 80],
    [100, 80],
    [0, 300],
    [-3, 300],
    [1.2, 300],
  ])('flashMs(%f) = %i', (l, ms) => expect(flashMs(l)).toBe(ms));

  it('fixationDelay range', () => {
    expect(fixationDelay(() => 0)).toBe(600);
    expect(fixationDelay(() => 0.5)).toBe(900);
    expect(fixationDelay(() => 0.999999)).toBe(1200);
    expect(fixationDelay(() => 1)).toBe(1200);
    const rng = seeded(3);
    for (let i = 0; i < 200; i++) {
      const d = fixationDelay(rng);
      expect(d).toBeGreaterThanOrEqual(600);
      expect(d).toBeLessThanOrEqual(1200);
    }
  });

  it('pickDirection and pickLetter', () => {
    expect(pickDirection(() => 0)).toBe(0);
    expect(pickDirection(() => 1)).toBe(7);
    const rng = seeded(9);
    for (let i = 0; i < 200; i++) {
      const d = pickDirection(rng);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(8);
      const l = pickLetter(rng, 'ㄱ');
      expect(LETTERS).toContain(l);
      expect(l).not.toBe('ㄱ');
    }
  });
});

describe('flashPosition', () => {
  const viewports = [
    { width: 390, height: 700 },
    { width: 390, height: 640 },
    { width: 320, height: 480 },
    { width: 280, height: 360 },
    { width: 700, height: 390 },
  ];
  const ratios = [0.35, 0.6, 0.95, 1];

  it('stays inside the area for all 8 directions', () => {
    for (const vp of viewports) {
      for (const ratio of ratios) {
        for (let dir = 0; dir < 8; dir++) {
          const p = flashPosition(dir, ratio, vp, DOT_SIZE);
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.x + DOT_SIZE).toBeLessThanOrEqual(vp.width);
          expect(p.y + DOT_SIZE).toBeLessThanOrEqual(vp.height);
        }
      }
    }
  });

  it('dir 0 is up and goes clockwise', () => {
    const vp = { width: 390, height: 700 };
    const c = { x: vp.width / 2 - DOT_SIZE / 2, y: vp.height / 2 - DOT_SIZE / 2 };
    const at = (d: number) => flashPosition(d, 0.95, vp, DOT_SIZE);
    expect(at(0).x).toBeCloseTo(c.x);
    expect(at(0).y).toBeLessThan(c.y);
    expect(at(1).x).toBeGreaterThan(c.x);
    expect(at(1).y).toBeLessThan(c.y);
    expect(at(2).x).toBeGreaterThan(c.x);
    expect(at(2).y).toBeCloseTo(c.y);
    expect(at(3).x).toBeGreaterThan(c.x);
    expect(at(3).y).toBeGreaterThan(c.y);
    expect(at(4).x).toBeCloseTo(c.x);
    expect(at(4).y).toBeGreaterThan(c.y);
    expect(at(5).x).toBeLessThan(c.x);
    expect(at(5).y).toBeGreaterThan(c.y);
    expect(at(6).x).toBeLessThan(c.x);
    expect(at(6).y).toBeCloseTo(c.y);
    expect(at(7).x).toBeLessThan(c.x);
    expect(at(7).y).toBeLessThan(c.y);
  });

  it('larger ratio moves farther from center', () => {
    const vp = { width: 390, height: 700 };
    const near = flashPosition(2, 0.35, vp, DOT_SIZE);
    const far = flashPosition(2, 0.95, vp, DOT_SIZE);
    expect(far.x).toBeGreaterThan(near.x);
  });

  it('handles tiny viewports', () => {
    const p = flashPosition(3, 0.95, { width: 10, height: 10 }, DOT_SIZE);
    expect(p).toEqual({ x: 0, y: 0 });
  });
});

describe('letterChoices', () => {
  it('returns 4 unique letters including the answer', () => {
    const rng = seeded(42);
    for (let i = 0; i < 300; i++) {
      const answer = LETTERS[i % LETTERS.length];
      const choices = letterChoices(answer, rng);
      expect(choices).toHaveLength(4);
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain(answer);
      for (const c of choices) expect(LETTERS).toContain(c);
    }
  });

  it('works with degenerate rng', () => {
    for (const v of [0, 1, 0.5]) {
      const choices = letterChoices('ㅂ', () => v);
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain('ㅂ');
    }
  });
});

describe('judgeAnswer', () => {
  it('ignores null picks and taps under 100ms', () => {
    expect(judgeAnswer(null, 3, 500)).toEqual({ kind: 'ignore' });
    expect(judgeAnswer(3, 3, 99)).toEqual({ kind: 'ignore' });
    expect(judgeAnswer(3, 3, 99.9)).toEqual({ kind: 'ignore' });
    expect(judgeAnswer(3, 3, 100)).toEqual({ kind: 'correct', ms: 100 });
    expect(judgeAnswer(3, 3, Number.NaN)).toEqual({ kind: 'ignore' });
  });

  it('limit boundary', () => {
    expect(judgeAnswer(3, 3, 6000)).toEqual({ kind: 'correct', ms: 6000 });
    expect(judgeAnswer(3, 3, 6001)).toEqual({ kind: 'timeout' });
    expect(judgeAnswer(2, 3, 6001)).toEqual({ kind: 'timeout' });
  });

  it('wrong direction or letter', () => {
    expect(judgeAnswer(2, 3, 500)).toEqual({ kind: 'wrong' });
    expect(judgeAnswer<string>('ㄴ', 'ㄱ', 500)).toEqual({ kind: 'wrong' });
    expect(judgeAnswer<string>('ㄱ', 'ㄱ', 500)).toEqual({ kind: 'correct', ms: 500 });
  });
});

describe('summarizePeripheral', () => {
  it('rounds 0 gives null', () => {
    expect(summarizePeripheral([])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'none' });
    expect(summarizePeripheral([{ kind: 'wrong' }])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'wrong' });
    expect(summarizePeripheral([{ kind: 'timeout' }])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'timeout' });
  });

  it('averages times until the end reason', () => {
    const results: PeripheralResult[] = [{ kind: 'correct', ms: 900.4 }, { kind: 'correct', ms: 1500 }, { kind: 'wrong' }, { kind: 'correct', ms: 100 }];
    const s = summarizePeripheral(results);
    expect(s).toEqual({ rounds: 2, avgMs: 1200, bestMs: 900, endReason: 'wrong' });
    expect(checkScore('peripheral', s.rounds, s.avgMs, s.bestMs)).toBeNull();
  });
});
