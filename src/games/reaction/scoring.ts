// 반응속도 테스트 판정·난이도 순수 함수
export const START_LIMIT_MS = 1000;
export const MIN_LIMIT_MS = 100;
export const LIMIT_DECAY = 0.95;
export const DELAY_MIN_MS = 600;
export const DELAY_MAX_MS = 1800;
export const MIN_HUMAN_MS = 100;
export const BUTTON_SIZE = 72;
export const HUD_HEIGHT = 64;
export const EDGE_MARGIN = 16;

export interface Viewport {
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Judgement =
  | { kind: 'hit'; ms: number }
  | { kind: 'false-start' }
  | { kind: 'miss' }
  | { kind: 'timeout' };

export type EndReason = Exclude<Judgement['kind'], 'hit'> | 'none';

export interface RunSummary {
  rounds: number;
  avgMs: number | null;
  bestMs: number | null;
  endReason: EndReason;
}

export function timeLimitFor(round: number): number {
  const n = Math.max(1, Math.floor(round));
  return Math.max(MIN_LIMIT_MS, Math.round(START_LIMIT_MS * LIMIT_DECAY ** (n - 1)));
}

export function pickDelay(rng: () => number): number {
  const r = Math.min(Math.max(rng(), 0), 1);
  return Math.round(DELAY_MIN_MS + r * (DELAY_MAX_MS - DELAY_MIN_MS));
}

export function randomPosition(rng: () => number, viewport: Viewport, size: number, margin: Insets): Point {
  const minX = margin.left;
  const minY = margin.top;
  const maxX = Math.max(minX, viewport.width - margin.right - size);
  const maxY = Math.max(minY, viewport.height - margin.bottom - size);
  const rx = Math.min(Math.max(rng(), 0), 1);
  const ry = Math.min(Math.max(rng(), 0), 1);
  return {
    x: Math.round(minX + rx * (maxX - minX)),
    y: Math.round(minY + ry * (maxY - minY)),
  };
}

export function isHit(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function judgeTap(shownAt: number | null, tapAt: number, limitMs: number, hit: boolean): Judgement {
  if (shownAt === null) return { kind: 'false-start' };
  if (!hit) return { kind: 'miss' };
  const ms = tapAt - shownAt;
  if (!Number.isFinite(ms) || ms < MIN_HUMAN_MS) return { kind: 'false-start' };
  if (ms > limitMs) return { kind: 'timeout' };
  return { kind: 'hit', ms };
}

export function summarizeRun(results: readonly Judgement[]): RunSummary {
  const hits: number[] = [];
  let endReason: EndReason = 'none';
  for (const result of results) {
    if (result.kind === 'hit') {
      hits.push(result.ms);
      continue;
    }
    endReason = result.kind;
    break;
  }
  if (hits.length === 0) return { rounds: 0, avgMs: null, bestMs: null, endReason };
  const total = hits.reduce((sum, ms) => sum + ms, 0);
  return {
    rounds: hits.length,
    avgMs: Math.round(total / hits.length),
    bestMs: Math.round(Math.min(...hits)),
    endReason,
  };
}
