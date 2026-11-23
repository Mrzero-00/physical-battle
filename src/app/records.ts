// 내 기록 화면 (최고 기록·최근 10판)
import { formatMs, type ScoreLabels } from '../core/labels';
import { getBest, getRecent, type RunRecord } from '../core/records';
import type { KeyValueStorage } from '../platform';
import { el } from './dom';

const pad = (n: number) => String(n).padStart(2, '0');

export function formatRecordDate(at: number): string {
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface RecordsOptions {
  topBar: HTMLElement;
  tabs: HTMLElement;
  storage: KeyValueStorage;
  gameId: string;
  gameTitle: string;
  labels: ScoreLabels;
  onRanking(): void;
}

function recordLine(r: RunRecord, labels: ScoreLabels): string {
  return `${r.rounds}${labels.roundsUnit} · ${labels.avgLabel} ${formatMs(r.avgMs, labels)} · ${formatRecordDate(r.at)}`;
}

export function renderRecords(root: HTMLElement, options: RecordsOptions): void {
  const screen = el('main', 'screen page records');
  const best = getBest(options.storage, options.gameId);
  const recent = getRecent(options.storage, options.gameId);

  const card = el('section', 'best-card');
  card.appendChild(el('p', 'best-label', `${options.gameTitle} 최고 기록`));
  if (best) {
    card.append(
      el('p', 'best-rounds', `${best.rounds}${options.labels.roundsUnit}`),
      el('p', 'best-meta', `${options.labels.avgLabel} ${formatMs(best.avgMs, options.labels)} · ${options.labels.bestLabel} ${formatMs(best.bestMs, options.labels)} · ${formatRecordDate(best.at)}`),
    );
  } else {
    card.appendChild(el('p', 'best-empty', '아직 기록이 없어요'));
  }

  const section = el('section', 'recent-section');
  section.appendChild(el('h2', 'section-title', '최근 기록'));
  if (recent.length === 0) {
    section.appendChild(el('p', 'section-empty', '한 판 플레이하면 여기에 쌓여요'));
  } else {
    const list = el('ol', 'recent-list');
    for (const r of recent) list.appendChild(el('li', 'recent-row', recordLine(r, options.labels)));
    section.appendChild(list);
  }

  const go = el('button', 'btn primary', '전체 랭킹 보기');
  go.type = 'button';
  go.addEventListener('click', options.onRanking);

  const body = el('div', 'page-body');
  body.append(options.tabs, card, section, go);
  screen.append(options.topBar, body);
  root.replaceChildren(screen);
}
