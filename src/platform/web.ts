// 일반 웹 브라우저용 플랫폼 어댑터
import type { KeyValueStorage, PlatformAdapter, PlayerIdentity, ShareOutcome } from './types';

export const DEVICE_ID_KEY = 'pb:device-id';
export const NICKNAME_KEY = 'pb:nickname';

function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
  };
}

function createLocalStorage(): KeyValueStorage {
  try {
    const store = window.localStorage;
    const probe = '__pb_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return {
      get: (key) => {
        try {
          return store.getItem(key);
        } catch {
          return null;
        }
      },
      set: (key, value) => {
        try {
          store.setItem(key, value);
        } catch {
          return;
        }
      },
    };
  } catch {
    return createMemoryStorage();
  }
}

export function randomId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function storedId(storage: KeyValueStorage, key: string): string {
  const existing = storage.get(key);
  if (existing && /^[A-Za-z0-9-]{8,64}$/.test(existing)) return existing;
  const id = randomId();
  storage.set(key, id);
  return id;
}

export function webIdentity(storage: KeyValueStorage): PlayerIdentity {
  const nickname = storage.get(NICKNAME_KEY) ?? '';
  return { playerId: `web:${storedId(storage, DEVICE_ID_KEY)}`, nickname, needsNickname: nickname.length === 0 };
}

export async function webShare(text: string): Promise<ShareOutcome> {
  const nav = globalThis.navigator as (Navigator & { share?: (data: ShareData) => Promise<void> }) | undefined;
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await nav?.clipboard?.writeText(text);
    if (nav?.clipboard) return 'copied';
  } catch {
    return 'failed';
  }
  return 'failed';
}

export function createWebStorage(): KeyValueStorage {
  return createLocalStorage();
}

export function createWebPlatform(): PlatformAdapter {
  const storage = createLocalStorage();
  return {
    name: 'web',
    storage,
    identity: async () => webIdentity(storage),
    share: webShare,
    leaderboard: {
      available: async () => false,
      submit: async () => 'unsupported',
      open: async () => undefined,
    },
    profile: async () => null,
    ads: {
      preload: () => undefined,
      isReady: () => false,
      showRewarded: async () => 'unavailable',
    },
  };
}
