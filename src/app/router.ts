// 화면 전환 (홈 → 게임 → 결과)
import { addRecord, getBest } from '../core/records';
import { findGame } from '../games/registry';
import type { GameInstance, GameResult } from '../games/types';
import type { PlatformAdapter } from '../platform';
import { el, readSafeInsets } from './dom';
import { renderHome } from './home';
import { renderResult } from './result';

export function createApp(root: HTMLElement, platform: PlatformAdapter): void {
  let current: GameInstance | null = null;

  const stopGame = () => {
    current?.dispose();
    current = null;
  };

  const showHome = () => {
    stopGame();
    renderHome(root, platform.storage, showGame);
  };

  const showResult = (gameId: string, result: GameResult) => {
    let isNewBest = false;
    if (result.rounds >= 1 && result.avgMs !== null && result.bestMs !== null) {
      isNewBest = addRecord(platform.storage, {
        gameId,
        rounds: result.rounds,
        avgMs: result.avgMs,
        bestMs: result.bestMs,
        at: Date.now(),
      }).isNewBest;
    }
    const best = getBest(platform.storage, gameId);
    const finishedGame = current;
    window.setTimeout(() => {
      if (current !== finishedGame) return;
      stopGame();
      renderResult(
        root,
        { result, isNewBest, bestRounds: best ? best.rounds : null },
        { onRetry: () => showGame(gameId), onHome: showHome },
      );
    }, 600);
  };

  function showGame(gameId: string) {
    const game = findGame(gameId);
    if (!game) {
      showHome();
      return;
    }
    stopGame();
    const screen = el('main', 'screen game');
    const hud = el('header', 'hud');
    const back = el('button', 'hud-back', '✕');
    back.type = 'button';
    back.setAttribute('aria-label', '홈으로');
    back.addEventListener('click', showHome);
    const title = el('span', 'hud-title', game.title);
    const status = el('span', 'hud-status');
    status.setAttribute('aria-live', 'polite');
    hud.append(back, title, status);
    const slot = el('div', 'game-slot');
    screen.append(hud, slot);
    root.replaceChildren(screen);

    current = game.create({
      root: slot,
      storage: platform.storage,
      safeInsets: readSafeInsets(),
      setStatus: (text) => {
        status.textContent = text;
      },
      onFinish: (result) => showResult(gameId, result),
    });
    current.start();
  }

  showHome();
}
