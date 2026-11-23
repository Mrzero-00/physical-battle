// 리더보드 점수 변환·응답 매핑 단위 테스트
import { describe, expect, it } from 'vitest';
import { mapSubmitResponse, submitOutcomeMessage, toLeaderboardScore, type SubmitOutcome } from './leaderboard';
import type { RunRecord } from './records';

const rec = (over: Partial<RunRecord> = {}): RunRecord => ({ gameId: 'reaction', rounds: 23, avgMs: 240, bestMs: 180, at: 0, ...over });

describe('toLeaderboardScore', () => {
  it('유효한 기록은 라운드 수 문자열', () => {
    expect(toLeaderboardScore(rec())).toBe('23');
  });

  it.each([
    ['rounds 0', { rounds: 0 }],
    ['avgMs 99', { avgMs: 99, bestMs: 99 }],
    ['NaN', { avgMs: Number.NaN }],
    ['소수 rounds', { rounds: 2.5 }],
  ])('%s는 null', (_, over) => {
    expect(toLeaderboardScore(rec(over))).toBeNull();
  });
});

describe('mapSubmitResponse', () => {
  it.each([
    ['SUCCESS', 'submitted'],
    ['LEADERBOARD_NOT_FOUND', 'leaderboard-not-found'],
    ['PROFILE_NOT_FOUND', 'profile-not-found'],
    ['UNPARSABLE_SCORE', 'invalid-score'],
  ])('%s → %s', (statusCode, expected) => {
    expect(mapSubmitResponse({ statusCode })).toBe(expected);
  });

  it('undefined는 unsupported', () => {
    expect(mapSubmitResponse(undefined)).toBe('unsupported');
  });

  it.each([[{}], [null], ['SUCCESS'], [{ statusCode: 'WHAT' }]])('알 수 없는 값 %j는 error', (res) => {
    expect(mapSubmitResponse(res)).toBe('error');
  });
});

describe('submitOutcomeMessage', () => {
  it('모든 결과에 문구가 있다', () => {
    const all: SubmitOutcome[] = ['submitted', 'unsupported', 'leaderboard-not-found', 'profile-not-found', 'invalid-score', 'error'];
    for (const o of all) expect(submitOutcomeMessage(o).length).toBeGreaterThan(0);
  });
});
