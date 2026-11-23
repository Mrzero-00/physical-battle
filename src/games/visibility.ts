// 홈·탭에서 숨길 게임 목록 (여기에 id를 넣으면 숨김)
export const HIDDEN_GAME_IDS: string[] = [];

export function filterVisible<T extends { id: string }>(list: readonly T[], hidden: readonly string[]): T[] {
  return list.filter((item) => !hidden.includes(item.id));
}
