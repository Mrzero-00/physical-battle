// 다중 물체 추적 게임 난이도·물리·판정 순수 함수
export const BALL_RADIUS = 22;
export const HIT_RADIUS = 28;
export const HIGHLIGHT_MS = 1500;
export const ANSWER_LIMIT_MS = 10000;
export const MIN_PICK_MS = 100;
export const MAX_STEP_MS = 50;

export interface Bounds {
  width: number;
  height: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

export type PickJudgement = 'ignore' | 'correct' | 'complete' | 'wrong';

export interface MotSummary {
  rounds: number;
  avgMs: number | null;
  bestMs: number | null;
  endReason: 'wrong' | 'timeout' | 'none';
}

const levelOf = (n: number) => (Number.isInteger(n) && n >= 1 ? n : 1);
const unit = (rng: () => number) => Math.min(Math.max(rng(), 0), 0.999999);

export function ballCount(level: number): number {
  return Math.min(12, 6 + Math.floor((levelOf(level) - 1) / 2));
}

export function targetCount(level: number): number {
  return Math.min(5, 2 + Math.floor((levelOf(level) - 1) / 3));
}

export function speedScale(bounds: Bounds): number {
  return Math.min(bounds.width, bounds.height) / 390;
}

export function speedPx(level: number, scale: number): number {
  return Math.min(320, 120 + 15 * (levelOf(level) - 1)) * scale;
}

export function trackMs(level: number): number {
  return Math.min(8000, 4000 + 300 * (levelOf(level) - 1));
}

export function placeBalls(n: number, bounds: Bounds, r: number, rng: () => number, speed = 0): Ball[] {
  const balls: Ball[] = [];
  const minDist = 2 * r + 4;
  const spanX = Math.max(0, bounds.width - 2 * r);
  const spanY = Math.max(0, bounds.height - 2 * r);
  const velocity = () => {
    const a = unit(rng) * Math.PI * 2;
    return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
  };
  let attempts = 0;
  while (balls.length < n && attempts < 20000) {
    attempts++;
    const x = r + unit(rng) * spanX;
    const y = r + unit(rng) * spanY;
    if (balls.every((b) => Math.hypot(b.x - x, b.y - y) >= minDist)) balls.push({ x, y, r, ...velocity() });
  }
  if (balls.length < n) {
    balls.length = 0;
    const cols = Math.max(1, Math.floor(bounds.width / minDist));
    for (let i = 0; i < n; i++) {
      const x = Math.min(bounds.width - r, r + (i % cols) * minDist);
      const y = Math.min(bounds.height - r, r + Math.floor(i / cols) * minDist);
      balls.push({ x, y, r, ...velocity() });
    }
  }
  return balls;
}

function clampToWalls(b: Ball, bounds: Bounds): void {
  if (b.x - b.r < 0) {
    b.x = b.r;
    b.vx = Math.abs(b.vx);
  } else if (b.x + b.r > bounds.width) {
    b.x = Math.max(b.r, bounds.width - b.r);
    b.vx = -Math.abs(b.vx);
  }
  if (b.y - b.r < 0) {
    b.y = b.r;
    b.vy = Math.abs(b.vy);
  } else if (b.y + b.r > bounds.height) {
    b.y = Math.max(b.r, bounds.height - b.r);
    b.vy = -Math.abs(b.vy);
  }
}

export function stepBalls(balls: readonly Ball[], dtMs: number, bounds: Bounds): Ball[] {
  const dt = Math.min(Math.max(Number.isFinite(dtMs) ? dtMs : 0, 0), MAX_STEP_MS) / 1000;
  const next = balls.map((b) => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt }));
  for (const b of next) clampToWalls(b, bounds);
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i];
      const b = next[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.r + b.r;
      if (dist >= minDist) continue;
      const nx = dist > 0 ? dx / dist : 1;
      const ny = dist > 0 ? dy / dist : 0;
      const overlap = (minDist - dist) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
      const va = a.vx * nx + a.vy * ny;
      const vb = b.vx * nx + b.vy * ny;
      if (va - vb > 0) {
        const d = vb - va;
        a.vx += d * nx;
        a.vy += d * ny;
        b.vx -= d * nx;
        b.vy -= d * ny;
      }
    }
  }
  for (const b of next) clampToWalls(b, bounds);
  return next;
}

export function hitBall(point: Point, balls: readonly Ball[], hitR: number): number {
  let best = -1;
  let bestDist = Infinity;
  balls.forEach((b, i) => {
    const d = Math.hypot(b.x - point.x, b.y - point.y);
    if (d <= hitR && d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

export function pickTargets(n: number, k: number, rng: () => number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(unit(rng) * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, k)).sort((a, b) => a - b);
}

export function judgePick(targets: readonly number[], picked: readonly number[], i: number): PickJudgement {
  if (i < 0 || picked.includes(i)) return 'ignore';
  if (!targets.includes(i)) return 'wrong';
  return picked.length + 1 >= targets.length ? 'complete' : 'correct';
}

export function summarizeRun(levelMs: readonly number[], endReason: MotSummary['endReason']): MotSummary {
  if (levelMs.length === 0) return { rounds: 0, avgMs: null, bestMs: null, endReason };
  return {
    rounds: levelMs.length,
    avgMs: Math.round(levelMs.reduce((s, x) => s + x, 0) / levelMs.length),
    bestMs: Math.round(Math.min(...levelMs)),
    endReason,
  };
}
