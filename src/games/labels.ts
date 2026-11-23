// 게임 모듈의 표기 라벨 조회
import { withLabels, type ScoreLabels } from '../core/labels';
import type { GameModule } from './types';

export function labelsFor(game: Pick<GameModule, 'labels'> | undefined): ScoreLabels {
  return withLabels(game?.labels);
}
