// 전체 랭킹 API 클라이언트 단위 테스트 (가짜 fetch)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRankingClient, joinUrl } from './ranking-client';

const sub = { gameId: 'reaction', playerId: 'web:aaaaaaaa-1', nickname: '테스터', rounds: 3, avgMs: 200, bestMs: 180 };
const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

afterEach(() => vi.useRealTimers());

describe('ranking client', () => {
  it('200이면 ok', async () => {
    const f = reply(200, { status: 'improved', rank: 3, rounds: 3, avgMs: 200 });
    const r = await createRankingClient(f, '').submit(sub);
    expect(r).toEqual({ kind: 'ok', data: { status: 'improved', rank: 3, rounds: 3, avgMs: 200 } });
  });

  it.each([
    [400, 'invalid'],
    [429, 'rate-limited'],
    [503, 'not-configured'],
    [404, 'offline'],
    [500, 'error'],
  ])('%i → %s', async (status, kind) => {
    expect(await createRankingClient(reply(status, { error: 'x' }), '').submit(sub)).toEqual({ kind });
  });

  it('fetch가 throw하면 offline', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await createRankingClient(f, '').board('reaction', null)).toEqual({ kind: 'offline' });
  });

  it('5초 안에 응답이 없으면 offline', async () => {
    vi.useFakeTimers();
    const f = vi.fn(
      (_: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    );
    const p = createRankingClient(f, '').board('reaction', null);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toEqual({ kind: 'offline' });
  });

  it('형식이 이상한 JSON이면 error', async () => {
    expect(await createRankingClient(reply(200, { nope: true }), '').board('reaction', null)).toEqual({ kind: 'error' });
    expect(await createRankingClient(reply(200, 'not json'), '').board('reaction', null)).toEqual({ kind: 'error' });
  });

  it('토스 base와 경로를 합친다', async () => {
    const f = reply(200, { top: [], me: null, total: 0 });
    await createRankingClient(f, 'https://physical-battle.vercel.app/').board('reaction', 'toss:abcdefgh');
    expect(f).toHaveBeenCalledWith(
      'https://physical-battle.vercel.app/api/ranking?gameId=reaction&playerId=toss%3Aabcdefgh',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(joinUrl('', '/api/ranking')).toBe('/api/ranking');
  });
});
