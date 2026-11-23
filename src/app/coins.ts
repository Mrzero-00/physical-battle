// 코인 부족 화면 (보상형 광고로 코인 받기)
import { adOutcomeMessage } from '../core/coin-view';
import { total } from '../core/coins';
import type { AdReward } from './coin-sheet';
import { el } from './dom';
import { refreshCoinBars } from './topbar';

export interface CoinScreenOptions {
  topBar: HTMLElement;
  watchAd(): Promise<AdReward>;
  onStart(): void;
  onHome(): void;
}

export function renderCoinScreen(root: HTMLElement, options: CoinScreenOptions): void {
  const screen = el('main', 'screen page coin-screen');
  const box = el('section', 'coin-box');
  const slot = el('div', 'coin-slot');
  slot.append(el('span', 'coin-slot-icon'), el('span', 'coin-slot-text', 'INSERT COIN'));
  const title = el('h2', 'coin-title', '코인이 없어요');
  const message = el('p', 'coin-message', '광고를 끝까지 보면 3코인을 받을 수 있어요');
  message.setAttribute('aria-live', 'polite');
  box.append(slot, title, message);

  const actions = el('div', 'result-actions');
  const watch = el('button', 'btn primary', '광고 보고 3코인 받기');
  watch.type = 'button';
  const start = el('button', 'btn primary coin-start', '시작하기 (1코인)');
  start.type = 'button';
  start.hidden = true;
  const home = el('button', 'btn', '홈으로');
  home.type = 'button';

  watch.addEventListener('click', async () => {
    watch.disabled = true;
    message.textContent = '광고를 불러오는 중…';
    const result = await options.watchAd();
    if (!screen.isConnected) return;
    message.textContent = adOutcomeMessage(result.outcome, result.applied, result.totalBefore);
    refreshCoinBars();
    if (total(result.coins) >= 1) {
      title.textContent = '코인이 충전됐어요';
      watch.hidden = true;
      start.hidden = false;
    } else {
      watch.disabled = false;
    }
  });
  start.addEventListener('click', options.onStart);
  home.addEventListener('click', options.onHome);
  actions.append(watch, start, home);

  const body = el('div', 'page-body coin-body');
  body.append(box, actions);
  screen.append(options.topBar, body);
  root.replaceChildren(screen);
}
