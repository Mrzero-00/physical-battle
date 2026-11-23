// 연타 속도 게임 탭 인정·요약 순수 함수
export const COUNTDOWN_MS = 3000;
export const DURATION_MS = 10000;
export const MIN_START_MS = 100;
export const MIN_GAP_MS = 40;

export type Side = 'left' | 'right';

export interface Tap {
  t: number;
  side: Side;
}

export interface TapState {
  goAt: number;
  count: number;
  lastAt: number | null;
  lastSide: Side | null;
  minGap: number | null;
}

export interface TapSummary {
  rounds: number;
  avgMs: number | null;
  bestMs: number | null;
  endReason: string;
}

export function createTapState(goAt: number): TapState {
  return { goAt, count: 0, lastAt: null, lastSide: null, minGap: null };
}

export function sideOf(x: number, left: number, width: number): Side {
  return x < left + width / 2 ? 'left' : 'right';
}

export function acceptTap(state: TapState, tap: Tap): { accepted: boolean; state: TapState } {
  const since = tap.t - state.goAt;
  const reject = { accepted: false, state };
  if (!Number.isFinite(since) || since < MIN_START_MS || since > DURATION_MS) return reject;
  if (state.lastAt !== null) {
    if (tap.side === state.lastSide) return reject;
    const gap = tap.t - state.lastAt;
    if (gap < MIN_GAP_MS) return reject;
    return {
      accepted: true,
      state: {
        ...state,
        count: state.count + 1,
        lastAt: tap.t,
        lastSide: tap.side,
        minGap: state.minGap === null ? gap : Math.min(state.minGap, gap),
      },
    };
  }
  return { accepted: true, state: { ...state, count: 1, lastAt: tap.t, lastSide: tap.side } };
}

export function summarizeTaps(state: TapState, endReason = 'time-up'): TapSummary {
  if (state.count === 0 || state.lastAt === null) return { rounds: 0, avgMs: null, bestMs: null, endReason };
  const avgMs = Math.ceil(state.lastAt - state.goAt);
  const bestMs = state.minGap === null ? avgMs : Math.ceil(state.minGap);
  return { rounds: state.count, avgMs, bestMs, endReason };
}

export function remainingMs(goAt: number, now: number): number {
  return Math.min(DURATION_MS, Math.max(0, goAt + DURATION_MS - now));
}
