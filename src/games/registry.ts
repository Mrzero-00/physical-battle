// 미니게임 목록
import { reactionGame } from './reaction';
import { visionGame } from './vision';
import type { GameModule } from './types';

export interface ComingSoonGame {
  id: string;
  title: string;
  description: string;
}

export const games: GameModule[] = [reactionGame, visionGame];

export const comingSoon: ComingSoonGame[] = [];

export function findGame(id: string): GameModule | undefined {
  return games.find((game) => game.id === id);
}
