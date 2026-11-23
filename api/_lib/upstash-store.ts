// Upstash Redis 랭킹 저장소
import { Redis } from '@upstash/redis';
import type { RankStore } from './store.js';

export function upstashConfigFromEnv(env: Record<string, string | undefined>): { url: string; token: string } | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export function createUpstashStore(config: { url: string; token: string }): RankStore {
  const redis = new Redis({ url: config.url, token: config.token, automaticDeserialization: false });
  return {
    async zscore(key, member) {
      const v = await redis.zscore(key, member);
      return v === null || v === undefined ? null : Number(v);
    },
    async zadd(key, score, member) {
      await redis.zadd(key, { score, member });
    },
    async zrevrank(key, member) {
      const v = await redis.zrevrank(key, member);
      return v === null || v === undefined ? null : Number(v);
    },
    async ztop(key, count) {
      const raw = (await redis.zrange(key, 0, count - 1, { rev: true, withScores: true })) as Array<string | number>;
      const out: Array<{ member: string; score: number }> = [];
      for (let i = 0; i + 1 < raw.length; i += 2) out.push({ member: String(raw[i]), score: Number(raw[i + 1]) });
      return out;
    },
    async zcard(key) {
      return Number(await redis.zcard(key));
    },
    async hset(key, field, value) {
      await redis.hset(key, { [field]: value });
    },
    async hmget(key, fields) {
      if (fields.length === 0) return [];
      const v = (await redis.hmget(key, ...fields)) as unknown;
      const pick = (x: unknown) => (x === null || x === undefined ? null : typeof x === 'string' ? x : JSON.stringify(x));
      if (Array.isArray(v)) return fields.map((_, i) => pick(v[i]));
      const record = (v ?? {}) as Record<string, unknown>;
      return fields.map((f) => pick(record[f]));
    },
    async incrWithExpire(key, ttlSeconds) {
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, ttlSeconds);
      return n;
    },
  };
}
