// 기록 저장소 단위 테스트
import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../platform';
import { addRecord, getBest, getRecent, recordsKey, type RunRecord } from './records';

function memory(): KeyValueStorage {
  const map = new Map<string, string>();
  return { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v) };
}

const rec = (rounds: number, avgMs: number, at = 0): RunRecord => ({
  gameId: 'reaction',
  rounds,
  avgMs,
  bestMs: Math.max(100, avgMs - 20),
  at,
});

describe('records', () => {
  it('최근 기록은 10개만 유지하고 최신순이다', () => {
    const s = memory();
    for (let i = 0; i < 12; i++) addRecord(s, rec(i + 1, 300, i));
    const recent = getRecent(s, 'reaction');
    expect(recent).toHaveLength(10);
    expect(recent[0].at).toBe(11);
    expect(recent[9].at).toBe(2);
  });

  it('최고 기록은 라운드 수가 우선이다', () => {
    const s = memory();
    addRecord(s, rec(5, 200));
    const r = addRecord(s, rec(8, 400));
    expect(r.isNewBest).toBe(true);
    expect(getBest(s, 'reaction')?.rounds).toBe(8);
    expect(addRecord(s, rec(6, 150)).isNewBest).toBe(false);
    expect(getBest(s, 'reaction')?.rounds).toBe(8);
  });

  it('라운드가 같으면 평균이 낮은 쪽이 최고 기록이다', () => {
    const s = memory();
    addRecord(s, rec(8, 400));
    expect(addRecord(s, rec(8, 350)).isNewBest).toBe(true);
    expect(addRecord(s, rec(8, 360)).isNewBest).toBe(false);
    expect(getBest(s, 'reaction')?.avgMs).toBe(350);
  });

  it('라운드 0, 100ms 미만, NaN 기록은 저장하지 않는다', () => {
    const s = memory();
    expect(addRecord(s, rec(0, 300)).saved).toBe(false);
    expect(addRecord(s, { ...rec(3, 300), bestMs: 99 }).saved).toBe(false);
    expect(addRecord(s, { ...rec(3, 300), avgMs: Number.NaN }).saved).toBe(false);
    expect(getRecent(s, 'reaction')).toHaveLength(0);
    expect(getBest(s, 'reaction')).toBeNull();
  });

  it('손상된 저장값은 무시한다', () => {
    const s = memory();
    s.set(recordsKey('reaction'), '{not json');
    expect(getBest(s, 'reaction')).toBeNull();
    expect(addRecord(s, rec(2, 300)).saved).toBe(true);
  });

  it('기록 키는 v2이고 예전 키의 기록은 읽지 않는다', () => {
    const s = memory();
    expect(recordsKey('reaction')).toBe('pb:records:v2:reaction');
    s.set('pb:records:reaction', JSON.stringify({ recent: [rec(30, 300)], best: rec(30, 300) }));
    expect(getBest(s, 'reaction')).toBeNull();
    expect(getRecent(s, 'reaction')).toHaveLength(0);
  });
});
