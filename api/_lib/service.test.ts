// 전체 랭킹 API 서비스 단위 테스트 (메모리 저장소)
import { describe, expect, it } from 'vitest';
import { createMemoryStore } from './memory-store';
import { createRankingService, metaKey, parseAllowedOrigins, rankKey } from './service';

const ALLOWED = 'https://physical-battle.vercel.app';

function setup(store = createMemoryStore()) {
  let t = 1_700_000_000_000;
  const svc = createRankingService({ store, allowedOrigins: parseAllowedOrigins('https://toss.example'), now: () => t });
  return { svc, store, advance: (ms: number) => (t += ms) };
}

const submission = (over: Record<string, unknown> = {}) => ({
  gameId: 'reaction',
  playerId: 'web:aaaaaaaa-0000-4000-8000-000000000001',
  nickname: '테스터',
  rounds: 10,
  avgMs: 200,
  bestMs: 150,
  ...over,
});

const post = (body: unknown, origin: string | null = ALLOWED) =>
  new Request('https://physical-battle.vercel.app/api/ranking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const get = (query: string, origin: string | null = ALLOWED) =>
  new Request(`https://physical-battle.vercel.app/api/ranking?${query}`, { headers: origin ? { Origin: origin } : {} });

describe('ranking service', () => {
  it('첫 제출은 improved, 1위', async () => {
    const { svc } = setup();
    const res = await svc.handle(post(submission()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'improved', rank: 1, rounds: 10, avgMs: 200 });
  });

  it('더 낮은 기록은 kept이고 점수는 그대로', async () => {
    const { svc } = setup();
    await svc.handle(post(submission()));
    const res = await svc.handle(post(submission({ rounds: 8, avgMs: 180, nickname: '새이름' })));
    expect(await res.json()).toEqual({ status: 'kept', rank: 1, rounds: 10, avgMs: 200 });
    const board = await (await svc.handle(get('gameId=reaction'))).json();
    expect(board.top[0]).toMatchObject({ nickname: '새이름', rounds: 10, avgMs: 200 });
  });

  it('분당 11번째 요청은 429, 다음 분에는 다시 허용', async () => {
    const { svc, advance } = setup();
    for (let i = 0; i < 10; i++) expect((await svc.handle(post(submission()))).status).toBe(200);
    expect((await svc.handle(post(submission()))).status).toBe(429);
    advance(60_000);
    expect((await svc.handle(post(submission()))).status).toBe(200);
  });

  it('잘못된 body·JSON은 400', async () => {
    const { svc } = setup();
    const bad = await svc.handle(post(submission({ rounds: 0 })));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'invalid-rounds' });
    expect((await svc.handle(post('{oops'))).status).toBe(400);
  });

  it('GET은 TOP 100, 정렬, isMe, me.rank, 플레이어 ID 비노출', async () => {
    const { svc } = setup();
    for (let i = 0; i < 105; i++) {
      await svc.handle(
        post(submission({ playerId: `web:player-${String(i).padStart(4, '0')}`, nickname: `p${i}`, rounds: 1 + (i % 30), avgMs: 150 + i })),
      );
    }
    await svc.handle(post(submission({ playerId: 'toss:hashhashhash', nickname: '토스왕', rounds: 31, avgMs: 160 })));
    const res = await svc.handle(get('gameId=reaction&playerId=toss:hashhashhash'));
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    expect(text).not.toContain('toss:');
    expect(text).not.toContain('web:');
    const body = JSON.parse(text);
    expect(body.top).toHaveLength(100);
    expect(body.total).toBe(106);
    expect(body.top[0]).toMatchObject({ rank: 1, nickname: '토스왕', rounds: 31, isMe: true });
    expect(body.me).toMatchObject({ rank: 1, nickname: '토스왕' });
    for (let i = 1; i < body.top.length; i++) {
      const a = body.top[i - 1];
      const b = body.top[i];
      expect(a.rounds > b.rounds || (a.rounds === b.rounds && a.avgMs <= b.avgMs)).toBe(true);
    }
  });

  it('기록 없는 플레이어는 me가 null', async () => {
    const { svc } = setup();
    const body = await (await svc.handle(get('gameId=reaction&playerId=web:nobody-000'))).json();
    expect(body).toEqual({ top: [], me: null, total: 0 });
  });

  it('허용되지 않은 Origin에는 ACAO가 없고 거부된다', async () => {
    const { svc } = setup();
    const res = await svc.handle(post(submission(), 'https://evil.example'));
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    const pre = await svc.handle(new Request('https://x/api/ranking', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }));
    expect(pre.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('허용된 Origin의 OPTIONS는 204와 CORS 헤더', async () => {
    const { svc } = setup();
    const res = await svc.handle(new Request('https://x/api/ranking', { method: 'OPTIONS', headers: { Origin: 'https://toss.example' } }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://toss.example');
  });

  it('같은 출처(Origin 없음)는 허용', async () => {
    const { svc } = setup();
    expect((await svc.handle(post(submission(), null))).status).toBe(200);
  });

  it('저장소가 없으면 503', async () => {
    const svc = createRankingService({ store: null, allowedOrigins: [ALLOWED] });
    const res = await svc.handle(get('gameId=reaction'));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'not-configured' });
  });

  it('잘못된 gameId 조회는 400', async () => {
    const { svc } = setup();
    expect((await svc.handle(get('gameId=x'))).status).toBe(400);
  });

  it('랭킹 키는 v2이고 v1 데이터는 읽지 않는다', async () => {
    const store = createMemoryStore();
    await store.zadd('pb:rank:v1:reaction', 5_000_000, 'web:old-player-01');
    await store.hset('pb:rank:v1:reaction:meta', 'web:old-player-01', JSON.stringify({ nickname: '옛기록', bestMs: 150, at: 1 }));
    const { svc } = setup(store);
    const before = await (await svc.handle(get('gameId=reaction&playerId=web:old-player-01'))).json();
    expect(before).toEqual({ top: [], me: null, total: 0 });
    await svc.handle(post(submission()));
    expect(await store.zcard('pb:rank:v2:reaction')).toBe(1);
    const [meta] = await store.hmget('pb:rank:v2:reaction:meta', ['web:aaaaaaaa-0000-4000-8000-000000000001']);
    expect(meta).toContain('테스터');
    expect(rankKey('reaction')).toBe('pb:rank:v2:reaction');
    expect(metaKey('reaction')).toBe('pb:rank:v2:reaction:meta');
  });

  it('vision 기록은 게임별 키에 저장되고 reaction에 영향이 없다', async () => {
    const { svc, store } = setup();
    await svc.handle(post(submission()));
    const res = await svc.handle(post(submission({ gameId: 'vision', playerId: 'web:vision-player-1', avgMs: 820, bestMs: 500 })));
    expect(res.status).toBe(200);
    expect(await store.zcard('pb:rank:v2:vision')).toBe(1);
    const reaction = await (await svc.handle(get('gameId=reaction'))).json();
    expect(reaction.total).toBe(1);
  });

  it('timing·tapspeed는 게임별 규칙으로 받는다', async () => {
    const { svc } = setup();
    expect((await svc.handle(post(submission({ gameId: 'timing', playerId: 'web:timing-player', avgMs: 12, bestMs: 0 })))).status).toBe(200);
    expect((await svc.handle(post(submission({ gameId: 'tapspeed', playerId: 'web:tap-player-1', rounds: 80, avgMs: 9800, bestMs: 60 })))).status).toBe(200);
    expect((await svc.handle(post(submission({ gameId: 'tapspeed', playerId: 'web:tap-player-2', rounds: 249, avgMs: 10000, bestMs: 40 })))).status).toBe(400);
    expect((await svc.handle(post(submission({ gameId: 'timing', playerId: 'web:timing-player2', avgMs: 121, bestMs: 10 })))).status).toBe(400);
  });
});
