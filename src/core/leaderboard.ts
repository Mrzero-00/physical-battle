// 토스 리더보드 점수 변환·응답 매핑
import { isValidRecord, type RunRecord } from './records';

export type SubmitOutcome =
  | 'submitted'
  | 'unsupported'
  | 'leaderboard-not-found'
  | 'profile-not-found'
  | 'invalid-score'
  | 'error';

export function toLeaderboardScore(record: RunRecord): string | null {
  if (!isValidRecord(record)) return null;
  return String(record.rounds);
}

const STATUS_TO_OUTCOME: Record<string, SubmitOutcome> = {
  SUCCESS: 'submitted',
  LEADERBOARD_NOT_FOUND: 'leaderboard-not-found',
  PROFILE_NOT_FOUND: 'profile-not-found',
  UNPARSABLE_SCORE: 'invalid-score',
};

export function mapSubmitResponse(res: unknown): SubmitOutcome {
  if (res === undefined) return 'unsupported';
  if (typeof res !== 'object' || res === null) return 'error';
  const status = (res as { statusCode?: unknown }).statusCode;
  if (typeof status !== 'string') return 'error';
  return STATUS_TO_OUTCOME[status] ?? 'error';
}

const MESSAGES: Record<SubmitOutcome, string> = {
  submitted: '랭킹에 기록을 올렸어요',
  unsupported: '토스 앱을 업데이트하면 랭킹에 참여할 수 있어요',
  'leaderboard-not-found': '랭킹을 준비하고 있어요',
  'profile-not-found': '게임 프로필을 만든 뒤 랭킹에 참여할 수 있어요',
  'invalid-score': '이번 기록은 제출할 수 없어요',
  error: '기록 제출에 실패했어요',
};

export function submitOutcomeMessage(outcome: SubmitOutcome): string {
  return MESSAGES[outcome];
}
