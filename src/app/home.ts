// 홈 화면 (미니게임 목록·최고 기록·내 기록·전체 랭킹)
import { getBest } from '../core/records';
import { comingSoon, games, labelsFor } from '../games/registry';
import type { PlatformAdapter } from '../platform';
import { el } from './dom';
import { rankingButton } from './ranking';

export interface HomeOptions {
  platform: PlatformAdapter;
  topBar: HTMLElement;
  coinsEnabled: boolean;
  onPlay(gameId: string): void;
  onRecords(): void;
  onRanking(): void;
  onSkins(): void;
}

export function renderHome(root: HTMLElement, options: HomeOptions): void {
  const { platform, coinsEnabled, onPlay } = options;
  const screen = el('main', 'screen home');
  const header = el('header', 'home-header');
  header.append(el('h1', 'home-title', '피지컬 배틀'), el('p', 'home-sub', '내 피지컬은 몇 라운드까지 버틸까?'));

  const list = el('ul', 'game-list');
  for (const game of games) {
    const best = getBest(platform.storage, game.id);
    const item = el('li');
    const card = el('button', 'game-card');
    card.type = 'button';
    card.dataset.gameId = game.id;
    const info = el('div', 'game-info');
    info.append(el('span', 'game-title', game.title), el('span', 'game-desc', game.description));
    if (coinsEnabled) info.appendChild(el('span', 'game-cost', '1코인'));
    const record = el('div', 'game-best');
    record.append(el('span', 'game-best-label', '최고'), el('span', 'game-best-value', best ? `${best.rounds}${labelsFor(game).roundsUnit}` : '-'));
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

  const nav = el('nav', 'home-nav');
  const records = el('button', 'btn nav-btn', '내 기록');
  records.type = 'button';
  records.addEventListener('click', options.onRecords);
  const ranking = el('button', 'btn nav-btn', '전체 랭킹');
  ranking.type = 'button';
  ranking.addEventListener('click', options.onRanking);
  const skins = el('button', 'btn nav-btn nav-wide', '버튼 모양');
  skins.type = 'button';
  skins.addEventListener('click', options.onSkins);
  nav.append(records, ranking, skins);

  const body = el('div', 'page-body');
  body.append(header, list, nav);
  screen.append(options.topBar, body);
  root.replaceChildren(screen);

  platform.leaderboard.available().then(async (ok) => {
    if (!ok || !screen.isConnected) return;
    const profile = await platform.profile();
    if (!screen.isConnected) return;
    const section = el('section', 'home-ranking');
    const note = el('p', 'ranking-note', profile ? `${profile.nickname}님, 친구 순위는 토스 랭킹에서 확인하세요` : '친구 순위는 토스 랭킹에서 확인하세요');
    section.append(note, rankingButton(platform.leaderboard, note));
    body.appendChild(section);
  });
}
