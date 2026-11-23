// 오락실식 코인 상태 (무료 코인·광고 코인)
import type { KeyValueStorage } from '../platform/types';
import type { RewardOutcome } from './ads';

export const DAILY_FREE = 5;
export const AD_REWARD = 3;
export const FALLBACK_GRANT = 1;
export const BONUS_CAP = 99;
export const COINS_KEY = 'pb:coins';

export interface CoinState {
  free: number;
  bonus: number;
  lastRefillDay: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function localDayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function freshCoins(now: number): CoinState {
  return { free: DAILY_FREE, bonus: 0, lastRefillDay: localDayKey(now) };
}

export function applyDailyRefill(state: CoinState, now: number): CoinState {
  const today = localDayKey(now);
  if (state.lastRefillDay === today) return state;
  return { free: DAILY_FREE, bonus: state.bonus, lastRefillDay: today };
}

export function total(state: CoinState): number {
  return state.free + state.bonus;
}

export function canPlay(state: CoinState): boolean {
  return total(state) >= 1;
}

export function spend(state: CoinState): { ok: boolean; state: CoinState } {
  if (state.free > 0) return { ok: true, state: { ...state, free: state.free - 1 } };
  if (state.bonus > 0) return { ok: true, state: { ...state, bonus: state.bonus - 1 } };
  return { ok: false, state };
}

export function grantBonus(state: CoinState, amount: number): CoinState {
  if (!Number.isInteger(amount) || amount < 0) return state;
  return { ...state, bonus: Math.min(BONUS_CAP, state.bonus + amount) };
}

export function rewardDelta(outcome: RewardOutcome, totalCoins: number): number {
  if (outcome === 'rewarded') return AD_REWARD;
  if (totalCoins === 0 && (outcome === 'unavailable' || outcome === 'failed')) return FALLBACK_GRANT;
  return 0;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function parseCoinState(raw: string | null, now: number): CoinState {
  if (!raw) return freshCoins(now);
  try {
    const parsed = JSON.parse(raw) as Partial<CoinState>;
    if (!isCount(parsed.free) || !isCount(parsed.bonus) || typeof parsed.lastRefillDay !== 'string') {
      return freshCoins(now);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.lastRefillDay)) return freshCoins(now);
    return {
      free: Math.min(DAILY_FREE, parsed.free),
      bonus: Math.min(BONUS_CAP, parsed.bonus),
      lastRefillDay: parsed.lastRefillDay,
    };
  } catch {
    return freshCoins(now);
  }
}

export function loadCoins(storage: KeyValueStorage, now: number): CoinState {
  return applyDailyRefill(parseCoinState(storage.get(COINS_KEY), now), now);
}

export function saveCoins(storage: KeyValueStorage, state: CoinState): void {
  storage.set(COINS_KEY, JSON.stringify(state));
}
