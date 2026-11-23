// 게임 결과 화면 (최고 기록 비교·랭킹 카드·공유)
import { submitOutcomeMessage } from '../core/leaderboard';
import type { GameResult } from '../games/types';
import type { LeaderboardPort, ShareOutcome, SubmitOutcome } from '../platform';
import { el } from './dom';
import { canRetry, globalStatusText, type GlobalStatus } from './global-status';
import { rankingButton } from './ranking';

const END_REASON: Record<string, string> = {
  timeout: '시간 초과',
  miss: '버튼을 빗나감',
  'false-start': '너무 빨리 누름 (부정출발)',
  none: '종료',
};

const SHARE_TEXT: Record<ShareOutcome, string> = {
  shared: '',
  copied: '기록을 복사했어요',
  cancelled: '',
  failed: '공유할 수 없어요',
};

export interface ResultView {
  topBar: HTMLElement;
  result: GameResult;
  isNewBest: boolean;
  bestRounds: number | null;
  comparison: string | null;
  coinsEnabled: boolean;
  platformName: 'web' | 'apps-in-toss' | 'mock';
  toss: { available: Promise<boolean>; submission: Promise<SubmitOutcome> | null; leaderboard: LeaderboardPort };
  global: () => Promise<GlobalStatus>;
}

export interface ResultActions {
  onRetry(): void;
  onHome(): void;
  onRanking(): void;
  onNickname(retry: () => void): void;
  onShare(): Promise<ShareOutcome>;
}

export function renderResult(root: HTMLElement, view: ResultView, actions: ResultActions): void {
  const { result, isNewBest, bestRounds } = view;
  const screen = el('main', 'screen page result');
  const box = el('section', 'result-box');
  box.append(
    el('p', 'result-reason', END_REASON[result.endReason] ?? result.endReason),
    el('p', 'result-rounds', `${result.rounds}`),
    el('p', 'result-rounds-label', '라운드 성공'),
  );
  if (isNewBest) box.appendChild(el('p', 'result-badge', '신기록!'));
  if (view.comparison) box.appendChild(el('p', 'result-compare', view.comparison));

  const stats = el('dl', 'result-stats');
  const stat = (label: string, value: string) => {
    const row = el('div', 'result-stat');
    row.append(el('dt', '', label), el('dd', '', value));
    stats.appendChild(row);
  };
  stat('평균 반응', result.avgMs === null ? '-' : `${result.avgMs}ms`);
  stat('최고 반응', result.bestMs === null ? '-' : `${result.bestMs}ms`);
  stat('개인 최고', bestRounds === null ? '-' : `${bestRounds}R`);
  box.appendChild(stats);

  const card = el('section', 'result-ranking');
  card.appendChild(el('h2', 'section-title', '랭킹'));
  const globalRow = el('div', 'rank-row-global');
  const globalText = el('p', 'ranking-note', '전체 랭킹에 올리는 중…');
  globalText.setAttribute('aria-live', 'polite');
  const globalActions = el('div', 'rank-row-actions');
  globalRow.append(el('span', 'rank-row-label', '전체'), globalText, globalActions);
  card.appendChild(globalRow);

  const runGlobal = () => {
    globalText.textContent = '전체 랭킹에 올리는 중…';
    globalActions.replaceChildren();
    view.global().then((status) => {
      if (!globalRow.isConnected) return;
      globalText.textContent = globalStatusText(status, view.platformName);
      if (status.kind === 'needs-nickname') {
        const nick = el('button', 'btn small', '닉네임 정하기');
        nick.type = 'button';
        nick.addEventListener('click', () => actions.onNickname(runGlobal));
        globalActions.appendChild(nick);
      } else if (canRetry(status)) {
        const retry = el('button', 'btn small', '다시 시도');
        retry.type = 'button';
        retry.addEventListener('click', runGlobal);
        globalActions.appendChild(retry);
      } else if (status.kind === 'ok') {
        const look = el('button', 'btn small', '순위 보기');
        look.type = 'button';
        look.addEventListener('click', actions.onRanking);
        globalActions.appendChild(look);
      }
    });
  };

  const share = el('button', 'btn share-btn', '친구에게 자랑하기');
  share.type = 'button';
  const shareNote = el('p', 'share-note');
  shareNote.setAttribute('aria-live', 'polite');
  share.disabled = result.rounds < 1;
  share.addEventListener('click', async () => {
    share.disabled = true;
    const outcome = await actions.onShare();
    shareNote.textContent = SHARE_TEXT[outcome];
    share.disabled = false;
  });

  const buttons = el('div', 'result-actions');
  if (isNewBest) {
    const rank = el('button', 'btn primary', '순위 확인하기');
    rank.type = 'button';
    rank.addEventListener('click', actions.onRanking);
    buttons.appendChild(rank);
  }
  const retry = el('button', isNewBest ? 'btn' : 'btn primary', view.coinsEnabled ? '다시 하기 (1코인)' : '다시 하기');
  retry.type = 'button';
  retry.addEventListener('click', actions.onRetry);
  const home = el('button', 'btn', '홈으로');
  home.type = 'button';
  home.addEventListener('click', actions.onHome);
  buttons.append(retry, home);

  const body = el('div', 'page-body result-body');
  body.append(box, card, share, shareNote, buttons);
  screen.append(view.topBar, body);
  root.replaceChildren(screen);

  if (result.rounds >= 1) runGlobal();
  else globalText.textContent = '1라운드 이상 성공하면 전체 랭킹에 올라가요';

  view.toss.available.then((ok) => {
    if (!ok || !card.isConnected) return;
    const row = el('div', 'rank-row-toss');
    const status = el('p', 'ranking-note', view.toss.submission ? '토스 랭킹에 올리는 중…' : '이번 기록은 토스 랭킹에 제출되지 않아요');
    status.setAttribute('aria-live', 'polite');
    const rowActions = el('div', 'rank-row-actions');
    rowActions.appendChild(rankingButton(view.toss.leaderboard, status));
    row.append(el('span', 'rank-row-label', '토스'), status, rowActions);
    card.appendChild(row);
    view.toss.submission?.then((outcome) => {
      if (status.isConnected) status.textContent = submitOutcomeMessage(outcome);
    });
  });
}
