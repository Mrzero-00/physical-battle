// 실행 환경에 맞는 플랫폼 어댑터 선택
import type { PlatformAdapter } from './types';
import { createWebPlatform } from './web';

export type { PlatformAdapter, KeyValueStorage } from './types';

export function getPlatform(): PlatformAdapter {
  return createWebPlatform();
}
