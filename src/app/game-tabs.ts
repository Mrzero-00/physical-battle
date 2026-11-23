// 게임 전환 탭 (내 기록·전체 랭킹 공용)
import type { GameModule } from '../games/types';
import { el } from './dom';

export function resolveGameId(visible: readonly { id: string }[], requested: string | null | undefined): string {
  if (requested && visible.some((g) => g.id === requested)) return requested;
  return visible[0]?.id ?? '';
}

export function createGameTabs(list: readonly GameModule[], selected: string, onSelect: (gameId: string) => void): HTMLElement {
  const bar = el('div', 'game-tabs');
  bar.setAttribute('role', 'tablist');
  for (const game of list) {
    const tab = el('button', 'game-tab', game.title);
    tab.type = 'button';
    tab.dataset.gameId = game.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(game.id === selected));
    tab.addEventListener('click', () => {
      if (game.id !== selected) onSelect(game.id);
    });
    bar.appendChild(tab);
  }
  queueMicrotask(() => {
    const current = bar.querySelector<HTMLElement>('[aria-selected="true"]');
    if (current && bar.isConnected && typeof current.scrollIntoView === 'function') current.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
  return bar;
}
