// 선택 반응 판정·난이도 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import { checkScore } from '../../core/ranking';
import { judgeGoNoGo, limitMs, noGoHoldMs, pickDelay, pickKind, redRatio, summarizeGoNoGo, type GoNoGoJudgement } from './scoring';

describe('difficulty', () => {
  it.each([
    [1, 900],
    [2, 875],
    [23, 350],
    [24, 350],
    [100, 350],
    [0, 900],
    [2.5, 900],
  ])('limitMs(%f) = %i', (r, ms) => expect(limitMs(r)).toBe(ms));

  it.each([
    [1, 0],
    [2, 0],
    [3, 0.15],
    [4, 0.165],
    [23, 0.45],
    [30, 0.45],
  ])('redRatio(%i) = %f', (r, v) => expect(redRatio(r)).toBeCloseTo(v, 10));

  it('noGoHoldMs = limit + 150', () => {
    expect(noGoHoldMs(1)).toBe(1050);
    expect(noGoHoldMs(24)).toBe(500);
  });

  it('pickDelay 500~1200', () => {
    expect(pickDelay(() => 0)).toBe(500);
    expect(pickDelay(() => 0.5)).toBe(850);
    expect(pickDelay(() => 1)).toBe(1200);
  });
});

describe('pickKind', () => {
  it('r<3은 항상 go', () => {
    expect(pickKind(1, () => 0, 0)).toBe('go');
    expect(pickKind(2, () => 0, 0)).toBe('go');
  });
  it('redStreak 2면 go', () => {
    expect(pickKind(10, () => 0, 2)).toBe('go');
    expect(pickKind(10, () => 0, 1)).toBe('nogo');
  });
  it('rng < redRatio면 nogo', () => {
    expect(pickKind(3, () => 0.149, 0)).toBe('nogo');
    expect(pickKind(3, () => 0.15, 0)).toBe('go');
  });
});

describe('judgeGoNoGo', () => {
  it('ignore 조건', () => {
    expect(judgeGoNoGo('go', null, 500, 900, true)).toEqual({ kind: 'ignore' });
    expect(judgeGoNoGo('go', 0, 500, 900, false)).toEqual({ kind: 'ignore' });
    expect(judgeGoNoGo('nogo', 0, 500, 900, false)).toEqual({ kind: 'ignore' });
    expect(judgeGoNoGo('go', 1000, 1099, 900, true)).toEqual({ kind: 'ignore' });
  });
  it('go 경계', () => {
    expect(judgeGoNoGo('go', 1000, 1100, 900, true)).toEqual({ kind: 'hit', ms: 100 });
    expect(judgeGoNoGo('go', 1000, 1900, 900, true)).toEqual({ kind: 'hit', ms: 900 });
    expect(judgeGoNoGo('go', 1000, 1901, 900, true)).toEqual({ kind: 'timeout' });
  });
  it('nogo에 hit하면 no-go-tap', () => {
    expect(judgeGoNoGo('nogo', 1000, 1300, 900, true)).toEqual({ kind: 'no-go-tap' });
  });
});

describe('summarizeGoNoGo', () => {
  it('rounds = go+nogo 성공, avg·best = go 반응', () => {
    const run: GoNoGoJudgement[] = [{ kind: 'hit', ms: 400 }, { kind: 'ignore' }, { kind: 'hit', ms: 300 }, { kind: 'hold' }, { kind: 'hit', ms: 500 }, { kind: 'no-go-tap' }];
    const s = summarizeGoNoGo(run);
    expect(s).toEqual({ rounds: 4, avgMs: 400, bestMs: 300, endReason: 'no-go-tap' });
    expect(checkScore('gonogo', s.rounds, s.avgMs, s.bestMs)).toBeNull();
  });
  it('rounds 0이면 null', () => {
    expect(summarizeGoNoGo([])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'none' });
    expect(summarizeGoNoGo([{ kind: 'timeout' }])).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'timeout' });
  });
});
