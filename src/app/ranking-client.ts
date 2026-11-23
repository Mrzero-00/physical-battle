// 전체 랭킹 API 클라이언트 (실패해도 throw하지 않음)
import type { Submission } from '../core/ranking';

export interface BoardRow {
  rank: number;
  nickname: string;
  rounds: number;
  avgMs: number;
  isMe: boolean;
}

export interface Board {
  top: BoardRow[];
  me: { rank: number; nickname: string; rounds: number; avgMs: number } | null;
  total: number;
}

export interface SubmitResponse {
  status: 'improved' | 'kept';
  rank: number;
  rounds: number;
  avgMs: number;
}

export type ApiFailure = 'invalid' | 'rate-limited' | 'not-configured' | 'offline' | 'error';
export type ApiResult<T> = { kind: 'ok'; data: T } | { kind: ApiFailure };

export interface RankingClient {
  submit(submission: Submission): Promise<ApiResult<SubmitResponse>>;
  board(gameId: string, playerId: string | null): Promise<ApiResult<Board>>;
}

export const REQUEST_TIMEOUT_MS = 5000;
export const RANKING_PATH = '/api/ranking';

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

function failureFor(status: number): ApiFailure {
  if (status === 400) return 'invalid';
  if (status === 429) return 'rate-limited';
  if (status === 503) return 'not-configured';
  if (status === 404) return 'offline';
  return 'error';
}

const isBoard = (v: unknown): v is Board =>
  typeof v === 'object' && v !== null && Array.isArray((v as Board).top) && typeof (v as Board).total === 'number';

const isSubmitResponse = (v: unknown): v is SubmitResponse =>
  typeof v === 'object' &&
  v !== null &&
  ((v as SubmitResponse).status === 'improved' || (v as SubmitResponse).status === 'kept') &&
  typeof (v as SubmitResponse).rank === 'number';

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

export function createRankingClient(fetchFn: FetchFn, base: string): RankingClient {
  async function call<T>(path: string, init: RequestInit, guard: (v: unknown) => v is T): Promise<ApiResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetchFn(joinUrl(base, path), { ...init, signal: controller.signal });
      if (!res.ok) return { kind: failureFor(res.status) };
      const data: unknown = await res.json().catch(() => undefined);
      return guard(data) ? { kind: 'ok', data } : { kind: 'error' };
    } catch {
      return { kind: 'offline' };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    submit(submission) {
      return call(
        RANKING_PATH,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission) },
        isSubmitResponse,
      );
    },
    board(gameId, playerId) {
      const q = new URLSearchParams({ gameId });
      if (playerId) q.set('playerId', playerId);
      return call(`${RANKING_PATH}?${q.toString()}`, { method: 'GET' }, isBoard);
    },
  };
}
