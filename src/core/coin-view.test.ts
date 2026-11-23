// 코인 상단 바 표시 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import { adOutcomeMessage, appliedBonus, breakdownText, canWatchAd, refillText } from './coin-view';

const at = (h: number, m: number, s = 0) => new Date(2026, 10, 23, h, m, s).getTime();
const coins = (free: number, bonus: number) => ({ free, bonus, lastRefillDay: '2026-11-23' });

describe('refillText', () => {
  it('자정 직전은 곧', () => {
    expect(refillText(2, at(23, 59, 30))).toBe('무료 5코인까지 곧');
  });

  it('시간과 분', () => {
    expect(refillText(2, at(22, 0))).toBe('무료 5코인까지 2시간 0분');
    expect(refillText(0, at(9, 30))).toBe('무료 5코인까지 14시간 30분');
  });

  it('1시간 미만은 분만', () => {
    expect(refillText(4, at(23, 10))).toBe('무료 5코인까지 50분');
  });

  it('무료 코인이 가득이면 그렇게 표시', () => {
    expect(refillText(5, at(12, 0))).toBe('무료 코인 가득');
  });
});

describe('coin view', () => {
  it('내역 문구', () => {
    expect(breakdownText(coins(3, 2))).toBe('무료 3 · 보너스 2');
  });

  it('보너스가 99면 광고 충전 불가', () => {
    expect(canWatchAd(coins(0, 99))).toBe(false);
    expect(canWatchAd(coins(0, 98))).toBe(true);
  });

  it('실제 늘어난 보너스', () => {
    expect(appliedBonus(coins(0, 98), coins(0, 99))).toBe(1);
    expect(appliedBonus(coins(0, 2), coins(0, 5))).toBe(3);
  });
});

describe('adOutcomeMessage', () => {
  it('결과별 문구', () => {
    expect(adOutcomeMessage('rewarded', 3, 2)).toBe('3코인 받았어요');
    expect(adOutcomeMessage('rewarded', 1, 2)).toBe('1코인 받았어요');
    expect(adOutcomeMessage('rewarded', 0, 99)).toBe('보너스 코인이 가득 찼어요');
    expect(adOutcomeMessage('failed', 1, 0)).toBe('광고를 불러올 수 없어 1코인을 드려요');
    expect(adOutcomeMessage('unavailable', 0, 3)).toBe('광고를 불러올 수 없어요. 잠시 후 다시 시도해 주세요');
    expect(adOutcomeMessage('closed', 0, 0)).toBe('끝까지 시청해야 코인을 받아요');
  });
});
