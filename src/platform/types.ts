// 플랫폼 어댑터 인터페이스
import type { RankingClient } from '../app/ranking-client';
import type { RewardOutcome } from '../core/ads';
import type { SubmitOutcome } from '../core/leaderboard';

export type { RewardOutcome, SubmitOutcome };

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface PlayerProfile {
  nickname: string;
  imageUri: string;
}

export interface LeaderboardPort {
  available(): Promise<boolean>;
  submit(score: string): Promise<SubmitOutcome>;
  open(): Promise<void>;
}

export interface RewardedAdPort {
  preload(): void;
  isReady(): boolean;
  showRewarded(): Promise<RewardOutcome>;
}

export interface PlayerIdentity {
  playerId: string;
  nickname: string;
  needsNickname: boolean;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface PlatformAdapter {
  name: 'web' | 'apps-in-toss' | 'mock';
  storage: KeyValueStorage;
  leaderboard: LeaderboardPort;
  profile(): Promise<PlayerProfile | null>;
  ads: RewardedAdPort;
  identity(): Promise<PlayerIdentity | null>;
  share(text: string): Promise<ShareOutcome>;
  rankingClient?: RankingClient;
}
