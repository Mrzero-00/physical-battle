// 코인 상태 단위 테스트
import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../platform/types';
import {
  applyDailyRefill,
  canPlay,
  COINS_KEY,
  grantBonus,
  loadCoins,
  localDayKey,
  parseCoinState,
  rewardDelta,
  saveCoins,
  spend,
  total,
  type CoinState,
} from './coins';

const at = (y: number, m: number, d: number, h = 12, min = 0, s = 0, ms = 0) =>
  new Date(y, m - 1, d, h, min, s, ms).getTime();
const DAY1 = at(2026, 11, 23);
const DAY2 = at(2026, 11, 24);
const state = (free: number, bonus: number, day = localDayKey(DAY1)): CoinState => ({ free, bonus, lastRefillDay: day });

describe('localDayKey', () => {
  it('로컬 23:59:59.999와 다음 날 00:00은 다른 날이다', () => {
    expect(localDayKey(at(2026, 11, 23, 23, 59, 59, 999))).toBe('2026-11-23');
    expect(localDayKey(at(2026, 11, 24, 0, 0, 0, 0))).toBe('2026-11-24');
  });
});

describe('applyDailyRefill', () => {
  it('같은 날이면 변화가 없다', () => {
    const s = state(2, 4);
    expect(applyDailyRefill(s, at(2026, 11, 23, 23, 59))).toBe(s);
  });

  it('다음 날에는 무료 코인을 5개까지만 채운다', () => {
    expect(applyDailyRefill(state(0, 0), DAY2)).toEqual({ free: 5, bonus: 0, lastRefillDay: '2026-11-24' });
    expect(applyDailyRefill(state(2, 0), DAY2).free).toBe(5);
    expect(applyDailyRefill(state(5, 0), DAY2).free).toBe(5);
  });

  it('광고 코인은 충전 때 그대로 유지된다', () => {
    expect(applyDailyRefill(state(1, 7), DAY2)).toEqual({ free: 5, bonus: 7, lastRefillDay: '2026-11-24' });
  });
});

describe('spend', () => {
  it('무료 코인을 먼저 쓴다', () => {
    const r = spend(state(2, 3));
    expect(r.ok).toBe(true);
    expect(r.state).toMatchObject({ free: 1, bonus: 3 });
  });

  it('무료 코인이 없으면 광고 코인을 쓴다', () => {
    expect(spend(state(0, 3)).state).toMatchObject({ free: 0, bonus: 2 });
  });

  it('코인이 없으면 실패하고 상태는 그대로다', () => {
    const s = state(0, 0);
    const r = spend(s);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
    expect(canPlay(s)).toBe(false);
  });

  it('마지막 1코인을 쓰면 0이 된다', () => {
    expect(total(spend(state(1, 0)).state)).toBe(0);
  });
});

describe('grantBonus', () => {
  it('99에서 자른다', () => {
    expect(grantBonus(state(0, 98), 3).bonus).toBe(99);
  });

  it('음수·소수는 거부한다', () => {
    const s = state(0, 2);
    expect(grantBonus(s, -1)).toBe(s);
    expect(grantBonus(s, 1.5)).toBe(s);
  });
});

describe('parseCoinState', () => {
  it.each([null, '{', '{"free":-1,"bonus":0,"lastRefillDay":"2026-11-23"}', '{"free":1.5,"bonus":0,"lastRefillDay":"2026-11-23"}', '{"free":null,"bonus":0,"lastRefillDay":"2026-11-23"}', '{"free":1}', '{"free":1,"bonus":0,"lastRefillDay":"bad"}'])(
    '손상된 값 %s는 오늘 기준 무료 5코인',
    (raw) => {
      expect(parseCoinState(raw, DAY1)).toEqual({ free: 5, bonus: 0, lastRefillDay: '2026-11-23' });
    },
  );

  it('무료 코인 5개 초과·광고 코인 99개 초과는 자른다', () => {
    expect(parseCoinState('{"free":9,"bonus":150,"lastRefillDay":"2026-11-20"}', DAY1)).toEqual({
      free: 5,
      bonus: 99,
      lastRefillDay: '2026-11-20',
    });
  });

  it('NaN은 기본값', () => {
    expect(parseCoinState(JSON.stringify({ free: Number.NaN, bonus: 0, lastRefillDay: '2026-11-23' }), DAY1).free).toBe(5);
  });
});

describe('rewardDelta', () => {
  it('끝까지 보면 3코인', () => {
    expect(rewardDelta('rewarded', 0)).toBe(3);
    expect(rewardDelta('rewarded', 4)).toBe(3);
  });

  it('코인 0에서 광고를 못 보면 1코인', () => {
    expect(rewardDelta('unavailable', 0)).toBe(1);
    expect(rewardDelta('failed', 0)).toBe(1);
  });

  it('중간에 닫으면 0코인', () => {
    expect(rewardDelta('closed', 0)).toBe(0);
  });

  it('코인이 남아 있으면 실패해도 0코인', () => {
    expect(rewardDelta('failed', 2)).toBe(0);
    expect(rewardDelta('unavailable', 2)).toBe(0);
  });
});

describe('loadCoins / saveCoins', () => {
  it('저장한 뒤 다음 날 불러오면 충전이 적용된다', () => {
    const map = new Map<string, string>();
    const storage: KeyValueStorage = { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v) };
    saveCoins(storage, state(1, 2));
    expect(map.has(COINS_KEY)).toBe(true);
    expect(loadCoins(storage, DAY1)).toEqual(state(1, 2));
    expect(loadCoins(storage, DAY2)).toEqual({ free: 5, bonus: 2, lastRefillDay: '2026-11-24' });
  });
});
