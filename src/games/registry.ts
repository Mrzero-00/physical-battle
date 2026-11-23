// 미니게임 목록
import { reactionGame } from './reaction';
import type { GameModule } from './types';

export interface ComingSoonGame {
  id: string;
  title: string;
  description: string;
}

export const games: GameModule[] = [reactionGame];

export const comingSoon: ComingSoonGame[] = [
  { id: 'dynamic-vision', title: '동체시력', description: '움직이는 대상을 정확히 잡아내는 테스트' },
];

export function findGame(id: string): GameModule | undefined {
  return games.find((game) => game.id === id);
}
