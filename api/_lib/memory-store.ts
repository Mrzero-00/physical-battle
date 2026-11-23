// 메모리 랭킹 저장소 (테스트·로컬용)
import type { RankEntry, RankStore } from './store.js';

export function createMemoryStore(): RankStore {
  const zsets = new Map<string, Map<string, number>>();
  const hashes = new Map<string, Map<string, string>>();
  const counters = new Map<string, number>();
  const zset = (key: string) => {
    let z = zsets.get(key);
    if (!z) zsets.set(key, (z = new Map()));
    return z;
  };
  const sorted = (key: string): RankEntry[] =>
    [...zset(key).entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => b.score - a.score || (a.member < b.member ? 1 : a.member > b.member ? -1 : 0));
  return {
    async zscore(key, member) {
      return zset(key).get(member) ?? null;
    },
    async zadd(key, score, member) {
      zset(key).set(member, score);
    },
    async zrevrank(key, member) {
      const i = sorted(key).findIndex((e) => e.member === member);
      return i === -1 ? null : i;
    },
    async ztop(key, count) {
      return sorted(key).slice(0, count);
    },
    async zcard(key) {
      return zset(key).size;
    },
    async hset(key, field, value) {
      let h = hashes.get(key);
      if (!h) hashes.set(key, (h = new Map()));
      h.set(field, value);
    },
    async hmget(key, fields) {
      const h = hashes.get(key);
      return fields.map((f) => h?.get(f) ?? null);
    },
    async incrWithExpire(key) {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    },
  };
}
