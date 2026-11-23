// 동체시력 게임 난이도·문제·판정 순수 함수
export const START_EXPOSURE_MS = 1200;
export const MIN_EXPOSURE_MS = 250;
export const EXPOSURE_DECAY = 0.9;
export const ANSWER_LIMIT_MS = 5000;
export const MIN_DECISION_MS = 100;
export const DELAY_MIN_MS = 500;
export const DELAY_MAX_MS = 1000;

export type PathKind = 'ltr' | 'rtl' | 'diag-down' | 'diag-up';

export interface Point {
  x: number;
  y: number;
}

export interface Area {
  width: number;
  height: number;
}

export interface Path {
  kind: PathKind;
  from: Point;
  to: Point;
}

export type VisionJudgement = { kind: 'correct'; ms: number } | { kind: 'wrong' } | { kind: 'timeout' } | { kind: 'ignore' };

export interface VisionSummary {
  rounds: number;
  avgMs: number | null;
  bestMs: number | null;
  endReason: 'wrong' | 'timeout' | 'none';
}

const roundOf = (n: number) => (Number.isInteger(n) && n >= 1 ? n : 1);

export function exposureFor(round: number): number {
  return Math.max(MIN_EXPOSURE_MS, Math.round(START_EXPOSURE_MS * EXPOSURE_DECAY ** (roundOf(round) - 1)));
}

export function fontSizeFor(round: number): number {
  return Math.max(14, 56 - 3 * (roundOf(round) - 1));
}

export function ballSizeFor(round: number): number {
  return Math.max(36, Math.round(fontSizeFor(round) * 1.5));
}

export function digitsFor(round: number): 1 | 2 {
  return roundOf(round) >= 6 ? 2 : 1;
}

export function rangeFor(digits: 1 | 2): [number, number] {
  return digits === 1 ? [1, 9] : [10, 99];
}

export function pathKindsFor(round: number): PathKind[] {
  const n = roundOf(round);
  if (n >= 8) return ['ltr', 'rtl', 'diag-down', 'diag-up'];
  if (n >= 4) return ['ltr', 'rtl'];
  return ['ltr'];
}

const unit = (rng: () => number) => Math.min(Math.max(rng(), 0), 0.999999);

export function pickDelay(rng: () => number): number {
  return Math.round(DELAY_MIN_MS + unit(rng) * (DELAY_MAX_MS - DELAY_MIN_MS));
}

export function pathFor(round: number, rng: () => number, area: Area, size: number): Path {
  const kinds = pathKindsFor(round);
  const kind = kinds[Math.floor(unit(rng) * kinds.length)];
  const maxY = Math.max(0, area.height - size);
  const left = -size;
  const right = area.width;
  if (kind === 'ltr' || kind === 'rtl') {
    const y = Math.round(unit(rng) * maxY);
    return kind === 'ltr' ? { kind, from: { x: left, y }, to: { x: right, y } } : { kind, from: { x: right, y }, to: { x: left, y } };
  }
  const drop = Math.max(Math.round(maxY * 0.3), Math.round(maxY * (0.3 + unit(rng) * 0.6)));
  const top = Math.round(unit(rng) * Math.max(0, maxY - drop));
  const bottom = top + drop;
  const fromLeft = unit(rng) < 0.5;
  const startY = kind === 'diag-down' ? top : bottom;
  const endY = kind === 'diag-down' ? bottom : top;
  return fromLeft
    ? { kind, from: { x: left, y: startY }, to: { x: right, y: endY } }
    : { kind, from: { x: right, y: startY }, to: { x: left, y: endY } };
}

export function pointAt(path: Path, elapsed: number, duration: number): Point {
  const t = duration <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / duration));
  return { x: path.from.x + (path.to.x - path.from.x) * t, y: path.from.y + (path.to.y - path.from.y) * t };
}

export function answerFor(round: number, rng: () => number, prev: number | null): number {
  const [lo, hi] = rangeFor(digitsFor(round));
  let value = lo + Math.floor(unit(rng) * (hi - lo + 1));
  if (value === prev) value = value === hi ? lo : value + 1;
  return value;
}

const LOOK_ALIKE: Record<number, number[]> = {
  0: [8, 6, 9],
  1: [7, 4],
  2: [7, 5],
  3: [8, 9],
  4: [1, 9],
  5: [6, 3],
  6: [5, 8, 9, 0],
  7: [1, 2],
  8: [3, 0, 6, 9],
  9: [6, 8, 4],
};

function candidatesFor(answer: number, digits: 1 | 2): number[] {
  if (digits === 1) return LOOK_ALIKE[answer] ?? [];
  const tens = Math.floor(answer / 10);
  const ones = answer % 10;
  const out = [ones * 10 + tens];
  for (const t of LOOK_ALIKE[tens] ?? []) out.push(t * 10 + ones);
  for (const o of LOOK_ALIKE[ones] ?? []) out.push(tens * 10 + o);
  return out;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(unit(rng) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeChoices(answer: number, digits: 1 | 2, rng: () => number): number[] {
  const [lo, hi] = rangeFor(digits);
  const pool = [...new Set(candidatesFor(answer, digits))].filter((n) => n >= lo && n <= hi && n !== answer);
  const picked = shuffle(pool, rng).slice(0, 3);
  let guard = 0;
  while (picked.length < 3 && guard < 1000) {
    const n = lo + Math.floor(unit(rng) * (hi - lo + 1));
    if (n !== answer && !picked.includes(n)) picked.push(n);
    guard++;
  }
  for (let n = lo; picked.length < 3 && n <= hi; n++) if (n !== answer && !picked.includes(n)) picked.push(n);
  return shuffle([answer, ...picked], rng);
}

export function judge(choice: number | null, answer: number, decisionMs: number, limitMs: number): VisionJudgement {
  if (choice === null || !Number.isFinite(decisionMs) || decisionMs < MIN_DECISION_MS) return { kind: 'ignore' };
  if (decisionMs > limitMs) return { kind: 'timeout' };
  if (choice !== answer) return { kind: 'wrong' };
  return { kind: 'correct', ms: decisionMs };
}

export function summarizeRun(results: readonly VisionJudgement[]): VisionSummary {
  const times: number[] = [];
  let endReason: VisionSummary['endReason'] = 'none';
  for (const r of results) {
    if (r.kind === 'ignore') continue;
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
