// 목업 빌드 전용 E2E 테스트 훅 (운영 빌드에서는 제거됨)
type HookWindow = Window & { __pbTest?: Record<string, unknown> };

export function exposeTest(gameId: string, api: Record<string, unknown>): void {
  if (import.meta.env.VITE_PLATFORM !== 'mock') return;
  (window as HookWindow).__pbTest = { gameId, ...api };
}

export function clearTest(): void {
  if (import.meta.env.VITE_PLATFORM !== 'mock') return;
  delete (window as HookWindow).__pbTest;
}
