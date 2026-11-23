// 홈 화면 (미니게임 목록과 최고 기록)
import { getBest } from '../core/records';
import { comingSoon, games } from '../games/registry';
import type { KeyValueStorage } from '../platform';
import { el } from './dom';

export function renderHome(root: HTMLElement, storage: KeyValueStorage, onPlay: (gameId: string) => void): void {
  const screen = el('main', 'screen home');
  const header = el('header', 'home-header');
  header.append(el('h1', 'home-title', '피지컬 배틀'), el('p', 'home-sub', '내 피지컬은 몇 라운드까지 버틸까?'));

  const list = el('ul', 'game-list');
  for (const game of games) {
    const best = getBest(storage, game.id);
    const item = el('li');
    const card = el('button', 'game-card');
    card.type = 'button';
    card.dataset.gameId = game.id;
    const info = el('div', 'game-info');
    info.append(el('span', 'game-title', game.title), el('span', 'game-desc', game.description));
    const record = el('div', 'game-best');
    record.append(el('span', 'game-best-label', '최고'), el('span', 'game-best-value', best ? `${best.rounds}R` : '-'));
    card.append(info, record);
    card.addEventListener('click', () => onPlay(game.id));
    item.appendChild(card);
    list.appendChild(item);
  }
  for (const game of comingSoon) {
    const item = el('li');
    const card = el('div', 'game-card disabled');
    card.setAttribute('aria-disabled', 'true');
    const info = el('div', 'game-info');
    info.append(el('span', 'game-title', `${game.title} · 준비 중`), el('span', 'game-desc', game.description));
    card.appendChild(info);
    item.appendChild(card);
    list.appendChild(item);
  }

  screen.append(header, list);
  root.replaceChildren(screen);
}
