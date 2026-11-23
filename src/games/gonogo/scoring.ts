// 선택 반응(go/no-go) 게임 난이도·판정 순수 함수
export const MIN_HUMAN_MS = 100;
export const DELAY_MIN_MS = 500;
export const DELAY_SPAN_MS = 700;
export const NOGO_HOLD_EXTRA_MS = 150;
export const MAX_RED_STREAK = 2;

export type SignalKind = 'go' | 'nogo';

export type GoNoGoJudgement =
  | { kind: 'hit'; ms: number }
  | { kind: 'hold' }
  | { kind: 'no-go-tap' }
  | { kind: 'timeout' }
  | { kind: 'ignore' };

export interface GoNoGoSummary {
  rounds: number;
  avgMs: number | null;
  bestMs: number | null;
  endReason: 'no-go-tap' | 'timeout' | 'none';
}

const roundOf = (n: number) => (Number.isInteger(n) && n >= 1 ? n : 1);
const unit = (rng: () => number) => {
  const v = rng();
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0;
};

export function pickDelay(rng: () => number): number {
  return DELAY_MIN_MS + Math.round(DELAY_SPAN_MS * unit(rng));
}

export function limitMs(round: number): number {
  return Math.max(350, 900 - 25 * (roundOf(round) - 1));
}

export function redRatio(round: number): number {
  const r = roundOf(round);
  if (r < 3) return 0;
  return Math.min(0.45, Math.round((0.15 + 0.015 * (r - 3)) * 1000) / 1000);
}

export function pickKind(round: number, rng: () => number, redStreak: number): SignalKind {
  const r = roundOf(round);
  if (r < 3 || redStreak >= MAX_RED_STREAK) return 'go';
  return rng() < redRatio(r) ? 'nogo' : 'go';
}

export function noGoHoldMs(round: number): number {
  return limitMs(round) + NOGO_HOLD_EXTRA_MS;
}

export function judgeGoNoGo(kind: SignalKind, shownAt: number | null, tapAt: number, limit: number, hit: boolean): GoNoGoJudgement {
  if (shownAt === null || !hit) return { kind: 'ignore' };
  if (kind === 'nogo') return { kind: 'no-go-tap' };
  const ms = tapAt - shownAt;
  if (!Number.isFinite(ms) || ms < MIN_HUMAN_MS) return { kind: 'ignore' };
  if (ms > limit) return { kind: 'timeout' };
  return { kind: 'hit', ms };
}

export function summarizeGoNoGo(results: readonly GoNoGoJudgement[]): GoNoGoSummary {
  const times: number[] = [];
  let rounds = 0;
  let endReason: GoNoGoSummary['endReason'] = 'none';
  for (const r of results) {
    if (r.kind === 'ignore') continue;
    if (r.kind === 'hit') {
      times.push(r.ms);
      rounds += 1;
      continue;
    }
    if (r.kind === 'hold') {
      rounds += 1;
      continue;
    }
    endReason = r.kind;
    break;
  }
  if (rounds === 0 || times.length === 0) return { rounds: 0, avgMs: null, bestMs: null, endReason };
  const avgMs = Math.max(MIN_HUMAN_MS, Math.round(times.reduce((s, x) => s + x, 0) / times.length));
  return { rounds, avgMs, bestMs: Math.min(avgMs, Math.max(MIN_HUMAN_MS, Math.round(Math.min(...times)))), endReason };
}
