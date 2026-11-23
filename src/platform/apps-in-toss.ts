// 앱인토스(토스 미니앱) 플랫폼 어댑터 — 게임센터 리더보드·보상형 광고
import { reduceAdEvent, startAd, type AdEventType, type AdState } from '../core/ads';
import { mapSubmitResponse } from '../core/leaderboard';
import type { PlatformAdapter, PlayerProfile, RewardOutcome, SubmitOutcome } from './types';
import { createWebStorage } from './web';

type Version = `${number}.${number}.${number}`;

type FullScreenAdFn = ((params: {
  options?: { adGroupId: string };
  onEvent: (event: { type: string }) => void;
  onError: (error: Error) => void;
}) => () => void) & { isSupported: () => boolean };

export interface AppsInTossSdk {
  isMinVersionSupported(min: { android: Version; ios: Version }): boolean;
  submitGameCenterLeaderBoardScore(params: { score: string }): Promise<unknown>;
  openGameCenterLeaderboard(): Promise<void>;
  getGameCenterGameProfile(): Promise<unknown>;
  loadFullScreenAd: FullScreenAdFn;
  showFullScreenAd: FullScreenAdFn;
}

export interface AdRuntime {
  now(): number;
  every(ms: number, fn: () => void): () => void;
  onVisible(fn: () => void): () => void;
}

export const TEST_REWARDED_AD_ID = 'ait-ad-test-rewarded-id';
export const LEADERBOARD_MIN_VERSION = { android: '5.221.0', ios: '5.221.0' } as const;
export const AVAILABILITY_TIMEOUT_MS = 1500;
const TICK_MS = 250;
const AD_EVENTS = new Set<AdEventType>([
  'requested',
  'show',
  'impression',
  'clicked',
  'userEarnedReward',
  'dismissed',
  'failedToShow',
]);

export const browserAdRuntime: AdRuntime = {
  now: () => Date.now(),
  every: (ms, fn) => {
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  },
  onVisible: (fn) => {
    const handler = () => {
      if (document.visibilityState === 'visible') fn();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  },
};

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function toProfile(res: unknown): PlayerProfile | null {
  if (typeof res !== 'object' || res === null) return null;
  const r = res as { statusCode?: unknown; nickname?: unknown; profileImageUri?: unknown };
  if (r.statusCode !== 'SUCCESS' || typeof r.nickname !== 'string') return null;
  return { nickname: r.nickname, imageUri: typeof r.profileImageUri === 'string' ? r.profileImageUri : '' };
}

export interface AppsInTossOptions {
  loadSdk?: () => Promise<AppsInTossSdk>;
  adGroupId?: string;
  runtime?: AdRuntime;
}

export function createAppsInTossPlatform(options: AppsInTossOptions = {}): PlatformAdapter {
  const loadSdk = options.loadSdk ?? (() => import('@apps-in-toss/web-framework') as Promise<AppsInTossSdk>);
  const adGroupId = options.adGroupId ?? (import.meta.env.VITE_AD_REWARDED_ID || TEST_REWARDED_AD_ID);
  const runtime = options.runtime ?? browserAdRuntime;

  let sdkPromise: Promise<AppsInTossSdk> | null = null;
  const sdk = () => {
    sdkPromise ??= loadSdk();
    return sdkPromise;
  };

  let availability: Promise<boolean> | null = null;
  let adPhase: 'idle' | 'loading' | 'ready' | 'showing' = 'idle';

  const preload = () => {
    if (adPhase !== 'idle') return;
    adPhase = 'loading';
    sdk()
      .then((s) => {
        if (!s.loadFullScreenAd.isSupported()) {
          adPhase = 'idle';
          return;
        }
        let unregister: (() => void) | null = null;
        const release = () => {
          unregister?.();
          unregister = null;
        };
        unregister = s.loadFullScreenAd({
          options: { adGroupId },
          onEvent: (event) => {
            if (event.type === 'loaded' && adPhase === 'loading') adPhase = 'ready';
            release();
          },
          onError: () => {
            if (adPhase === 'loading') adPhase = 'idle';
            release();
          },
        });
      })
      .catch(() => {
        if (adPhase === 'loading') adPhase = 'idle';
      });
  };

  const showRewarded = async (): Promise<RewardOutcome> => {
    if (adPhase !== 'ready') return 'unavailable';
    adPhase = 'showing';
    let s: AppsInTossSdk;
    try {
      s = await sdk();
    } catch {
      adPhase = 'idle';
      return 'failed';
    }
    return new Promise<RewardOutcome>((resolve) => {
      let state: AdState = startAd(runtime.now());
      let settled = false;
      let unregister: () => void = () => undefined;
      let stopTick: () => void = () => undefined;
      let stopVisible: () => void = () => undefined;

      const feed = (type: AdEventType) => {
        if (settled) return;
        state = reduceAdEvent(state, { type, at: runtime.now() });
        if (!state.done) return;
        settled = true;
        unregister();
        stopTick();
        stopVisible();
        adPhase = 'idle';
        resolve(state.outcome ?? 'failed');
        preload();
      };

      stopTick = runtime.every(TICK_MS, () => feed('tick'));
      stopVisible = runtime.onVisible(() => feed('visible'));
      try {
        unregister = s.showFullScreenAd({
          options: { adGroupId },
          onEvent: (event) => {
            if (AD_EVENTS.has(event.type as AdEventType)) feed(event.type as AdEventType);
          },
          onError: () => feed('error'),
        });
      } catch {
        feed('error');
      }
      if (settled) unregister();
    });
  };

  return {
    name: 'apps-in-toss',
    storage: createWebStorage(),
    leaderboard: {
      available() {
        availability ??= withTimeout(
          sdk().then((s) => s.isMinVersionSupported(LEADERBOARD_MIN_VERSION)),
          AVAILABILITY_TIMEOUT_MS,
          false,
        );
        return availability;
      },
      async submit(score: string): Promise<SubmitOutcome> {
        try {
          const s = await sdk();
          return mapSubmitResponse(await s.submitGameCenterLeaderBoardScore({ score }));
        } catch {
          return 'error';
        }
      },
      async open() {
        const s = await sdk();
        await s.openGameCenterLeaderboard();
      },
    },
    async profile() {
      try {
        const s = await sdk();
        return toProfile(await s.getGameCenterGameProfile());
      } catch {
        return null;
      }
    },
    ads: {
      preload,
      isReady: () => adPhase === 'ready',
      showRewarded,
    },
  };
}
