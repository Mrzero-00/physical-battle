// 순간 기억 게임 난이도·문제·판정 순수 함수
export const MIN_TAP_MS = 100;
export const TIMEOUT_GRACE_MS = 30;

export type DigitJudgement = 'correct' | 'complete' | 'wrong';
export type TapWindow = 'ignore' | 'ok' | 'timeout';

export type FlashResult = { kind: 'clear'; ms: number } | { kind: 'wrong' } | { kind: 'timeout' };

export interface FlashSummary {
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

export function digitCount(level: number): number {
  return Math.min(10, 3 + Math.floor((levelOf(level) - 1) / 2));
}

export function exposureMs(level: number): number {
  return Math.max(300, 1200 - 75 * (levelOf(level) - 1));
}

export function answerLimitMs(n: number): number {
  return 3000 + 1000 * n;
}

export function makeSequence(n: number, rng: () => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      out.push(Math.floor(unit(rng) * 10));
      continue;
    }
    const prev = out[i - 1];
    const d = Math.floor(unit(rng) * 9);
    out.push(d >= prev ? d + 1 : d);
  }
  return out;
}

export function judgeDigit(seq: readonly number[], index: number, digit: number): DigitJudgement {
  if (index < 0 || index >= seq.length || seq[index] !== digit) return 'wrong';
  return index === seq.length - 1 ? 'complete' : 'correct';
}

export function tapWindow(inputAt: number, tapAt: number, limit: number): TapWindow {
  const elapsed = tapAt - inputAt;
  if (!Number.isFinite(elapsed) || elapsed < MIN_TAP_MS) return 'ignore';
  if (elapsed > limit) return 'timeout';
  return 'ok';
}

export function summarizeFlash(results: readonly FlashResult[]): FlashSummary {
  const times: number[] = [];
  let endReason: FlashSummary['endReason'] = 'none';
  for (const r of results) {
    if (r.kind === 'clear') {
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
