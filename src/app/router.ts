// 화면 전환 (홈 → 코인 → 게임 → 결과)
import { grantBonus, loadCoins, rewardDelta, saveCoins, spend, total, type CoinState } from '../core/coins';
import { toLeaderboardScore } from '../core/leaderboard';
import { addRecord, getBest, type RunRecord } from '../core/records';
import { findGame } from '../games/registry';
import type { GameInstance, GameResult } from '../games/types';
import type { PlatformAdapter, SubmitOutcome } from '../platform';
import { renderCoinScreen } from './coins';
import { el, readSafeInsets } from './dom';
import { renderHome } from './home';
import { renderResult } from './result';

export function createApp(root: HTMLElement, platform: PlatformAdapter): void {
  const coinsEnabled = platform.name === 'apps-in-toss';
  let current: GameInstance | null = null;

  const readCoins = (): CoinState | null => {
    if (!coinsEnabled) return null;
    const coins = loadCoins(platform.storage, Date.now());
    saveCoins(platform.storage, coins);
    return coins;
  };

  const stopGame = () => {
    current?.dispose();
    current = null;
  };

  const showHome = () => {
    stopGame();
    renderHome(root, { platform, coins: readCoins(), onPlay: requestPlay });
  };

  function requestPlay(gameId: string) {
    if (!coinsEnabled) {
      startGame(gameId);
      return;
    }
    const coins = loadCoins(platform.storage, Date.now());
    const paid = spend(coins);
    if (!paid.ok) {
      saveCoins(platform.storage, coins);
      showCoinScreen(gameId, coins);
      return;
    }
    saveCoins(platform.storage, paid.state);
    startGame(gameId);
  }

  function showCoinScreen(gameId: string, coins: CoinState) {
    stopGame();
    renderCoinScreen(root, {
      coins,
      watchAd: async () => {
        const outcome = await platform.ads.showRewarded();
        const latest = loadCoins(platform.storage, Date.now());
        const delta = rewardDelta(outcome, total(latest));
        const next = grantBonus(latest, delta);
        saveCoins(platform.storage, next);
        return { outcome, delta, coins: next };
      },
      onStart: () => requestPlay(gameId),
      onHome: showHome,
    });
  }

  const showResult = (gameId: string, result: GameResult) => {
    let isNewBest = false;
    let submission: Promise<SubmitOutcome> | null = null;
    const available = platform.leaderboard.available();
    if (result.rounds >= 1 && result.avgMs !== null && result.bestMs !== null) {
      const record: RunRecord = {
        gameId,
        rounds: result.rounds,
        avgMs: result.avgMs,
        bestMs: result.bestMs,
        at: Date.now(),
      };
      const saved = addRecord(platform.storage, record);
      isNewBest = saved.isNewBest;
      const score = saved.saved ? toLeaderboardScore(record) : null;
      if (score !== null) {
        submission = available.then((ok) => (ok ? platform.leaderboard.submit(score) : 'unsupported'));
      }
    }
    const best = getBest(platform.storage, gameId);
    const finishedGame = current;
    window.setTimeout(() => {
      if (current !== finishedGame) return;
      stopGame();
      renderResult(
        root,
        {
          result,
          isNewBest,
          bestRounds: best ? best.rounds : null,
          coins: readCoins(),
          ranking: { available, submission, leaderboard: platform.leaderboard },
        },
        { onRetry: () => requestPlay(gameId), onHome: showHome },
      );
    }, 600);
  };

  function startGame(gameId: string) {
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

  if (coinsEnabled) platform.ads.preload();
  showHome();
}
