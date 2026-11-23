// 모의 플랫폼 단위 테스트
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyValueStorage } from './types';
import { createFakeRankingClient, createMockPlatform, mockAdOutcome } from './mock';

function memory(): KeyValueStorage {
  const map = new Map<string, string>();
  return { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('mock platform', () => {
  it('가짜 광고는 1500ms 뒤 rewarded', async () => {
    const p = createMockPlatform('');
    const outcome = p.ads.showRewarded();
    let done = false;
    outcome.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(outcome).resolves.toBe('rewarded');
  });

  it('mockAd=failed면 failed', async () => {
    const outcome = createMockPlatform('?mockAd=failed').ads.showRewarded();
    await vi.advanceTimersByTimeAsync(1500);
    await expect(outcome).resolves.toBe('failed');
    expect(mockAdOutcome('?mockAd=weird')).toBe('rewarded');
  });
});

describe('fake ranking client', () => {
  it('봇과 함께 점수순으로 정렬하고 내 순위를 준다', async () => {
    const client = createFakeRankingClient(memory());
    const sub = { gameId: 'reaction', playerId: 'toss:mock-12345678', nickname: '목업 플레이어', rounds: 12, avgMs: 160, bestMs: 140 };
    const r = await client.submit(sub);
    expect(r).toMatchObject({ kind: 'ok', data: { status: 'improved', rank: 3 } });
    const b = await client.board('reaction', sub.playerId);
    if (b.kind !== 'ok') throw new Error('board');
    expect(b.data.top.map((row) => row.nickname)).toEqual(['번개손', '반응왕', '목업 플레이어', '손가락요정', '초보탈출', '느긋한곰']);
    expect(b.data.me?.rank).toBe(3);
    expect(b.data.top[2].isMe).toBe(true);
    const kept = await client.submit({ ...sub, rounds: 5, avgMs: 300, bestMs: 250 });
    expect(kept).toMatchObject({ kind: 'ok', data: { status: 'kept', rank: 3, rounds: 12 } });
  });
});
