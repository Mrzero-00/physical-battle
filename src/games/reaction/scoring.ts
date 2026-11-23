// 반응속도 테스트 판정·난이도 순수 함수
export const START_LIMIT_MS = 1000;
export const MIN_LIMIT_MS = 100;
export const LIMIT_STEP_RATIO = 0.1;
export const MIN_LIMIT_STEP_MS = 50;
export const MAX_BURST = 4;
export const MIN_CENTER_GAP = 108;
const POSITION_ATTEMPTS = 8;
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

export type Judgement = { kind: 'hit'; ms: number } | { kind: 'timeout' } | { kind: 'ignore' };

export type EndReason = 'timeout' | 'miss' | 'false-start' | 'none';

export interface RunSummary {
  rounds: number;
  avgMs: number | null;
  bestMs: number | null;
  endReason: EndReason;
}

export function nextLimit(limitMs: number): number {
  const step = Math.max(MIN_LIMIT_STEP_MS, Math.round(limitMs * LIMIT_STEP_RATIO));
  return Math.max(MIN_LIMIT_MS, limitMs - step);
}

export function timeLimitFor(round: number): number {
  const n = Number.isInteger(round) && round >= 1 ? round : 1;
  let limit = START_LIMIT_MS;
  for (let r = 1; r < n && limit > MIN_LIMIT_MS; r++) limit = nextLimit(limit);
  return limit;
}

export function burstSizeFor(round: number): number {
  if (round >= 11) return MAX_BURST;
  if (round >= 8) return 3;
  if (round >= 5) return 2;
  return 1;
}

export interface Announcement {
  size: number;
  title: string;
  sub: string;
}

export function announcementFor(round: number): Announcement | null {
  if (!Number.isInteger(round) || round < 2) return null;
  const size = burstSizeFor(round);
  if (size <= burstSizeFor(round - 1)) return null;
  return { size, title: `이제 ${size}개씩 버튼이 나옵니다!`, sub: '누르자마자 다음 버튼이 떠요' };
}

export interface Progress {
  round: number;
  index: number;
}

export type Advance =
  | { kind: 'over' }
  | { kind: 'stay'; round: number; index: number }
  | { kind: 'next-button'; round: number; index: number }
  | { kind: 'next-round'; round: number; index: number };

export function advance(progress: Progress, judgement: Judgement): Advance {
  if (judgement.kind === 'ignore') return { kind: 'stay', round: progress.round, index: progress.index };
  if (judgement.kind !== 'hit') return { kind: 'over' };
  if (progress.index + 1 < burstSizeFor(progress.round)) {
    return { kind: 'next-button', round: progress.round, index: progress.index + 1 };
  }
  return { kind: 'next-round', round: progress.round + 1, index: 0 };
}

export function burstLabel(round: number, index: number): string {
  const size = burstSizeFor(round);
  return size === 1 ? '' : `${index + 1}/${size}`;
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

const centerDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function randomPositionAwayFrom(
  rng: () => number,
  viewport: Viewport,
  size: number,
  margin: Insets,
  prev: Point | null,
  minGap: number,
): Point {
  if (prev === null) return randomPosition(rng, viewport, size, margin);
  for (let i = 0; i < POSITION_ATTEMPTS; i++) {
    const candidate = randomPosition(rng, viewport, size, margin);
    if (centerDistance(candidate, prev) >= minGap) return candidate;
  }
  const minX = margin.left;
  const minY = margin.top;
  const maxX = Math.max(minX, viewport.width - margin.right - size);
  const maxY = Math.max(minY, viewport.height - margin.bottom - size);
  const corners: Point[] = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: minX, y: maxY },
    { x: maxX, y: maxY },
  ];
  return corners.reduce((far, c) => (centerDistance(c, prev) > centerDistance(far, prev) ? c : far));
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
  if (shownAt === null) return { kind: 'ignore' };
  if (!hit) return { kind: 'ignore' };
  const ms = tapAt - shownAt;
  if (!Number.isFinite(ms) || ms < MIN_HUMAN_MS) return { kind: 'ignore' };
  if (ms > limitMs) return { kind: 'timeout' };
  return { kind: 'hit', ms };
}

export function summarizeRun(results: readonly Judgement[]): RunSummary {
  const hits: number[] = [];
  let endReason: EndReason = 'none';
  let rounds = 0;
  let inRound = 0;
  for (const result of results) {
    if (result.kind === 'ignore') continue;
    if (result.kind === 'timeout') {
      endReason = 'timeout';
      break;
    }
    hits.push(result.ms);
    inRound += 1;
    if (inRound === burstSizeFor(rounds + 1)) {
      rounds += 1;
      inRound = 0;
    }
  }
  if (hits.length === 0) return { rounds: 0, avgMs: null, bestMs: null, endReason };
  const total = hits.reduce((sum, ms) => sum + ms, 0);
  return {
    rounds,
    avgMs: Math.round(total / hits.length),
    bestMs: Math.round(Math.min(...hits)),
    endReason,
  };
}
