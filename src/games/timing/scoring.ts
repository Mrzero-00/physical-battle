// 타이밍 예측 게임 난이도·판정 순수 함수
export const MIN_TAP_MS = 100;
export const TIMEOUT_GRACE_MS = 30;
export const LINE_RATIO = 0.75;

export type TimingJudgement = { kind: 'hit'; errMs: number } | { kind: 'off-timing' } | { kind: 'timeout' } | { kind: 'ignore' };

export interface TimingSummary {
  rounds: number;
  avgMs: number | null;
  bestMs: number | null;
  endReason: 'off-timing' | 'timeout' | 'none';
}

const roundOf = (n: number) => (Number.isInteger(n) && n >= 1 ? n : 1);
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function travelMs(round: number, rng: () => number): number {
  const base = Math.max(450, 1600 - 80 * (roundOf(round) - 1));
  return Math.round(base * (0.9 + 0.2 * clamp01(rng())));
}

export function toleranceMs(round: number): number {
  return Math.max(30, 120 - 6 * (roundOf(round) - 1));
}

export function occlusion(round: number): number {
  const r = roundOf(round);
  return r < 6 ? 0 : Math.min(0.5, Math.round((r - 5) * 10) / 100);
}

export function progressAt(startAt: number, crossAt: number, ts: number): number {
  const travel = crossAt - startAt;
  return travel <= 0 ? 1 : (ts - startAt) / travel;
}

export function ballX(progress: number, startX: number, lineX: number): number {
  return startX + (lineX - startX) * progress;
}

export function isOccluded(progress: number, occ: number): boolean {
  return occ > 0 && progress >= 1 - occ && progress < 1;
}

export function timeoutAt(crossAt: number, tol: number): number {
  return crossAt + tol + TIMEOUT_GRACE_MS;
}

export function judgeTiming(startAt: number, crossAt: number, tapAt: number, tol: number): TimingJudgement {
  if (!Number.isFinite(tapAt) || tapAt - startAt < MIN_TAP_MS) return { kind: 'ignore' };
  const errMs = tapAt - crossAt;
  if (Math.abs(errMs) <= tol) return { kind: 'hit', errMs };
  return { kind: 'off-timing' };
}

export function summarizeTiming(results: readonly TimingJudgement[]): TimingSummary {
  const errors: number[] = [];
  let endReason: TimingSummary['endReason'] = 'none';
  for (const r of results) {
    if (r.kind === 'ignore') continue;
    if (r.kind === 'hit') {
      errors.push(Math.abs(r.errMs));
      continue;
    }
    endReason = r.kind;
    break;
  }
  if (errors.length === 0) return { rounds: 0, avgMs: null, bestMs: null, endReason };
  return {
    rounds: errors.length,
    avgMs: Math.round(errors.reduce((s, x) => s + x, 0) / errors.length),
    bestMs: Math.round(Math.min(...errors)),
    endReason,
  };
}
