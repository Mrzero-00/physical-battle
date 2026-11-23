// 균형 게임 난이도·경로·입력 변환 순수 함수
export const LEVEL_LIMIT_MS = 60000;
export const PX_PER_M = 50;
export const BALL_RADIUS_PX = 12;
export const LINEAR_DAMPING = 0.5;
export const GRAVITY_MS2 = 12;
export const TILT_MAX_DEG = 30;
export const DRAG_MAX_PX = 80;
export const PATH_MARGIN_PX = 12;
export const AUTOPILOT_SPEED_PX = 90;

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Gravity {
  x: number;
  y: number;
}

export interface Orientation {
  beta: number | null;
  gamma: number | null;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface BallState {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export interface BalanceSummary {
  rounds: number;
  avgMs: number | null;
  bestMs: number | null;
  endReason: 'off-path' | 'timeout' | 'none';
}

const levelOf = (n: number) => (Number.isInteger(n) && n >= 1 ? n : 1);
const unit = (rng: () => number) => Math.min(Math.max(rng(), 0), 0.999999);
const clampUnit = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(-1, v)) : 0) || 0;

export function viewScale(viewport: Viewport): number {
  return Math.min(viewport.width, viewport.height) / 390;
}

export function segmentCount(level: number): number {
  return Math.min(8, 3 + Math.floor((levelOf(level) - 1) / 2));
}

export function halfWidthPx(level: number, scale: number): number {
  return Math.max(18, 48 - 3 * (levelOf(level) - 1)) * scale;
}

export function obstacleCount(level: number): number {
  return Math.min(4, Math.max(0, levelOf(level) - 3));
}

export function makePath(level: number, viewport: Viewport, rng: () => number): Point[] {
  const n = segmentCount(level);
  const hw = halfWidthPx(level, viewScale(viewport));
  const m = Math.min(hw + PATH_MARGIN_PX, Math.min(viewport.width, viewport.height) / 2);
  const spanX = Math.max(0, viewport.width - 2 * m);
  const spanY = Math.max(0, viewport.height - 2 * m);
  const flip = unit(rng) < 0.5;
  const points: Point[] = [{ x: m + spanX / 2, y: m }];
  for (let i = 1; i <= n; i++) {
    const right = (i % 2 === 1) !== flip;
    const t = right ? 0.6 + 0.4 * unit(rng) : 0.4 * unit(rng);
    points.push({ x: m + spanX * t, y: m + (spanY * i) / n });
  }
  return points;
}

function closestOnSegment(p: Point, a: Point, b: Point): { point: Point; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { point: { x: a.x + dx * t, y: a.y + dy * t }, t };
}

function closestSegment(p: Point, path: readonly Point[]): { index: number; dist: number } {
  let index = 0;
  let dist = Infinity;
  if (path.length === 1) return { index: 0, dist: Math.hypot(p.x - path[0].x, p.y - path[0].y) };
  for (let i = 0; i < path.length - 1; i++) {
    const { point } = closestOnSegment(p, path[i], path[i + 1]);
    const d = Math.hypot(p.x - point.x, p.y - point.y);
    if (d < dist) {
      dist = d;
      index = i;
    }
  }
  return { index, dist };
}

export function distanceToPath(p: Point, path: readonly Point[]): number {
  if (path.length === 0) return Infinity;
  return closestSegment(p, path).dist;
}

export function isOnPath(p: Point, path: readonly Point[], hw: number): boolean {
  return distanceToPath(p, path) <= hw;
}

export function reachedGoal(p: Point, path: readonly Point[], hw: number): boolean {
  if (path.length === 0) return false;
  const goal = path[path.length - 1];
  return Math.hypot(p.x - goal.x, p.y - goal.y) <= hw;
}

export function makeObstacles(level: number, path: readonly Point[], hw: number, rng: () => number): Circle[] {
  const segments = path.length - 1;
  const count = Math.min(obstacleCount(level), Math.max(0, segments));
  const pool = Array.from({ length: segments }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(unit(rng) * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out: Circle[] = [];
  for (const s of pool.slice(0, count)) {
    const a = path[s];
    const b = path[s + 1];
    const t = 0.3 + 0.4 * unit(rng);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const side = unit(rng) < 0.5 ? -1 : 1;
    out.push({
      x: a.x + (b.x - a.x) * t + nx * side * hw * 0.7,
      y: a.y + (b.y - a.y) * t + ny * side * hw * 0.7,
      r: hw * 0.3,
    });
  }
  return out;
}

export function tiltToGravity(beta: number | null, gamma: number | null, base: Orientation, screenAngle: number): Gravity {
  const db = (beta ?? 0) - (base.beta ?? 0);
  const dg = (gamma ?? 0) - (base.gamma ?? 0);
  const rad = ((((Math.round(screenAngle / 90) * 90) % 360) + 360) % 360) * (Math.PI / 180);
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  const sx = dg * cos + db * sin;
  const sy = -dg * sin + db * cos;
  return { x: clampUnit(sx / TILT_MAX_DEG), y: clampUnit(sy / TILT_MAX_DEG) };
}

export function dragToGravity(dx: number, dy: number): Gravity {
  return { x: clampUnit(dx / DRAG_MAX_PX), y: clampUnit(dy / DRAG_MAX_PX) };
}

export function nextVertexIndex(ball: Point, path: readonly Point[], hw: number): number {
  if (path.length < 2) return 0;
  let next = closestSegment(ball, path).index + 1;
  const v = path[next];
  if (next < path.length - 1 && Math.hypot(ball.x - v.x, ball.y - v.y) < hw * 0.5) next += 1;
  return next;
}

export function autopilotGravity(ball: BallState, path: readonly Point[], hw = 24): Gravity {
  if (path.length === 0) return { x: 0, y: 0 };
  const target = path[nextVertexIndex(ball, path, hw)];
  const dx = target.x - ball.x;
  const dy = target.y - ball.y;
  const dist = Math.hypot(dx, dy);
  const speed = Math.min(AUTOPILOT_SPEED_PX, dist * 2);
  const wantX = dist > 0 ? (dx / dist) * speed : 0;
  const wantY = dist > 0 ? (dy / dist) * speed : 0;
  const k = 1 / 150;
  return { x: clampUnit((wantX - (ball.vx ?? 0)) * k), y: clampUnit((wantY - (ball.vy ?? 0)) * k) };
}

export function summarizeRun(levelMs: readonly number[], endReason: BalanceSummary['endReason']): BalanceSummary {
  if (levelMs.length === 0) return { rounds: 0, avgMs: null, bestMs: null, endReason };
  return {
    rounds: levelMs.length,
    avgMs: Math.round(levelMs.reduce((s, x) => s + x, 0) / levelMs.length),
    bestMs: Math.round(Math.min(...levelMs)),
    endReason,
  };
}
