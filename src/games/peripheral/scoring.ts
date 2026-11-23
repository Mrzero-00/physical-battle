// 주변시야 게임 난이도·문제·판정 순수 함수
export const LETTERS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ'] as const;
export const DIRECTIONS = 8;
export const DOT_SIZE = 24;
export const ANSWER_LIMIT_MS = 6000;
export const MIN_DECISION_MS = 100;

export type Letter = (typeof LETTERS)[number];

export interface Viewport {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type AnswerJudgement = { kind: 'correct'; ms: number } | { kind: 'wrong' } | { kind: 'timeout' } | { kind: 'ignore' };

export type PeripheralResult = { kind: 'correct'; ms: number } | { kind: 'wrong' } | { kind: 'timeout' };

export interface PeripheralSummary {
  rounds: number;
  avgMs: number | null;
  bestMs: number | null;
  endReason: 'wrong' | 'timeout' | 'none';
}

const levelOf = (n: number) => (Number.isInteger(n) && n >= 1 ? n : 1);
const unit = (rng: () => number) => {
  const v = rng();
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), 0.999999) : 0;
};

export function fixationDelay(rng: () => number): number {
  return 600 + Math.round(600 * unit(rng));
}

export function radiusRatio(level: number): number {
  return Math.min(0.95, Math.round((0.35 + 0.05 * (levelOf(level) - 1)) * 1000) / 1000);
}

export function flashMs(level: number): number {
  return Math.max(80, 300 - 20 * (levelOf(level) - 1));
}

export function pickDirection(rng: () => number): number {
  return Math.floor(unit(rng) * DIRECTIONS);
}

export function pickLetter(rng: () => number, prev: Letter | null = null): Letter {
  const pool = prev === null ? [...LETTERS] : LETTERS.filter((l) => l !== prev);
  return pool[Math.floor(unit(rng) * pool.length)];
}

export function flashPosition(dir: number, ratio: number, viewport: Viewport, size: number): Point {
  const width = Math.max(0, viewport.width);
  const height = Math.max(0, viewport.height);
  const d = ((Math.round(dir) % DIRECTIONS) + DIRECTIONS) % DIRECTIONS;
  const r = Math.min(1, Math.max(0, ratio)) * Math.max(0, Math.min(width - size, height - size) / 2);
  const angle = (d * Math.PI) / 4;
  const cx = width / 2 + r * Math.sin(angle);
  const cy = height / 2 - r * Math.cos(angle);
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), Math.max(0, max));
  return { x: clamp(cx - size / 2, width - size), y: clamp(cy - size / 2, height - size) };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(unit(rng) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function letterChoices(answer: Letter, rng: () => number): Letter[] {
  const others = shuffle(
    LETTERS.filter((l) => l !== answer),
    rng,
  ).slice(0, 3);
  return shuffle([answer, ...others], rng);
}

export function judgeAnswer<T>(picked: T | null, answer: T, elapsedMs: number, limitMs: number = ANSWER_LIMIT_MS): AnswerJudgement {
  if (picked === null || !Number.isFinite(elapsedMs) || elapsedMs < MIN_DECISION_MS) return { kind: 'ignore' };
  if (elapsedMs > limitMs) return { kind: 'timeout' };
  if (picked !== answer) return { kind: 'wrong' };
  return { kind: 'correct', ms: elapsedMs };
}

export function summarizePeripheral(results: readonly PeripheralResult[]): PeripheralSummary {
  const times: number[] = [];
  let endReason: PeripheralSummary['endReason'] = 'none';
  for (const r of results) {
    if (r.kind === 'correct') {
      times.push(r.ms);
      continue;
    }
    endReason = r.kind;
    break;
  }
  if (times.length === 0) return { rounds: 0, avgMs: null, bestMs: null, endReason };
  return {
    rounds: times.length,
    avgMs: Math.round(times.reduce((s, x) => s + x, 0) / times.length),
    bestMs: Math.round(Math.min(...times)),
    endReason,
  };
}
