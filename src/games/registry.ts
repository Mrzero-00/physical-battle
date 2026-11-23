// 미니게임 목록
import { balanceGame } from './balance';
import { flashGame } from './flash';
import { goNoGoGame } from './gonogo';
import { labelsFor } from './labels';
import { motGame } from './mot';
import { peripheralGame } from './peripheral';
import { reactionGame } from './reaction';
import { stroopGame } from './stroop';
import { tapSpeedGame } from './tapspeed';
import { timingGame } from './timing';
import type { GameModule } from './types';
import { filterVisible, HIDDEN_GAME_IDS } from './visibility';
import { visionGame } from './vision';

export interface ComingSoonGame {
  id: string;
  title: string;
  description: string;
}

export const allGames: GameModule[] = [reactionGame, visionGame, goNoGoGame, timingGame, flashGame, peripheralGame, tapSpeedGame, stroopGame, motGame, balanceGame];

export const games: GameModule[] = filterVisible(allGames, HIDDEN_GAME_IDS);

export const comingSoon: ComingSoonGame[] = [];

export function findGame(id: string): GameModule | undefined {
  return games.find((game) => game.id === id);
}

export { labelsFor };
