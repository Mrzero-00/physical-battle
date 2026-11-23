// 균형 난이도·경로·입력 변환 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import {
  LEVEL_LIMIT_MS,
  autopilotGravity,
  distanceToPath,
  dragToGravity,
  halfWidthPx,
  isOnPath,
  makeObstacles,
  makePath,
  nextVertexIndex,
  obstacleCount,
  reachedGoal,
  segmentCount,
  summarizeRun,
  tiltToGravity,
  viewScale,
  type Point,
} from './scoring';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const viewport = { width: 390, height: 780 };

describe('difficulty', () => {
  it.each([
    [1, 3],
    [2, 3],
    [3, 4],
    [11, 8],
    [12, 8],
    [30, 8],
    [0, 3],
    [1.5, 3],
  ])('segmentCount(%f) = %i', (l, n) => expect(segmentCount(l)).toBe(n));

  it.each([
    [1, 48],
    [2, 45],
    [11, 18],
    [12, 18],
    [0, 48],
  ])('halfWidthPx(%f, 1) = %i', (l, px) => expect(halfWidthPx(l, 1)).toBe(px));

  it('halfWidthPx scales', () => {
    expect(halfWidthPx(1, 2)).toBe(96);
    expect(viewScale({ width: 390, height: 844 })).toBe(1);
  });

  it.each([
    [1, 0],
    [3, 0],
    [4, 1],
    [7, 4],
    [8, 4],
    [-2, 0],
  ])('obstacleCount(%f) = %i', (l, n) => expect(obstacleCount(l)).toBe(n));

  it('level limit', () => expect(LEVEL_LIMIT_MS).toBe(60000));
});

describe('makePath', () => {
  it.each([1, 5, 12])('stays inside viewport and goes top to bottom (level %i)', (level) => {
    for (const seed of [1, 2, 3, 99, 1234]) {
      const path = makePath(level, viewport, seeded(seed));
      const hw = halfWidthPx(level, viewScale(viewport));
      expect(path).toHaveLength(segmentCount(level) + 1);
      for (const p of path) {
        expect(p.x - hw).toBeGreaterThanOrEqual(0);
        expect(p.x + hw).toBeLessThanOrEqual(viewport.width);
        expect(p.y - hw).toBeGreaterThanOrEqual(0);
        expect(p.y + hw).toBeLessThanOrEqual(viewport.height);
      }
      for (let i = 1; i < path.length; i++) expect(path[i].y).toBeGreaterThan(path[i - 1].y);
      for (let i = 2; i < path.length; i++) {
        const prev = Math.sign(path[i - 1].x - path[i - 2].x);
        const cur = Math.sign(path[i].x - path[i - 1].x);
        if (i > 2) expect(cur).toBe(-prev);
      }
    }
  });

  it('stays inside a landscape viewport', () => {
    const vp = { width: 844, height: 390 };
    const path = makePath(8, vp, seeded(7));
    for (const p of path) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(vp.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(vp.height);
    }
  });
});

describe('path geometry', () => {
  const path: Point[] = [
    { x: 100, y: 100 },
    { x: 100, y: 300 },
    { x: 300, y: 300 },
  ];

  it('distanceToPath', () => {
    expect(distanceToPath({ x: 130, y: 200 }, path)).toBe(30);
    expect(distanceToPath({ x: 200, y: 280 }, path)).toBe(20);
    expect(distanceToPath({ x: 100, y: 60 }, path)).toBe(40);
  });

  it('isOnPath at hw boundary', () => {
    expect(isOnPath({ x: 130, y: 200 }, path, 30)).toBe(true);
    expect(isOnPath({ x: 130.01, y: 200 }, path, 30)).toBe(false);
    expect(isOnPath({ x: 70, y: 200 }, path, 30)).toBe(true);
    expect(isOnPath({ x: 69.99, y: 200 }, path, 30)).toBe(false);
  });

  it('reachedGoal within hw of last vertex', () => {
    expect(reachedGoal({ x: 270, y: 300 }, path, 30)).toBe(true);
    expect(reachedGoal({ x: 269.9, y: 300 }, path, 30)).toBe(false);
    expect(reachedGoal({ x: 100, y: 100 }, path, 30)).toBe(false);
    expect(reachedGoal({ x: 0, y: 0 }, [], 30)).toBe(false);
  });

  it('obstacles lie near the path but leave room', () => {
    const p = makePath(7, viewport, seeded(5));
    const hw = halfWidthPx(7, 1);
    const obs = makeObstacles(7, p, hw, seeded(6));
    expect(obs).toHaveLength(4);
    for (const o of obs) {
      expect(distanceToPath(o, p)).toBeCloseTo(hw * 0.7, 6);
      expect(o.r).toBeCloseTo(hw * 0.3, 6);
    }
    expect(makeObstacles(3, p, hw, seeded(6))).toHaveLength(0);
  });
});

describe('tiltToGravity', () => {
  const base = { beta: 40, gamma: 0 };
  it('is relative to the baseline', () => {
    expect(tiltToGravity(40, 0, base, 0)).toEqual({ x: 0, y: 0 });
    expect(tiltToGravity(55, 15, base, 0)).toEqual({ x: 0.5, y: 0.5 });
  });
  it('clamps at ±30°', () => {
    expect(tiltToGravity(70, 30, base, 0)).toEqual({ x: 1, y: 1 });
    expect(tiltToGravity(10, -30, base, 0)).toEqual({ x: -1, y: -1 });
    expect(tiltToGravity(100, 75, base, 0)).toEqual({ x: 1, y: 1 });
    expect(tiltToGravity(-40, -90, base, 0)).toEqual({ x: -1, y: -1 });
  });
  it('treats null as baseline zero', () => {
    expect(tiltToGravity(null, null, { beta: null, gamma: null }, 0)).toEqual({ x: 0, y: 0 });
  });
  it('rotates for screen orientation', () => {
    expect(tiltToGravity(55, 0, base, 90)).toEqual({ x: 0.5, y: 0 });
    expect(tiltToGravity(40, 15, base, 90)).toEqual({ x: 0, y: -0.5 });
    expect(tiltToGravity(55, 0, base, 270)).toEqual({ x: -0.5, y: 0 });
    expect(tiltToGravity(55, 0, base, -90)).toEqual({ x: -0.5, y: 0 });
    expect(tiltToGravity(55, 15, base, 180)).toEqual({ x: -0.5, y: -0.5 });
  });
});

describe('dragToGravity', () => {
  it('scales to 80px and clamps', () => {
    expect(dragToGravity(0, 0)).toEqual({ x: 0, y: 0 });
    expect(dragToGravity(40, -40)).toEqual({ x: 0.5, y: -0.5 });
    expect(dragToGravity(80, -80)).toEqual({ x: 1, y: -1 });
    expect(dragToGravity(200, -500)).toEqual({ x: 1, y: -1 });
  });
});

describe('autopilotGravity', () => {
  const path: Point[] = [
    { x: 100, y: 100 },
    { x: 300, y: 250 },
    { x: 100, y: 400 },
  ];
  const dirTo = (g: { x: number; y: number }, from: Point, to: Point) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return (g.x * dx + g.y * dy) / (Math.hypot(g.x, g.y) * Math.hypot(dx, dy));
  };

  it('points toward the next vertex from rest', () => {
    const g = autopilotGravity({ x: 100, y: 100, vx: 0, vy: 0 }, path, 40);
    expect(dirTo(g, path[0], path[1])).toBeCloseTo(1, 6);
    expect(Math.abs(g.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(g.y)).toBeLessThanOrEqual(1);
  });

  it('advances to the following vertex near a corner', () => {
    const ball = { x: 295, y: 248, vx: 0, vy: 0 };
    expect(nextVertexIndex(ball, path, 40)).toBe(2);
    const g = autopilotGravity(ball, path, 40);
    expect(dirTo(g, ball, path[2])).toBeCloseTo(1, 6);
  });

  it('brakes when moving too fast', () => {
    const g = autopilotGravity({ x: 100, y: 100, vx: 400, vy: 300 }, path, 40);
    expect(dirTo(g, path[0], path[1])).toBeLessThan(0);
  });
});

describe('summarizeRun', () => {
  it('null when no rounds', () => {
    expect(summarizeRun([], 'off-path')).toEqual({ rounds: 0, avgMs: null, bestMs: null, endReason: 'off-path' });
  });
  it('averages clear times', () => {
    expect(summarizeRun([3000, 5000.6], 'timeout')).toEqual({ rounds: 2, avgMs: 4000, bestMs: 3000, endReason: 'timeout' });
  });
});
