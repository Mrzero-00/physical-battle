// 전체 랭킹 화면 (TOP 100·내 순위)
import { formatMs, type ScoreLabels } from '../core/labels';
import type { PlatformAdapter } from '../platform';
import { el } from './dom';
import type { Board, RankingClient } from './ranking-client';
import { rankingButton } from './ranking';

export interface GlobalRankingOptions {
  topBar: HTMLElement;
  tabs: HTMLElement;
  showTossLeaderboard: boolean;
  labels: ScoreLabels;
  platform: PlatformAdapter;
  client: RankingClient;
  gameId: string;
  onNickname(): void;
}

const FAILURE_TEXT: Record<string, string> = {
  offline: '오프라인이에요. 연결을 확인해 주세요',
  'not-configured': '전체 랭킹을 준비하고 있어요',
  'rate-limited': '잠시 후 다시 시도해 주세요',
  invalid: '랭킹을 불러올 수 없어요',
  error: '랭킹을 불러올 수 없어요',
};

function renderBoard(board: Board, labels: ScoreLabels): HTMLElement {
  const wrap = el('div', 'rank-board');
  const mine = el('p', 'my-rank', board.me ? `내 순위 ${board.me.rank}위 · ${board.me.rounds}${labels.roundsUnit} · ${labels.avgLabel} ${formatMs(board.me.avgMs, labels)}` : '아직 내 기록이 없어요');
  wrap.appendChild(mine);
  wrap.appendChild(el('p', 'rank-total', `참여 ${board.total}명`));
  if (board.top.length === 0) {
    wrap.appendChild(el('p', 'section-empty', '아직 아무도 기록이 없어요. 첫 번째가 되어 보세요'));
    return wrap;
  }
  const list = el('ol', 'rank-list');
  for (const row of board.top) {
    const item = el('li', row.isMe ? 'rank-row is-me' : 'rank-row');
    item.append(
      el('span', 'rank-no', String(row.rank)),
      el('span', 'rank-name', row.nickname),
      el('span', 'rank-rounds', `${row.rounds}${labels.roundsUnit}`),
      el('span', 'rank-avg', formatMs(row.avgMs, labels)),
    );
    if (row.isMe) item.setAttribute('aria-current', 'true');
    list.appendChild(item);
  }
  wrap.appendChild(list);
  return wrap;
}

export function renderGlobalRanking(root: HTMLElement, options: GlobalRankingOptions): void {
  const screen = el('main', 'screen page global-ranking');
  const body = el('div', 'page-body');
  const status = el('p', 'rank-status', '불러오는 중…');
  status.setAttribute('aria-live', 'polite');
  const content = el('div', 'rank-content');
  const tools = el('div', 'rank-tools');
  body.append(options.tabs, tools, status, content);
  screen.append(options.topBar, body);
  root.replaceChildren(screen);

  const load = async () => {
    status.className = 'rank-status';
    status.textContent = '불러오는 중…';
    content.replaceChildren();
    const identity = await options.platform.identity();
    const res = await options.client.board(options.gameId, identity?.playerId ?? null);
    if (!screen.isConnected) return;
    if (res.kind !== 'ok') {
      status.className = 'rank-status rank-error';
      status.textContent = FAILURE_TEXT[res.kind];
      const retry = el('button', 'btn', '다시 시도');
      retry.type = 'button';
      retry.addEventListener('click', load);
      content.appendChild(retry);
      return;
    }
    status.textContent = '';
    content.appendChild(renderBoard(res.data, options.labels));
    const mine = content.querySelector('.is-me');
    if (mine instanceof HTMLElement) mine.scrollIntoView({ block: 'center' });
  };

  options.platform.identity().then((identity) => {
    if (!screen.isConnected) return;
    if (options.platform.name === 'web') {
      const edit = el('button', 'link-btn', identity?.nickname ? `닉네임: ${identity.nickname} · 바꾸기` : '닉네임 정하기');
      edit.type = 'button';
      edit.addEventListener('click', options.onNickname);
      tools.appendChild(edit);
    }
  });
  options.platform.leaderboard.available().then((ok) => {
    if (!ok || !screen.isConnected || !options.showTossLeaderboard) return;
    const note = el('p', 'ranking-note', '친구 순위는 토스 랭킹에서 볼 수 있어요');
    tools.append(note, rankingButton(options.platform.leaderboard, note));
  });
  load();
}
