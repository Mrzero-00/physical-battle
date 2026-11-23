// 코인 패널 (내역·무료 충전 시간·광고 보고 충전)
import type { RewardOutcome } from '../core/ads';
import { adOutcomeMessage, canWatchAd, refillText } from '../core/coin-view';
import { total, type CoinState } from '../core/coins';
import { el } from './dom';
import { refreshCoinBars } from './topbar';

export interface AdReward {
  outcome: RewardOutcome;
  applied: number;
  totalBefore: number;
  coins: CoinState;
}

export interface CoinSheetOptions {
  readCoins(): CoinState;
  watchAd(): Promise<AdReward>;
}

export function openCoinSheet(host: HTMLElement, options: CoinSheetOptions): void {
  host.querySelector('.sheet-backdrop')?.remove();
  const backdrop = el('div', 'sheet-backdrop');
  const sheet = el('section', 'coin-sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'coin-sheet-title');
  const title = el('h2', 'sheet-title', '내 코인');
  title.id = 'coin-sheet-title';

  const rows = el('dl', 'sheet-rows');
  const row = (label: string) => {
    const wrap = el('div', 'sheet-row');
    const value = el('dd', '');
    wrap.append(el('dt', '', label), value);
    rows.appendChild(wrap);
    return value;
  };
  const freeEl = row('무료 코인');
  const bonusEl = row('보너스 코인');
  const totalEl = row('합계');
  const refill = el('p', 'sheet-note');
  const rule = el('p', 'sheet-note', '1판에 1코인 · 무료 코인은 매일 0시에 5개까지 채워져요 · 무료 코인부터 사용해요');
  const message = el('p', 'sheet-message');
  message.setAttribute('aria-live', 'polite');

  const watch = el('button', 'btn primary', '광고 보고 +3코인');
  watch.type = 'button';
  const close = el('button', 'btn', '닫기');
  close.type = 'button';

  const render = (coins: CoinState) => {
    freeEl.textContent = `${coins.free}개`;
    bonusEl.textContent = `${coins.bonus}개`;
    totalEl.textContent = `${total(coins)}개`;
    refill.textContent = refillText(coins.free, Date.now());
    const allowed = canWatchAd(coins);
    watch.disabled = !allowed;
    if (!allowed) message.textContent = '보너스 코인이 가득 찼어요';
  };
  render(options.readCoins());

  const dismiss = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') dismiss();
  };
  document.addEventListener('keydown', onKey);

  watch.addEventListener('click', async () => {
    watch.disabled = true;
    message.textContent = '광고를 불러오는 중…';
    const result = await options.watchAd();
    if (!backdrop.isConnected) return;
    message.textContent = adOutcomeMessage(result.outcome, result.applied, result.totalBefore);
    render(result.coins);
    refreshCoinBars();
  });
  close.addEventListener('click', dismiss);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) dismiss();
  });

  const actions = el('div', 'sheet-actions');
  actions.append(watch, close);
  sheet.append(title, rows, refill, rule, message, actions);
  backdrop.appendChild(sheet);
  host.appendChild(backdrop);
  watch.focus();
}
