// 앱인토스 어댑터 단위 테스트 (가짜 SDK)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppsInTossPlatform, TEST_REWARDED_AD_ID, type AdRuntime, type AppsInTossSdk } from './apps-in-toss';

type Handlers = { onEvent: (e: { type: string }) => void; onError: (e: Error) => void; options?: { adGroupId: string } };

function fakeSdk(over: Partial<AppsInTossSdk> = {}) {
  const loads: Handlers[] = [];
  const shows: Handlers[] = [];
  const loadFullScreenAd = Object.assign(
    vi.fn((p: Handlers) => {
      loads.push(p);
      return () => undefined;
    }),
    { isSupported: vi.fn(() => true) },
  );
  const showFullScreenAd = Object.assign(
    vi.fn((p: Handlers) => {
      shows.push(p);
      return () => undefined;
    }),
    { isSupported: vi.fn(() => true) },
  );
  const sdk: AppsInTossSdk = {
    isMinVersionSupported: vi.fn(() => true),
    submitGameCenterLeaderBoardScore: vi.fn(async () => ({ statusCode: 'SUCCESS' })),
    openGameCenterLeaderboard: vi.fn(async () => undefined),
    getGameCenterGameProfile: vi.fn(async () => ({ statusCode: 'SUCCESS', nickname: '번개손', profileImageUri: 'https://x/y.png' })),
    loadFullScreenAd,
    showFullScreenAd,
    ...over,
  };
  return { sdk, loads, shows, loadFullScreenAd, showFullScreenAd };
}

function fakeRuntime() {
  let now = 0;
  const visible: Array<() => void> = [];
  const runtime: AdRuntime = {
    now: () => now,
    every: (ms, fn) => {
      const id = setInterval(fn, ms);
      return () => clearInterval(id);
    },
    onVisible: (fn) => {
      visible.push(fn);
      return () => visible.splice(visible.indexOf(fn), 1);
    },
  };
  return {
    runtime,
    advance: async (ms: number) => {
      for (let left = ms; left > 0; left -= 50) {
        const step = Math.min(50, left);
        now += step;
        await vi.advanceTimersByTimeAsync(step);
      }
    },
    becomeVisible: () => [...visible].forEach((fn) => fn()),
  };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('leaderboard', () => {
  it('submit이 throw하면 error', async () => {
    const { sdk } = fakeSdk({ submitGameCenterLeaderBoardScore: vi.fn(async () => Promise.reject(new Error('x'))) });
    const p = createAppsInTossPlatform({ loadSdk: async () => sdk });
    await expect(p.leaderboard.submit('3')).resolves.toBe('error');
  });

  it('submit이 undefined면 unsupported, SUCCESS면 submitted', async () => {
    const { sdk } = fakeSdk({ submitGameCenterLeaderBoardScore: vi.fn(async () => undefined) });
    await expect(createAppsInTossPlatform({ loadSdk: async () => sdk }).leaderboard.submit('3')).resolves.toBe('unsupported');
    const ok = fakeSdk();
    const p = createAppsInTossPlatform({ loadSdk: async () => ok.sdk });
    await expect(p.leaderboard.submit('23')).resolves.toBe('submitted');
    expect(ok.sdk.submitGameCenterLeaderBoardScore).toHaveBeenCalledWith({ score: '23' });
  });

  it('최소 버전 미만이면 available은 false', async () => {
    const { sdk } = fakeSdk({ isMinVersionSupported: vi.fn(() => false) });
    await expect(createAppsInTossPlatform({ loadSdk: async () => sdk }).leaderboard.available()).resolves.toBe(false);
  });

  it('버전 확인이 throw하면 false', async () => {
    const { sdk } = fakeSdk({
      isMinVersionSupported: vi.fn(() => {
        throw new Error('no bridge');
      }),
    });
    await expect(createAppsInTossPlatform({ loadSdk: async () => sdk }).leaderboard.available()).resolves.toBe(false);
  });

  it('SDK 로드가 1500ms를 넘기면 false', async () => {
    const p = createAppsInTossPlatform({ loadSdk: () => new Promise<AppsInTossSdk>(() => undefined) });
    const result = p.leaderboard.available();
    await vi.advanceTimersByTimeAsync(1500);
    await expect(result).resolves.toBe(false);
  });

  it('available은 세션 동안 캐시된다', async () => {
    const { sdk } = fakeSdk();
    const p = createAppsInTossPlatform({ loadSdk: async () => sdk });
    await expect(p.leaderboard.available()).resolves.toBe(true);
    await p.leaderboard.available();
    expect(sdk.isMinVersionSupported).toHaveBeenCalledTimes(1);
  });

  it('profile 매핑', async () => {
    const ok = fakeSdk();
    await expect(createAppsInTossPlatform({ loadSdk: async () => ok.sdk }).profile()).resolves.toEqual({
      nickname: '번개손',
      imageUri: 'https://x/y.png',
    });
    const none = fakeSdk({ getGameCenterGameProfile: vi.fn(async () => ({ statusCode: 'PROFILE_NOT_FOUND' })) });
    await expect(createAppsInTossPlatform({ loadSdk: async () => none.sdk }).profile()).resolves.toBeNull();
    const old = fakeSdk({ getGameCenterGameProfile: vi.fn(async () => undefined) });
    await expect(createAppsInTossPlatform({ loadSdk: async () => old.sdk }).profile()).resolves.toBeNull();
  });
});

describe('rewarded ads', () => {
  it('로드 전에는 unavailable', async () => {
    const { sdk } = fakeSdk();
    const p = createAppsInTossPlatform({ loadSdk: async () => sdk, runtime: fakeRuntime().runtime });
    await expect(p.ads.showRewarded()).resolves.toBe('unavailable');
  });

  it('기본 광고 ID는 테스트 ID', async () => {
    const f = fakeSdk();
    const p = createAppsInTossPlatform({ loadSdk: async () => f.sdk, runtime: fakeRuntime().runtime });
    p.ads.preload();
    await flush();
    expect(f.loads[0].options).toEqual({ adGroupId: TEST_REWARDED_AD_ID });
  });

  it('loaded 후 보상과 dismissed가 오면 rewarded, 그리고 다시 preload', async () => {
    const f = fakeSdk();
    const rt = fakeRuntime();
    const p = createAppsInTossPlatform({ loadSdk: async () => f.sdk, runtime: rt.runtime });
    p.ads.preload();
    await flush();
    f.loads[0].onEvent({ type: 'loaded' });
    expect(p.ads.isReady()).toBe(true);
    const outcome = p.ads.showRewarded();
    await flush();
    f.shows[0].onEvent({ type: 'show' });
    f.shows[0].onEvent({ type: 'userEarnedReward' });
    f.shows[0].onEvent({ type: 'dismissed' });
    await expect(outcome).resolves.toBe('rewarded');
    await flush();
    expect(f.loadFullScreenAd).toHaveBeenCalledTimes(2);
  });

  it('dismissed가 오지 않아도 화면 복귀 후 resolve', async () => {
    const f = fakeSdk();
    const rt = fakeRuntime();
    const p = createAppsInTossPlatform({ loadSdk: async () => f.sdk, runtime: rt.runtime });
    p.ads.preload();
    await flush();
    f.loads[0].onEvent({ type: 'loaded' });
    const outcome = p.ads.showRewarded();
    await flush();
    f.shows[0].onEvent({ type: 'show' });
    f.shows[0].onEvent({ type: 'userEarnedReward' });
    await rt.advance(3000);
    rt.becomeVisible();
    await rt.advance(1250);
    await expect(outcome).resolves.toBe('rewarded');
  });

  it('show 이벤트가 오지 않으면 5초 뒤 failed', async () => {
    const f = fakeSdk();
    const rt = fakeRuntime();
    const p = createAppsInTossPlatform({ loadSdk: async () => f.sdk, runtime: rt.runtime });
    p.ads.preload();
    await flush();
    f.loads[0].onEvent({ type: 'loaded' });
    const outcome = p.ads.showRewarded();
    await rt.advance(5250);
    await expect(outcome).resolves.toBe('failed');
  });

  it('onError면 failed', async () => {
    const f = fakeSdk();
    const p = createAppsInTossPlatform({ loadSdk: async () => f.sdk, runtime: fakeRuntime().runtime });
    p.ads.preload();
    await flush();
    f.loads[0].onEvent({ type: 'loaded' });
    const outcome = p.ads.showRewarded();
    await flush();
    f.shows[0].onError(new Error('no fill'));
    await expect(outcome).resolves.toBe('failed');
  });

  it('isSupported가 false면 load를 호출하지 않는다', async () => {
    const f = fakeSdk();
    f.loadFullScreenAd.isSupported.mockReturnValue(false);
    const p = createAppsInTossPlatform({ loadSdk: async () => f.sdk, runtime: fakeRuntime().runtime });
    p.ads.preload();
    await flush();
    expect(f.loadFullScreenAd).not.toHaveBeenCalled();
    await expect(p.ads.showRewarded()).resolves.toBe('unavailable');
  });

  it('로드 중 preload를 여러 번 불러도 load는 1회', async () => {
    const f = fakeSdk();
    const p = createAppsInTossPlatform({ loadSdk: async () => f.sdk, runtime: fakeRuntime().runtime });
    p.ads.preload();
    p.ads.preload();
    await flush();
    p.ads.preload();
    expect(f.loadFullScreenAd).toHaveBeenCalledTimes(1);
  });

  it('로드 실패 후에는 다시 preload할 수 있다', async () => {
    const f = fakeSdk();
    const p = createAppsInTossPlatform({ loadSdk: async () => f.sdk, runtime: fakeRuntime().runtime });
    p.ads.preload();
    await flush();
    f.loads[0].onError(new Error('timeout'));
    expect(p.ads.isReady()).toBe(false);
    p.ads.preload();
    await flush();
    expect(f.loadFullScreenAd).toHaveBeenCalledTimes(2);
  });
});
