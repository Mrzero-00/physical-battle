// 랭킹 저장소 인터페이스
export interface RankEntry {
  member: string;
  score: number;
}

export interface RankStore {
  zscore(key: string, member: string): Promise<number | null>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zrevrank(key: string, member: string): Promise<number | null>;
  ztop(key: string, count: number): Promise<RankEntry[]>;
  zcard(key: string): Promise<number>;
  hset(key: string, field: string, value: string): Promise<void>;
  hmget(key: string, fields: string[]): Promise<Array<string | null>>;
  incrWithExpire(key: string, ttlSeconds: number): Promise<number>;
}
