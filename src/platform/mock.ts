// 개발용 모의 플랫폼 (가짜 보상형 광고·토스 리더보드·전체 랭킹)
import type { ApiResult, Board, RankingClient, SubmitResponse } from '../app/ranking-client';
import type { RewardOutcome } from '../core/ads';
import { decodeScore, encodeScore, TOP_LIMIT, validateSubmission } from '../core/ranking';
import type { KeyValueStorage, PlatformAdapter } from './types';
import { createWebStorage, storedId, webShare } from './web';

export const MOCK_AD_DELAY_MS = 1500;
export const MOCK_NICKNAME = '목업 플레이어';
const MOCK_PLAYER_KEY = 'pb:mock-player';
const MOCK_BOARD_KEY = 'pb:mock-ranking';
const BOTS: Array<[string, number, number]> = [
  ['번개손', 14, 158],
  ['반응왕', 13, 171],
  ['초보탈출', 9, 214],
  ['느긋한곰', 6, 288],
  ['손가락요정', 11, 190],
];

const MOCK_OUTCOMES: RewardOutcome[] = ['rewarded', 'closed', 'failed', 'unavailable'];

export function mockAdOutcome(search: string): RewardOutcome {
  const value = new URLSearchParams(search).get('mockAd');
  return MOCK_OUTCOMES.includes(value as RewardOutcome) ? (value as RewardOutcome) : 'rewarded';
}

interface StoredEntry {
  nickname: string;
  score: number;
}

export function createFakeRankingClient(storage: KeyValueStorage): RankingClient {
  const load = (): Record<string, StoredEntry> => {
    try {
      const raw = storage.get(MOCK_BOARD_KEY);
      if (raw) return JSON.parse(raw) as Record<string, StoredEntry>;
    } catch {
      storage.set(MOCK_BOARD_KEY, '');
    }
    const seeded: Record<string, StoredEntry> = {};
    BOTS.forEach(([nickname, rounds, avg], i) => {
      seeded[`web:bot-000${i}`] = { nickname, score: encodeScore(rounds, avg) };
    });
    return seeded;
  };
  const save = (entries: Record<string, StoredEntry>) => storage.set(MOCK_BOARD_KEY, JSON.stringify(entries));
  const ranked = (entries: Record<string, StoredEntry>) =>
    Object.entries(entries).sort((a, b) => b[1].score - a[1].score);

  return {
    async submit(submission): Promise<ApiResult<SubmitResponse>> {
      const checked = validateSubmission(submission);
      if (!checked.ok) return { kind: 'invalid' };
      const entries = load();
      const score = encodeScore(checked.value.rounds, checked.value.avgMs);
      const previous = entries[checked.value.playerId]?.score ?? null;
      const improved = previous === null || score > previous;
      entries[checked.value.playerId] = { nickname: checked.value.nickname, score: improved ? score : (previous as number) };
      save(entries);
      const rank = ranked(entries).findIndex(([id]) => id === checked.value.playerId) + 1;
      return { kind: 'ok', data: { status: improved ? 'improved' : 'kept', rank, ...decodeScore(entries[checked.value.playerId].score) } };
    },
    async board(_gameId, playerId): Promise<ApiResult<Board>> {
      const entries = load();
      const list = ranked(entries);
      const top = list.slice(0, TOP_LIMIT).map(([id, e], i) => ({
        rank: i + 1,
        nickname: e.nickname,
        ...decodeScore(e.score),
        isMe: id === playerId,
      }));
      const mine = list.findIndex(([id]) => id === playerId);
      const me = mine === -1 ? null : { rank: mine + 1, nickname: list[mine][1].nickname, ...decodeScore(list[mine][1].score) };
      return { kind: 'ok', data: { top, me, total: list.length } };
    },
  };
}

export function createMockPlatform(search = globalThis.location?.search ?? ''): PlatformAdapter {
  const storage = createWebStorage();
  return {
    name: 'mock',
    storage,
    leaderboard: {
      available: async () => true,
      submit: async () => 'submitted',
      open: async () => undefined,
    },
    profile: async () => ({ nickname: MOCK_NICKNAME, imageUri: '' }),
    ads: {
      preload: () => undefined,
      isReady: () => true,
      showRewarded: () =>
        new Promise<RewardOutcome>((resolve) => setTimeout(() => resolve(mockAdOutcome(search)), MOCK_AD_DELAY_MS)),
    },
    identity: async () => ({
      playerId: `toss:mock-${storedId(storage, MOCK_PLAYER_KEY)}`,
      nickname: MOCK_NICKNAME,
      needsNickname: false,
    }),
    share: webShare,
    rankingClient: import.meta.env.VITE_RANKING_API_BASE ? undefined : createFakeRankingClient(storage),
  };
}
