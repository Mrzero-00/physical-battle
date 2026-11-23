// 미니게임 목록
import { labelsFor } from './labels';
import { reactionGame } from './reaction';
import type { GameModule } from './types';
import { filterVisible, HIDDEN_GAME_IDS } from './visibility';
import { visionGame } from './vision';

export interface ComingSoonGame {
  id: string;
  title: string;
  description: string;
}

export const allGames: GameModule[] = [reactionGame, visionGame];

export const games: GameModule[] = filterVisible(allGames, HIDDEN_GAME_IDS);

export const comingSoon: ComingSoonGame[] = [];

export function findGame(id: string): GameModule | undefined {
  return games.find((game) => game.id === id);
}

export { labelsFor };
