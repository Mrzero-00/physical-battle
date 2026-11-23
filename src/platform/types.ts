// 플랫폼 어댑터 인터페이스
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface PlatformAdapter {
  name: 'web' | 'apps-in-toss';
  storage: KeyValueStorage;
}
