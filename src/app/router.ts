// 화면 전환 (홈 → 코인 → 게임 → 결과 · 내 기록 · 전체 랭킹)
import { appliedBonus } from '../core/coin-view';
import { grantBonus, loadCoins, rewardDelta, saveCoins, spend, total, type CoinState } from '../core/coins';
import { toLeaderboardScore } from '../core/leaderboard';
import { bestComparisonText } from '../core/ranking';
import { addRecord, getBest, type RunRecord } from '../core/records';
import { SITE_URL, shareText } from '../core/share';
import { findGame, games } from '../games/registry';
import type { GameInstance, GameResult } from '../games/types';
import type { PlatformAdapter, SubmitOutcome } from '../platform';
import { openCoinSheet, type AdReward } from './coin-sheet';
import { renderCoinScreen } from './coins';
import { el, readSafeInsets } from './dom';
import { renderGlobalRanking } from './global-ranking';
import { clearSubmittedMarker, syncGlobalRanking } from './global-status';
import { renderHome } from './home';
import { openNicknameDialog } from './nickname';
import { createRankingClient, type RankingClient } from './ranking-client';
import { renderRecords } from './records';
import { renderResult } from './result';
import { createTopBar } from './topbar';

function rankingClientFor(platform: PlatformAdapter): RankingClient {
  if (platform.rankingClient) return platform.rankingClient;
  const base = import.meta.env.VITE_RANKING_API_BASE ?? (platform.name === 'apps-in-toss' ? SITE_URL : '');
  return createRankingClient((input, init) => fetch(input, init), base);
}

export function createApp(root: HTMLElement, platform: PlatformAdapter): void {
  const coinsEnabled = platform.name !== 'web';
  const client = rankingClientFor(platform);
  const defaultGame = games[0].id;
  let current: GameInstance | null = null;

  const readCoins = (): CoinState => {
    const coins = loadCoins(platform.storage, Date.now());
    saveCoins(platform.storage, coins);
    return coins;
  };

  const watchAd = async (): Promise<AdReward> => {
    const outcome = await platform.ads.showRewarded();
    const before = loadCoins(platform.storage, Date.now());
    const next = grantBonus(before, rewardDelta(outcome, total(before)));
    saveCoins(platform.storage, next);
    return { outcome, applied: appliedBonus(before, next), totalBefore: total(before), coins: next };
  };

  const openCoins = () => openCoinSheet(root, { readCoins, watchAd });

  const topBar = (title?: string, onBack?: () => void) =>
    createTopBar({ coins: coinsEnabled ? readCoins : null, onOpenCoins: openCoins, title, onBack });

  const stopGame = () => {
    current?.dispose();
    current = null;
  };

  const showHome = () => {
    stopGame();
    renderHome(root, {
      platform,
      topBar: topBar(),
      coinsEnabled,
      onPlay: requestPlay,
      onRecords: showRecords,
      onRanking: showRanking,
    });
  };

  const editNickname = (after: () => void) =>
    openNicknameDialog(root, platform.storage, () => {
      clearSubmittedMarker(platform, defaultGame);
      after();
    });

  function showRecords() {
    stopGame();
    renderRecords(root, { topBar: topBar('내 기록', showHome), storage: platform.storage, gameId: defaultGame, onRanking: showRanking });
  }

  function showRanking() {
    stopGame();
    renderGlobalRanking(root, {
      topBar: topBar('전체 랭킹', showHome),
      platform,
      client,
      gameId: defaultGame,
      onNickname: () => editNickname(showRanking),
    });
  }

  function requestPlay(gameId: string) {
    if (!coinsEnabled) {
      startGame(gameId);
      return;
    }
    const coins = loadCoins(platform.storage, Date.now());
    const paid = spend(coins);
    if (!paid.ok) {
      saveCoins(platform.storage, coins);
      showCoinScreen(gameId);
      return;
    }
    saveCoins(platform.storage, paid.state);
    startGame(gameId);
  }

  function showCoinScreen(gameId: string) {
    stopGame();
    renderCoinScreen(root, {
      topBar: topBar('코인 충전', showHome),
      watchAd,
      onStart: () => requestPlay(gameId),
      onHome: showHome,
    });
  }

  const showResult = (gameId: string, result: GameResult) => {
    let isNewBest = false;
    let submission: Promise<SubmitOutcome> | null = null;
    const available = platform.leaderboard.available();
    const previousBest = getBest(platform.storage, gameId);
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
    const comparison = bestComparisonText({ rounds: result.rounds, avgMs: result.avgMs }, previousBest);
    const finishedGame = current;
    window.setTimeout(() => {
      if (current !== finishedGame) return;
      stopGame();
      renderResult(
          root,
          {
            topBar: topBar(),
            result,
            isNewBest,
            bestRounds: best ? best.rounds : null,
            comparison,
            coinsEnabled,
            platformName: platform.name,
            toss: { available, submission, leaderboard: platform.leaderboard },
            global: () => syncGlobalRanking(platform, client, gameId),
          },
          {
            onRetry: () => requestPlay(gameId),
            onHome: showHome,
            onRanking: showRanking,
            onNickname: (retry) => editNickname(retry),
            onShare: () => platform.share(shareText(result.rounds, result.avgMs)),
          },
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
