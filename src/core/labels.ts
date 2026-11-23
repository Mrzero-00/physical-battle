// 게임별 점수 표기 라벨
export interface ScoreLabels {
  roundsWord: string;
  roundsUnit: string;
  roundsLabel: string;
  avgLabel: string;
  bestLabel: string;
  compareAvg: string;
  shareAvg: boolean;
  avgUnit: 'ms' | 's';
}

export const DEFAULT_LABELS: ScoreLabels = {
  roundsWord: '라운드',
  roundsUnit: 'R',
  roundsLabel: '라운드 성공',
  avgLabel: '평균 반응',
  bestLabel: '최고 반응',
  compareAvg: '평균',
  shareAvg: true,
  avgUnit: 'ms',
};

export function withLabels(partial?: Partial<ScoreLabels>): ScoreLabels {
  return { ...DEFAULT_LABELS, ...partial };
}

export function formatMs(value: number, labels: ScoreLabels = DEFAULT_LABELS): string {
  if (labels.avgUnit === 's') return `${(value / 1000).toFixed(2)}초`;
  return `${Math.round(value)}ms`;
}
