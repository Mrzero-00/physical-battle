// 색-단어 간섭 판정·난이도 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import { checkScore } from '../../core/ranking';
import { buttonOrder, COLOR_IDS, congruentRatio, judgeStroop, limitMs, makeTrial, shuffleButtons, summarizeStroop, type StroopJudgement } from './scoring';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('difficulty', () => {
  it.each([
    [1, 2000],
    [2, 1930],
    [21, 600],
    [22, 600],
    [100, 600],
    [0, 2000],
    [1.5, 2000],
  ])('limitMs(%f) = %i', (r, ms) => expect(limitMs(r)).toBe(ms));

  it.each([
    [1, 0.5],
    [2, 0.45],
    [9, 0.1],
    [10, 0.1],
    [50, 0.1],
    [0, 0.5],
  ])('congruentRatio(%i) = %f', (r, v) => expect(congruentRatio(r)).toBeCloseTo(v, 10));

  it('shuffleButtons는 r10부터', () => {
    expect(shuffleButtons(9)).toBe(false);
    expect(shuffleButtons(10)).toBe(true);
  });
});

describe('makeTrial', () => {
  it('일치 판정은 congruentRatio 경계를 따른다', () => {
    const seq = (...v: number[]) => {
      let i = 0;
      return () => v[i++ % v.length];
    };
    expect(makeTrial(1, seq(0, 0.49, 0))).toEqual({ word: 'red', ink: 'red' });
    const t = makeTrial(1, seq(0, 0.5, 0));
    expect(t.ink).toBe('red');
    expect(t.word).not.toBe('red');
    expect(makeTrial(9, seq(0.3, 0.099, 0)).word).toBe('blue');
    expect(makeTrial(9, seq(0.3, 0.1, 0)).word).not.toBe('blue');
  });

  it('일치 비율이 기대와 비슷하다', () => {
    const rng = seeded(42);
    const n = 4000;
    let r1 = 0;
    let r10 = 0;
    for (let i = 0; i < n; i++) {
      const a = makeTrial(1, rng);
      if (a.word === a.ink) r1++;
      const b = makeTrial(10, rng);
      if (b.word === b.ink) r10++;
      expect(COLOR_IDS).toContain(a.ink);
      expect(COLOR_IDS).toContain(a.word);
    }
    expect(r1 / n).toBeGreaterThan(0.45);
    expect(r1 / n).toBeLessThan(0.55);
    expect(r10 / n).toBeGreaterThan(0.07);
    expect(r10 / n).toBeLessThan(0.13);
  });
});

describe('buttonOrder', () => {
  it('r9까지는 고정 순서', () => {
    expect(buttonOrder(9, () => 0)).toEqual([...COLOR_IDS]);
  });
  it('r10부터는 섞는다', () => {
    const order = buttonOrder(10, () => 0);
    expect(order).not.toEqual([...COLOR_IDS]);
    expect([...order].sort()).toEqual([...COLOR_IDS].sort());
  });
});

describe('judgeStroop', () => {
  const trial = { word: 'red' as const, ink: 'blue' as const };
  it('ignore 경계', () => {
    expect(judgeStroop(trial, null, 500, 2000, 'blue')).toEqual({ kind: 'ignore' });
    expect(judgeStroop(trial, 1000, 1500, 2000, null)).toEqual({ kind: 'ignore' });
    expect(judgeStroop(trial, 1000, 1099, 2000, 'blue')).toEqual({ kind: 'ignore' });
    expect(judgeStroop(trial, 1000, 1100, 2000, 'blue')).toEqual({ kind: 'hit', ms: 100 });
  });
  it('limit 경계·오답', () => {
    expect(judgeStroop(trial, 1000, 3000, 2000, 'blue')).toEqual({ kind: 'hit', ms: 2000 });
    expect(judgeStroop(trial, 1000, 3001, 2000, 'blue')).toEqual({ kind: 'timeout' });
    expect(judgeStroop(trial, 1000, 1500, 2000, 'red')).toEqual({ kind: 'wrong' });
  });
});

describe('summarizeStroop', () => {
  it('요약', () => {
    const run: StroopJudgement[] = [{ kind: 'hit', ms: 700 }, { kind: 'ignore' }, { kind: 'hit', ms: 500 }, { kind: 'wrong' }];
    const s = summarizeStroop(run);
    expect(s).toEqual({ rounds: 2, avgMs: 600, bestMs: 500, endReason: 'wrong' });
    expect(checkScore('stroop', s.rounds, s.avgMs, s.bestMs)).toBeNull();
  });
  it('rounds 0이면 null', () => {
    expect(summarizeStroop([])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'none' });
    expect(summarizeStroop([{ kind: 'timeout' }])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'timeout' });
  });
});
