// 일반 웹 브라우저용 플랫폼 어댑터
import type { KeyValueStorage, PlatformAdapter } from './types';

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

export function createWebPlatform(): PlatformAdapter {
  return { name: 'web', storage: createLocalStorage() };
}
