// 코인 상단 바 표시용 순수 함수
import type { RewardOutcome } from './ads';
import { BONUS_CAP, DAILY_FREE, type CoinState } from './coins';

export function nextMidnight(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

export function refillText(free: number, now: number): string {
  if (free >= DAILY_FREE) return '무료 코인 가득';
  const left = nextMidnight(now) - now;
  const totalMinutes = Math.floor(left / 60000);
  if (totalMinutes < 1) return `무료 ${DAILY_FREE}코인까지 곧`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `무료 ${DAILY_FREE}코인까지 ${minutes}분`;
  return `무료 ${DAILY_FREE}코인까지 ${hours}시간 ${minutes}분`;
}

export function breakdownText(state: CoinState): string {
  return `무료 ${state.free} · 보너스 ${state.bonus}`;
}

export function canWatchAd(state: CoinState): boolean {
  return state.bonus < BONUS_CAP;
}

export function appliedBonus(before: CoinState, after: CoinState): number {
  return Math.max(0, after.bonus - before.bonus);
}

export function adOutcomeMessage(outcome: RewardOutcome, applied: number, totalBefore: number): string {
  if (outcome === 'rewarded') return applied > 0 ? `${applied}코인 받았어요` : '보너스 코인이 가득 찼어요';
  if (applied > 0 && totalBefore === 0) return `광고를 불러올 수 없어 ${applied}코인을 드려요`;
  if (outcome === 'closed') return '끝까지 시청해야 코인을 받아요';
  return '광고를 불러올 수 없어요. 잠시 후 다시 시도해 주세요';
}
