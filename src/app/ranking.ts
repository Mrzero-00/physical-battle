// 토스 랭킹 보기 버튼
import type { LeaderboardPort } from '../platform/types';
import { el } from './dom';

export function rankingButton(leaderboard: LeaderboardPort, note: HTMLElement): HTMLButtonElement {
  const button = el('button', 'btn ranking-btn', '토스 랭킹 보기');
  button.type = 'button';
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await leaderboard.open();
    } catch {
      note.textContent = '랭킹을 열 수 없어요';
    } finally {
      button.disabled = false;
    }
  });
  return button;
}
