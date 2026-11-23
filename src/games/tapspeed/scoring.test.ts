// 연타 속도 탭 인정·요약 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import { checkScore } from '../../core/ranking';
import { acceptTap, createTapState, remainingMs, sideOf, summarizeTaps, type Side, type TapState } from './scoring';

const GO = 5000;

function run(taps: Array<[number, Side]>, goAt = GO): TapState {
  let state = createTapState(goAt);
  for (const [t, side] of taps) state = acceptTap(state, { t: goAt + t, side }).state;
  return state;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('acceptTap', () => {
  it('rejects taps before goAt+100 and after goAt+10000', () => {
    const s = createTapState(GO);
    expect(acceptTap(s, { t: GO + 99, side: 'left' }).accepted).toBe(false);
    expect(acceptTap(s, { t: GO + 99.9, side: 'left' }).accepted).toBe(false);
    expect(acceptTap(s, { t: GO - 500, side: 'left' }).accepted).toBe(false);
    expect(acceptTap(s, { t: GO + 100, side: 'left' }).accepted).toBe(true);
    expect(acceptTap(s, { t: GO + 10000, side: 'right' }).accepted).toBe(true);
    expect(acceptTap(s, { t: GO + 10000.1, side: 'right' }).accepted).toBe(false);
    expect(acceptTap(s, { t: GO + 10001, side: 'right' }).accepted).toBe(false);
  });

  it('accepts the first tap on either side', () => {
    const s = createTapState(GO);
    expect(acceptTap(s, { t: GO + 200, side: 'left' }).state).toMatchObject({ count: 1, lastSide: 'left', minGap: null });
    expect(acceptTap(s, { t: GO + 200, side: 'right' }).state).toMatchObject({ count: 1, lastSide: 'right', minGap: null });
  });

  it('rejects the same side as the last accepted tap', () => {
    const s = run([[200, 'left']]);
    const r = acceptTap(s, { t: GO + 400, side: 'left' });
    expect(r.accepted).toBe(false);
    expect(r.state).toBe(s);
    expect(acceptTap(s, { t: GO + 400, side: 'right' }).accepted).toBe(true);
  });

  it('rejects gaps under 40ms from the last accepted tap', () => {
    const s = run([[200, 'left']]);
    expect(acceptTap(s, { t: GO + 239, side: 'right' }).accepted).toBe(false);
    expect(acceptTap(s, { t: GO + 239.9, side: 'right' }).accepted).toBe(false);
    const ok = acceptTap(s, { t: GO + 240, side: 'right' });
    expect(ok.accepted).toBe(true);
    expect(ok.state.minGap).toBe(40);
  });

  it('measures gaps from the last accepted tap, not rejected ones', () => {
    const s = run([
      [200, 'left'],
      [210, 'right'],
      [230, 'left'],
      [260, 'right'],
    ]);
    expect(s.count).toBe(2);
    expect(s.minGap).toBe(60);
  });

  it('does not mutate state', () => {
    const s = createTapState(GO);
    acceptTap(s, { t: GO + 200, side: 'left' });
    expect(s.count).toBe(0);
  });
});

describe('summarizeTaps', () => {
  it('rounds 0 gives null', () => {
    expect(summarizeTaps(createTapState(GO))).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'time-up' });
    expect(summarizeTaps(run([[50, 'left']]))).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'time-up' });
  });

  it('one tap gives best = avg', () => {
    const s = summarizeTaps(run([[150.2, 'left']]));
    expect(s).toEqual({ rounds: 1, avgMs: 151, bestMs: 151, endReason: 'time-up' });
    expect(checkScore('tapspeed', s.rounds, s.avgMs, s.bestMs)).toBeNull();
  });

  it('ceils avg and best', () => {
    const s = summarizeTaps(
      run([
        [120.1, 'left'],
        [180.3, 'right'],
        [300.5, 'left'],
      ]),
    );
    expect(s.rounds).toBe(3);
    expect(s.avgMs).toBe(301);
    expect(s.bestMs).toBe(61);
    expect(s.endReason).toBe('time-up');
  });

  it('keeps integer values unchanged', () => {
    const s = summarizeTaps(run([[100, 'left'], [140, 'right']]));
    expect(s).toEqual({ rounds: 2, avgMs: 140, bestMs: 40, endReason: 'time-up' });
  });

  it('passes an explicit end reason', () => {
    expect(summarizeTaps(run([[200, 'left']]), 'timeout').endReason).toBe('timeout');
  });

  it('fastest possible run passes checkScore', () => {
    const taps: Array<[number, Side]> = [];
    for (let i = 0; i < 400; i++) taps.push([100 + 40 * i, i % 2 === 0 ? 'left' : 'right']);
    const s = summarizeTaps(run(taps));
    expect(s.rounds).toBe(248);
    expect(checkScore('tapspeed', s.rounds, s.avgMs, s.bestMs)).toBeNull();
  });

  it('random plausible runs always pass checkScore', () => {
    const rng = seeded(7);
    for (let n = 0; n < 300; n++) {
      const goAt = 1000 + rng() * 100000;
      let state = createTapState(goAt);
      let t = goAt + rng() * 300;
      while (t < goAt + 10100) {
        const side: Side = rng() < 0.85 ? (state.lastSide === 'left' ? 'right' : 'left') : rng() < 0.5 ? 'left' : 'right';
        state = acceptTap(state, { t, side }).state;
        t += 30 + rng() * 120;
      }
      const s = summarizeTaps(state);
      if (s.rounds === 0) continue;
      expect(checkScore('tapspeed', s.rounds, s.avgMs, s.bestMs)).toBeNull();
    }
  });
});

describe('helpers', () => {
  it('sideOf splits at center', () => {
    expect(sideOf(194.9, 0, 390)).toBe('left');
    expect(sideOf(195, 0, 390)).toBe('right');
    expect(sideOf(19, 10, 20)).toBe('left');
    expect(sideOf(20, 10, 20)).toBe('right');
  });

  it('remainingMs clamps', () => {
    expect(remainingMs(GO, GO - 100)).toBe(10000);
    expect(remainingMs(GO, GO + 2500)).toBe(7500);
    expect(remainingMs(GO, GO + 20000)).toBe(0);
  });
});
