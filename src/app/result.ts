// 게임 결과 화면
import type { GameResult } from '../games/types';
import { el } from './dom';

const END_REASON: Record<string, string> = {
  timeout: '시간 초과',
  miss: '버튼을 빗나감',
  'false-start': '너무 빨리 누름 (부정출발)',
  none: '종료',
};

export interface ResultView {
  result: GameResult;
  isNewBest: boolean;
  bestRounds: number | null;
}

export function renderResult(
  root: HTMLElement,
  view: ResultView,
  actions: { onRetry(): void; onHome(): void },
): void {
  const { result, isNewBest, bestRounds } = view;
  const screen = el('main', 'screen result');
  const box = el('section', 'result-box');
  box.append(
    el('p', 'result-reason', END_REASON[result.endReason] ?? result.endReason),
    el('p', 'result-rounds', `${result.rounds}`),
    el('p', 'result-rounds-label', '라운드 성공'),
  );
  if (isNewBest) box.appendChild(el('p', 'result-badge', '신기록!'));

  const stats = el('dl', 'result-stats');
  const stat = (label: string, value: string) => {
    const row = el('div', 'result-stat');
    row.append(el('dt', '', label), el('dd', '', value));
    stats.appendChild(row);
  };
  stat('평균 반응', result.avgMs === null ? '-' : `${result.avgMs}ms`);
  stat('최고 반응', result.bestMs === null ? '-' : `${result.bestMs}ms`);
  stat('개인 최고', bestRounds === null ? '-' : `${bestRounds}R`);
  box.appendChild(stats);

  const buttons = el('div', 'result-actions');
  const retry = el('button', 'btn primary', '다시 하기');
  retry.type = 'button';
  retry.addEventListener('click', actions.onRetry);
  const home = el('button', 'btn', '홈으로');
  home.type = 'button';
  home.addEventListener('click', actions.onHome);
  buttons.append(retry, home);

  screen.append(box, buttons);
  root.replaceChildren(screen);
}
