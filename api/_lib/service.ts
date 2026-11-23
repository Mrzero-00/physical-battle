// 전체 랭킹 API 서비스 (검증·레이트리밋·CORS·순위 조회)
import {
  decodeScore,
  encodeScore,
  RANKED_GAME_IDS,
  rateLimitDecision,
  TOP_LIMIT,
  validateSubmission,
} from '../../src/core/ranking.js';
import type { RankStore } from './store.js';

export const DEFAULT_ALLOWED_ORIGINS = ['https://physical-battle.vercel.app'];
const PLAYER_ID = /^(toss|web):[A-Za-z0-9+/=_-]{8,128}$/;

export interface ServiceOptions {
  store: RankStore | null;
  allowedOrigins: string[];
  now?: () => number;
}

interface Meta {
  nickname: string;
  bestMs: number;
  at: number;
}

const rankKey = (gameId: string) => `pb:rank:v1:${gameId}`;
const metaKey = (gameId: string) => `pb:rank:v1:${gameId}:meta`;

function parseMeta(raw: string | null): Meta | null {
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as Partial<Meta>;
    return typeof m.nickname === 'string' ? { nickname: m.nickname, bestMs: Number(m.bestMs) || 0, at: Number(m.at) || 0 } : null;
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(env: string | undefined): string[] {
  const extra = (env ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra];
}

export function createRankingService(options: ServiceOptions) {
  const now = options.now ?? (() => Date.now());

  const corsHeaders = (origin: string | null): Record<string, string> => {
    if (!origin || !options.allowedOrigins.includes(origin)) return {};
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    };
  };

  const json = (status: number, body: unknown, origin: string | null) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(origin) },
    });

  const originAllowed = (origin: string | null) => origin === null || options.allowedOrigins.includes(origin);

  async function board(store: RankStore, gameId: string, playerId: string | null) {
    const top = await store.ztop(rankKey(gameId), TOP_LIMIT);
    const metas = await store.hmget(
      metaKey(gameId),
      top.map((e) => e.member),
    );
    const entries = top.map((e, i) => {
      const { rounds, avgMs } = decodeScore(e.score);
      return {
        rank: i + 1,
        nickname: parseMeta(metas[i])?.nickname ?? '플레이어',
        rounds,
        avgMs,
        isMe: playerId !== null && e.member === playerId,
      };
    });
    let me: { rank: number; nickname: string; rounds: number; avgMs: number } | null = null;
    if (playerId) {
      const [score, rank] = await Promise.all([store.zscore(rankKey(gameId), playerId), store.zrevrank(rankKey(gameId), playerId)]);
      if (score !== null && rank !== null) {
        const [raw] = await store.hmget(metaKey(gameId), [playerId]);
        me = { rank: rank + 1, nickname: parseMeta(raw)?.nickname ?? '플레이어', ...decodeScore(score) };
      }
    }
    return { top: entries, me, total: await store.zcard(rankKey(gameId)) };
  }

  async function handle(request: Request): Promise<Response> {
    const origin = request.headers.get('origin');
    if (request.method === 'OPTIONS') {
      return originAllowed(origin) ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
    }
    if (!originAllowed(origin)) return json(403, { error: 'origin' }, null);
    const store = options.store;
    if (!store) return json(503, { error: 'not-configured' }, origin);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const gameId = url.searchParams.get('gameId') ?? '';
      if (!(RANKED_GAME_IDS as readonly string[]).includes(gameId)) return json(400, { error: 'invalid-game' }, origin);
      const rawPlayer = url.searchParams.get('playerId');
      const playerId = rawPlayer && PLAYER_ID.test(rawPlayer) ? rawPlayer : null;
      return json(200, await board(store, gameId, playerId), origin);
    }

    if (request.method === 'POST') {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json(400, { error: 'invalid-json' }, origin);
      }
      const checked = validateSubmission(body);
      if (!checked.ok) return json(400, { error: checked.error }, origin);
      const s = checked.value;
      const count = await store.incrWithExpire(`pb:rl:${s.playerId}:${Math.floor(now() / 60000)}`, 120);
      if (!rateLimitDecision(count)) return json(429, { error: 'rate-limited' }, origin);

      const key = rankKey(s.gameId);
      const score = encodeScore(s.rounds, s.avgMs);
      const previous = await store.zscore(key, s.playerId);
      const improved = previous === null || score > previous;
      if (improved) {
        await store.zadd(key, score, s.playerId);
        await store.hset(metaKey(s.gameId), s.playerId, JSON.stringify({ nickname: s.nickname, bestMs: s.bestMs, at: now() }));
      } else {
        const [raw] = await store.hmget(metaKey(s.gameId), [s.playerId]);
        const meta = parseMeta(raw);
        await store.hset(
          metaKey(s.gameId),
          s.playerId,
          JSON.stringify({ nickname: s.nickname, bestMs: meta?.bestMs ?? s.bestMs, at: meta?.at ?? now() }),
        );
      }
      const rank = await store.zrevrank(key, s.playerId);
      const stored = decodeScore(improved ? score : (previous as number));
      return json(200, { status: improved ? 'improved' : 'kept', rank: (rank ?? 0) + 1, ...stored }, origin);
    }

    return json(405, { error: 'method' }, origin);
  }

  return { handle };
}
