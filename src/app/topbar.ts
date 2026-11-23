// 공통 상단 바 (뒤로가기·제목·코인 수량)
import { breakdownText, refillText } from '../core/coin-view';
import { total, type CoinState } from '../core/coins';
import { el } from './dom';

export const COIN_BAR_REFRESH_MS = 60000;

export interface TopBarOptions {
  coins: (() => CoinState) | null;
  onOpenCoins(): void;
  onBack?: () => void;
  title?: string;
}

const refreshers = new WeakMap<Element, () => void>();

export function refreshCoinBars(): void {
  document.querySelectorAll('.coin-bar').forEach((bar) => refreshers.get(bar)?.());
}

export function createTopBar(options: TopBarOptions): HTMLElement {
  const bar = el('header', 'top-bar');
  const left = el('div', 'top-left');
  if (options.onBack) {
    const back = el('button', 'top-back', '‹');
    back.type = 'button';
    back.setAttribute('aria-label', '뒤로');
    back.addEventListener('click', options.onBack);
    left.appendChild(back);
  }
  if (options.title) left.appendChild(el('h1', 'top-title', options.title));
  bar.appendChild(left);

  const readCoins = options.coins;
  if (!readCoins) return bar;

  const coinBar = el('button', 'coin-bar');
  coinBar.type = 'button';
  const totalEl = el('span', 'coin-badge');
  const count = el('span', 'coin-count');
  totalEl.append(el('span', 'coin-icon'), el('span', 'coin-label', 'COIN'), count);
  const meta = el('span', 'coin-meta');
  const breakdown = el('span', 'coin-breakdown');
  const refill = el('span', 'coin-refill');
  meta.append(breakdown, refill);
  coinBar.append(totalEl, meta);
  coinBar.addEventListener('click', options.onOpenCoins);

  const render = () => {
    const coins = readCoins();
    count.textContent = String(total(coins));
    breakdown.textContent = breakdownText(coins);
    refill.textContent = refillText(coins.free, Date.now());
    coinBar.setAttribute('aria-label', `코인 ${total(coins)}개, ${breakdownText(coins)}, ${refill.textContent}. 눌러서 충전`);
  };
  render();
  refreshers.set(coinBar, render);
  let attached = false;
  const timer = window.setInterval(() => {
    if (coinBar.isConnected) {
      attached = true;
      render();
    } else if (attached) {
      window.clearInterval(timer);
    }
  }, COIN_BAR_REFRESH_MS);
  queueMicrotask(() => {
    if (coinBar.isConnected) attached = true;
  });

  bar.appendChild(coinBar);
  return bar;
}
