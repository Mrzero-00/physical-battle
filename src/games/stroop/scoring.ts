// 색-단어 간섭 게임 난이도·문제·판정 순수 함수
export const MIN_HUMAN_MS = 100;

export type ColorId = 'red' | 'blue' | 'green' | 'yellow';

export interface StroopColor {
  id: ColorId;
  name: string;
  hex: string;
}

export const COLORS: readonly StroopColor[] = [
  { id: 'red', name: '빨강', hex: '#e5484d' },
  { id: 'blue', name: '파랑', hex: '#3b82f6' },
  { id: 'green', name: '초록', hex: '#22c55e' },
  { id: 'yellow', name: '노랑', hex: '#eab308' },
];

export const COLOR_IDS: readonly ColorId[] = COLORS.map((c) => c.id);

export interface StroopTrial {
  word: ColorId;
  ink: ColorId;
}

export type StroopJudgement = { kind: 'hit'; ms: number } | { kind: 'wrong' } | { kind: 'timeout' } | { kind: 'ignore' };

export interface StroopSummary {
  rounds: number;
  avgMs: number | null;
  bestMs: number | null;
  endReason: 'wrong' | 'timeout' | 'none';
}

const roundOf = (n: number) => (Number.isInteger(n) && n >= 1 ? n : 1);
const unit = (rng: () => number) => {
  const v = rng();
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), 0.999999) : 0;
};

export function colorOf(id: ColorId): StroopColor {
  return COLORS.find((c) => c.id === id) ?? COLORS[0];
}

export function limitMs(round: number): number {
  return Math.max(600, 2000 - 70 * (roundOf(round) - 1));
}

export function congruentRatio(round: number): number {
  return Math.max(0.1, Math.round((0.5 - 0.05 * (roundOf(round) - 1)) * 1000) / 1000);
}

export function shuffleButtons(round: number): boolean {
  return roundOf(round) >= 10;
}

export function makeTrial(round: number, rng: () => number): StroopTrial {
  const ink = COLOR_IDS[Math.floor(unit(rng) * COLOR_IDS.length)];
  if (unit(rng) < congruentRatio(round)) return { word: ink, ink };
  const others = COLOR_IDS.filter((id) => id !== ink);
  return { word: others[Math.floor(unit(rng) * others.length)], ink };
}

export function buttonOrder(round: number, rng: () => number): ColorId[] {
  const a = [...COLOR_IDS];
  if (!shuffleButtons(round)) return a;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(unit(rng) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function judgeStroop(trial: StroopTrial, shownAt: number | null, tapAt: number, limit: number, picked: ColorId | null): StroopJudgement {
  if (shownAt === null || picked === null) return { kind: 'ignore' };
  const ms = tapAt - shownAt;
  if (!Number.isFinite(ms) || ms < MIN_HUMAN_MS) return { kind: 'ignore' };
  if (ms > limit) return { kind: 'timeout' };
  if (picked !== trial.ink) return { kind: 'wrong' };
  return { kind: 'hit', ms };
}

export function summarizeStroop(results: readonly StroopJudgement[]): StroopSummary {
  const times: number[] = [];
  let endReason: StroopSummary['endReason'] = 'none';
  for (const r of results) {
    if (r.kind === 'ignore') continue;
    if (r.kind === 'hit') {
      times.push(r.ms);
      continue;
    }
    endReason = r.kind;
    break;
  }
  if (times.length === 0) return { rounds: 0, avgMs: null, bestMs: null, endReason };
  const avgMs = Math.max(MIN_HUMAN_MS, Math.round(times.reduce((s, x) => s + x, 0) / times.length));
  return { rounds: times.length, avgMs, bestMs: Math.min(avgMs, Math.max(MIN_HUMAN_MS, Math.round(Math.min(...times)))), endReason };
}
