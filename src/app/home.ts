// 홈 화면 (미니게임 목록·최고 기록·코인·토스 랭킹)
import { total, type CoinState } from '../core/coins';
import { getBest } from '../core/records';
import { comingSoon, games } from '../games/registry';
import type { PlatformAdapter } from '../platform';
import { el } from './dom';
import { rankingButton } from './ranking';

export function coinBadge(coins: CoinState): HTMLElement {
  const badge = el('span', 'coin-badge');
  badge.append(el('span', 'coin-icon'), el('span', 'coin-label', 'COIN'), el('span', 'coin-count', String(total(coins))));
  badge.setAttribute('aria-label', `코인 ${total(coins)}개`);
  return badge;
}

export interface HomeOptions {
  platform: PlatformAdapter;
  coins: CoinState | null;
  onPlay(gameId: string): void;
}

export function renderHome(root: HTMLElement, { platform, coins, onPlay }: HomeOptions): void {
  const screen = el('main', 'screen home');
  const header = el('header', 'home-header');
  const titleRow = el('div', 'home-title-row');
  titleRow.appendChild(el('h1', 'home-title', '피지컬 배틀'));
  if (coins) titleRow.appendChild(coinBadge(coins));
  header.append(titleRow, el('p', 'home-sub', '내 피지컬은 몇 라운드까지 버틸까?'));

  const list = el('ul', 'game-list');
  for (const game of games) {
    const best = getBest(platform.storage, game.id);
    const item = el('li');
    const card = el('button', 'game-card');
    card.type = 'button';
    card.dataset.gameId = game.id;
    const info = el('div', 'game-info');
    info.append(el('span', 'game-title', game.title), el('span', 'game-desc', game.description));
    if (coins) info.appendChild(el('span', 'game-cost', '1코인'));
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

  platform.leaderboard.available().then(async (ok) => {
    if (!ok || !screen.isConnected) return;
    const profile = await platform.profile();
    if (!screen.isConnected) return;
    const ranking = el('section', 'home-ranking');
    const note = el('p', 'ranking-note', profile ? `${profile.nickname}님, 랭킹에 도전해 보세요` : '랭킹에 도전해 보세요');
    ranking.append(note, rankingButton(platform.leaderboard, note));
    header.appendChild(ranking);
  });
}
