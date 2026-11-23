// 기기 저장 기록 관리 (최근 기록·최고 기록)
import type { KeyValueStorage } from '../platform';

export interface RunRecord {
  gameId: string;
  rounds: number;
  avgMs: number;
  bestMs: number;
  at: number;
}

export const RECENT_LIMIT = 10;
export const MIN_HUMAN_MS = 100;

const keyFor = (gameId: string) => `pb:records:${gameId}`;

function isValidMs(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_HUMAN_MS;
}

export function isValidRecord(record: RunRecord): boolean {
  return (
    typeof record.gameId === 'string' &&
    record.gameId.length > 0 &&
    Number.isInteger(record.rounds) &&
    record.rounds >= 1 &&
    isValidMs(record.avgMs) &&
    isValidMs(record.bestMs) &&
    record.bestMs <= record.avgMs &&
    Number.isFinite(record.at)
  );
}

export function compareRecords(a: RunRecord, b: RunRecord): number {
  if (a.rounds !== b.rounds) return b.rounds - a.rounds;
  return a.avgMs - b.avgMs;
}

interface StoredRecords {
  recent: RunRecord[];
  best: RunRecord | null;
}

function load(storage: KeyValueStorage, gameId: string): StoredRecords {
  const raw = storage.get(keyFor(gameId));
  if (!raw) return { recent: [], best: null };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredRecords>;
    const recent = Array.isArray(parsed.recent) ? parsed.recent.filter(isValidRecord) : [];
    const best = parsed.best && isValidRecord(parsed.best) ? parsed.best : null;
    return { recent: recent.slice(0, RECENT_LIMIT), best };
  } catch {
    return { recent: [], best: null };
  }
}

export function addRecord(storage: KeyValueStorage, record: RunRecord): { saved: boolean; isNewBest: boolean } {
  if (!isValidRecord(record)) return { saved: false, isNewBest: false };
  const current = load(storage, record.gameId);
  const recent = [record, ...current.recent].slice(0, RECENT_LIMIT);
  const isNewBest = current.best === null || compareRecords(record, current.best) < 0;
  const best = isNewBest ? record : current.best;
  storage.set(keyFor(record.gameId), JSON.stringify({ recent, best }));
  return { saved: true, isNewBest };
}

export function getBest(storage: KeyValueStorage, gameId: string): RunRecord | null {
  return load(storage, gameId).best;
}

export function getRecent(storage: KeyValueStorage, gameId: string): RunRecord[] {
  return load(storage, gameId).recent;
}
