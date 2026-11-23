// 다중 물체 추적 난이도·물리·판정 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import {
  BALL_RADIUS,
  ballCount,
  hitBall,
  judgePick,
  pickTargets,
  placeBalls,
  speedPx,
  speedScale,
  stepBalls,
  summarizeRun,
  targetCount,
  trackMs,
  type Ball,
} from './scoring';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const bounds = { width: 390, height: 700 };

describe('difficulty', () => {
  it.each([
    [1, 6],
    [2, 6],
    [3, 7],
    [13, 12],
    [14, 12],
    [0, 6],
    [2.5, 6],
  ])('ballCount(%f) = %i', (l, n) => expect(ballCount(l)).toBe(n));

  it.each([
    [1, 2],
    [3, 2],
    [4, 3],
    [10, 5],
    [11, 5],
    [-1, 2],
  ])('targetCount(%f) = %i', (l, n) => expect(targetCount(l)).toBe(n));

  it.each([
    [1, 120],
    [14, 315],
    [15, 320],
    [40, 320],
    [0, 120],
  ])('speedPx(%f, 1) = %i', (l, v) => expect(speedPx(l, 1)).toBe(v));

  it('speedPx scales', () => {
    expect(speedPx(1, 2)).toBe(240);
    expect(speedScale({ width: 390, height: 844 })).toBe(1);
    expect(speedScale({ width: 780, height: 1000 })).toBe(2);
  });

  it.each([
    [1, 4000],
    [14, 7900],
    [15, 8000],
    [30, 8000],
    [1.2, 4000],
  ])('trackMs(%f) = %i', (l, ms) => expect(trackMs(l)).toBe(ms));
});

describe('placeBalls', () => {
  it.each([1, 2, 3, 42, 777, 2024])('non-overlapping inside bounds (seed %i)', (seed) => {
    const balls = placeBalls(12, bounds, BALL_RADIUS, seeded(seed), 200);
    expect(balls).toHaveLength(12);
    for (const b of balls) {
      expect(b.x).toBeGreaterThanOrEqual(BALL_RADIUS);
      expect(b.x).toBeLessThanOrEqual(bounds.width - BALL_RADIUS);
      expect(b.y).toBeGreaterThanOrEqual(BALL_RADIUS);
      expect(b.y).toBeLessThanOrEqual(bounds.height - BALL_RADIUS);
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(200, 6);
    }
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        expect(Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y)).toBeGreaterThanOrEqual(2 * BALL_RADIUS);
      }
    }
  });

  it('falls back to a grid when space is tight', () => {
    const balls = placeBalls(4, { width: 100, height: 100 }, 22, () => 0.5);
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        expect(Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y)).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

describe('stepBalls', () => {
  const ball = (x: number, y: number, vx: number, vy: number): Ball => ({ x, y, vx, vy, r: 22 });

  it('moves by velocity and clamps dt to 50ms', () => {
    const [a] = stepBalls([ball(100, 100, 100, -100)], 20, bounds);
    expect(a.x).toBeCloseTo(102);
    expect(a.y).toBeCloseTo(98);
    const [b] = stepBalls([ball(100, 100, 100, 0)], 1000, bounds);
    expect(b.x).toBeCloseTo(105);
  });

  it('does not mutate input', () => {
    const input = [ball(100, 100, 100, 0)];
    stepBalls(input, 16, bounds);
    expect(input[0].x).toBe(100);
  });

  it('reflects from left and right walls', () => {
    const [l] = stepBalls([ball(23, 300, -200, 0)], 50, bounds);
    expect(l.x).toBe(22);
    expect(l.vx).toBe(200);
    const [r] = stepBalls([ball(bounds.width - 23, 300, 200, 0)], 50, bounds);
    expect(r.x).toBe(bounds.width - 22);
    expect(r.vx).toBe(-200);
  });

  it('reflects from top and bottom walls', () => {
    const [t] = stepBalls([ball(100, 23, 0, -200)], 50, bounds);
    expect(t.y).toBe(22);
    expect(t.vy).toBe(200);
    const [b] = stepBalls([ball(100, bounds.height - 23, 50, 200)], 50, bounds);
    expect(b.y).toBe(bounds.height - 22);
    expect(b.vy).toBe(-200);
    expect(b.vx).toBe(50);
  });

  it('head-on elastic collision swaps velocities', () => {
    const [a, b] = stepBalls([ball(100, 300, 100, 0), ball(145, 300, -100, 0)], 16, bounds);
    expect(a.vx).toBeCloseTo(-100);
    expect(b.vx).toBeCloseTo(100);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(44 - 1e-9);
  });

  it('oblique collision conserves momentum and energy', () => {
    const before = [ball(150, 300, 120, 30), ball(190, 320, -60, -10)];
    const after = stepBalls(before, 16, bounds);
    const p = (bs: Ball[]) => ({ x: bs.reduce((s, b) => s + b.vx, 0), y: bs.reduce((s, b) => s + b.vy, 0) });
    const e = (bs: Ball[]) => bs.reduce((s, b) => s + b.vx ** 2 + b.vy ** 2, 0);
    expect(p(after).x).toBeCloseTo(p(before).x, 6);
    expect(p(after).y).toBeCloseTo(p(before).y, 6);
    expect(e(after)).toBeCloseTo(e(before), 6);
    expect(after[0].vx).not.toBeCloseTo(120);
  });

  it('keeps every ball inside bounds over many steps', () => {
    let balls = placeBalls(10, bounds, 22, seeded(9), 320);
    for (let i = 0; i < 600; i++) balls = stepBalls(balls, 16.7, bounds);
    for (const b of balls) {
      expect(b.x).toBeGreaterThanOrEqual(22);
      expect(b.x).toBeLessThanOrEqual(bounds.width - 22);
      expect(b.y).toBeGreaterThanOrEqual(22);
      expect(b.y).toBeLessThanOrEqual(bounds.height - 22);
    }
  });
});

describe('hitBall', () => {
  const balls: Ball[] = [
    { x: 100, y: 100, vx: 0, vy: 0, r: 22 },
    { x: 150, y: 100, vx: 0, vy: 0, r: 22 },
  ];
  it('returns nearest within radius', () => {
    expect(hitBall({ x: 120, y: 100 }, balls, 28)).toBe(0);
    expect(hitBall({ x: 130, y: 100 }, balls, 28)).toBe(1);
    expect(hitBall({ x: 72, y: 100 }, balls, 28)).toBe(0);
    expect(hitBall({ x: 71, y: 100 }, balls, 28)).toBe(-1);
  });
});

describe('pickTargets', () => {
  it('returns k distinct indices', () => {
    const t = pickTargets(12, 5, seeded(3));
    expect(new Set(t).size).toBe(5);
    for (const i of t) expect(i).toBeGreaterThanOrEqual(0);
    for (const i of t) expect(i).toBeLessThan(12);
  });
});

describe('judgePick', () => {
  it('ignores empty space and already picked balls', () => {
    expect(judgePick([1, 3], [], -1)).toBe('ignore');
    expect(judgePick([1, 3], [1], 1)).toBe('ignore');
  });
  it('correct then complete', () => {
    expect(judgePick([1, 3, 5], [], 3)).toBe('correct');
    expect(judgePick([1, 3, 5], [3], 1)).toBe('correct');
    expect(judgePick([1, 3, 5], [3, 1], 5)).toBe('complete');
  });
  it('wrong on non-target', () => {
    expect(judgePick([1, 3], [1], 2)).toBe('wrong');
  });
});

describe('summarizeRun', () => {
  it('null when no rounds', () => {
    expect(summarizeRun([], 'wrong')).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'wrong' });
  });
  it('averages level times', () => {
    expect(summarizeRun([1000.4, 2000.2], 'timeout')).toEqual({ rounds: 2, avgMs: 1500, bestMs: 1000, endReason: 'timeout' });
  });
});
