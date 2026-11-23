// 결과 공유 문구
export const SITE_URL = 'https://physical-battle.vercel.app';

export function shareText(rounds: number, avgMs: number | null, url = SITE_URL): string {
  const avg = avgMs === null ? '' : ` · 평균 ${Math.round(avgMs)}ms`;
  return `피지컬 배틀 반응속도 ${rounds}라운드${avg} 달성! 도전해 보세요 ${url}`;
}
