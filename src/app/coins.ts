// 코인 부족 화면 (보상형 광고로 코인 받기)
import { total, type CoinState } from '../core/coins';
import type { RewardOutcome } from '../platform';
import { el } from './dom';
import { coinBadge } from './home';

export interface CoinScreenOptions {
  coins: CoinState;
  watchAd(): Promise<{ outcome: RewardOutcome; delta: number; coins: CoinState }>;
  onStart(): void;
  onHome(): void;
}

function outcomeMessage(outcome: RewardOutcome, delta: number): string {
  if (outcome === 'rewarded') return `${delta}코인 받았어요`;
  if (delta > 0) return `광고를 불러올 수 없어 ${delta}코인을 드려요`;
  if (outcome === 'closed') return '끝까지 시청해야 코인을 받아요';
  return '광고를 불러올 수 없어요. 잠시 후 다시 시도해 주세요';
}

export function renderCoinScreen(root: HTMLElement, options: CoinScreenOptions): void {
  const screen = el('main', 'screen coin-screen');
  const top = el('div', 'coin-top');
  let badge = coinBadge(options.coins);
  top.appendChild(badge);

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
    const { outcome, delta, coins } = await options.watchAd();
    if (!screen.isConnected) return;
    message.textContent = outcomeMessage(outcome, delta);
    const next = coinBadge(coins);
    badge.replaceWith(next);
    badge = next;
    if (total(coins) >= 1) {
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

  screen.append(top, box, actions);
  root.replaceChildren(screen);
}
