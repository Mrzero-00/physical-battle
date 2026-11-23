// 결과 공유 문구
import { DEFAULT_LABELS, type ScoreLabels } from './labels';

export const SITE_URL = 'https://physical-battle.vercel.app';

export function shareText(
  gameTitle: string,
  rounds: number,
  avgMs: number | null,
  url = SITE_URL,
  labels: ScoreLabels = DEFAULT_LABELS,
): string {
  const avg = avgMs === null || !labels.shareAvg ? '' : ` · 평균 ${Math.round(avgMs)}ms`;
  return `피지컬 배틀 ${gameTitle} ${rounds}${labels.roundsWord}${avg} 달성! 도전해 보세요 ${url}`;
}
