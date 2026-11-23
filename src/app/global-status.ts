// 전체 랭킹 동기화 (로컬 최고 기록 제출·내 순위 조회)
import { encodeScore, shouldSubmit } from '../core/ranking';
import { getBest } from '../core/records';
import type { PlatformAdapter } from '../platform';
import type { ApiFailure, RankingClient } from './ranking-client';

export type GlobalStatus =
  | { kind: 'ok'; improved: boolean; rank: number }
  | { kind: 'needs-nickname' }
  | { kind: 'no-identity' }
  | { kind: 'no-record' }
  | { kind: 'failed'; reason: ApiFailure };

const submittedKey = (gameId: string) => `pb:rank:submitted:${gameId}`;

export function clearSubmittedMarker(platform: PlatformAdapter, gameId: string): void {
  platform.storage.set(submittedKey(gameId), '');
}

export async function syncGlobalRanking(platform: PlatformAdapter, client: RankingClient, gameId: string): Promise<GlobalStatus> {
  const identity = await platform.identity();
  if (!identity) return { kind: 'no-identity' };
  if (identity.needsNickname) return { kind: 'needs-nickname' };
  const best = getBest(platform.storage, gameId);
  if (!best) return { kind: 'no-record' };
  const score = encodeScore(best.rounds, best.avgMs);
  const raw = Number(platform.storage.get(submittedKey(gameId)) ?? '');
  const last = Number.isFinite(raw) && raw > 0 ? raw : null;

  const submit = async (): Promise<GlobalStatus> => {
    const res = await client.submit({
      gameId,
      playerId: identity.playerId,
      nickname: identity.nickname,
      rounds: best.rounds,
      avgMs: best.avgMs,
      bestMs: best.bestMs,
    });
    if (res.kind !== 'ok') return { kind: 'failed', reason: res.kind };
    platform.storage.set(submittedKey(gameId), String(score));
    return { kind: 'ok', improved: res.data.status === 'improved', rank: res.data.rank };
  };

  if (shouldSubmit(score, last)) return submit();
  const board = await client.board(gameId, identity.playerId);
  if (board.kind !== 'ok') return { kind: 'failed', reason: board.kind };
  if (!board.data.me) return submit();
  return { kind: 'ok', improved: false, rank: board.data.me.rank };
}

export function globalStatusText(status: GlobalStatus, platformName: PlatformAdapter['name']): string {
  switch (status.kind) {
    case 'ok':
      return status.improved ? `전체 ${status.rank}위로 올렸어요` : `기존 최고 기록 유지 · 전체 ${status.rank}위`;
    case 'needs-nickname':
      return '닉네임을 정하면 전체 랭킹에 올라가요';
    case 'no-identity':
      return platformName === 'web' ? '전체 랭킹에 참여할 수 없어요' : '토스 앱을 업데이트하면 전체 랭킹에 참여할 수 있어요';
    case 'no-record':
      return '기록을 세우면 전체 랭킹에 올라가요';
    case 'failed':
      if (status.reason === 'offline') return '오프라인이에요. 연결을 확인해 주세요';
      if (status.reason === 'not-configured') return '전체 랭킹을 준비하고 있어요';
      if (status.reason === 'invalid') return '이번 기록은 전체 랭킹에 올릴 수 없어요';
      return '잠시 후 다시 시도해 주세요';
  }
}

export function canRetry(status: GlobalStatus): boolean {
  return status.kind === 'failed' && status.reason !== 'invalid';
}
