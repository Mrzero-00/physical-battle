// 실행 환경에 맞는 플랫폼 어댑터 선택
import { createAppsInTossPlatform } from './apps-in-toss';
import { createMockPlatform } from './mock';
import type { PlatformAdapter } from './types';
import { createWebPlatform } from './web';

export type {
  KeyValueStorage,
  LeaderboardPort,
  PlatformAdapter,
  PlayerIdentity,
  PlayerProfile,
  RewardOutcome,
  ShareOutcome,
  SubmitOutcome,
} from './types';

export function getPlatform(): PlatformAdapter {
  if (import.meta.env.VITE_PLATFORM === 'apps-in-toss') return createAppsInTossPlatform();
  if (import.meta.env.VITE_PLATFORM === 'mock') return createMockPlatform();
  return createWebPlatform();
}
