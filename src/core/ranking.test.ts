// 전체 랭킹 순수 함수 단위 테스트
import { describe, expect, it } from 'vitest';
import {
  bestComparisonText,
  decodeScore,
  encodeScore,
  rateLimitDecision,
  sanitizeNickname,
  shouldSubmit,
  validateNickname,
  validateSubmission,
} from './ranking';

const body = (over: Record<string, unknown> = {}) => ({
  gameId: 'reaction',
  playerId: 'web:0b8f2c1e-1111-4a2b-9c3d-aaaaaaaaaaaa',
  nickname: '테스터',
  rounds: 12,
  avgMs: 210,
  bestMs: 180,
  ...over,
});

describe('encodeScore', () => {
  it('라운드가 많을수록, 같으면 평균이 빠를수록 크다', () => {
    expect(encodeScore(10, 250)).toBeGreaterThan(encodeScore(10, 300));
    expect(encodeScore(10, 300)).toBeGreaterThan(encodeScore(9, 100));
  });

  it('최댓값은 99,999,899이고 안전한 정수다', () => {
    expect(encodeScore(999, 100)).toBe(99_999_899);
    expect(Number.isSafeInteger(encodeScore(999, 100))).toBe(true);
  });

  it('왕복 변환된다', () => {
    expect(decodeScore(encodeScore(23, 187))).toEqual({ rounds: 23, avgMs: 187 });
  });

  it('평균은 반올림한다', () => {
    expect(decodeScore(encodeScore(5, 250.4)).avgMs).toBe(250);
    expect(decodeScore(encodeScore(5, 250.6)).avgMs).toBe(251);
  });
});

describe('validateSubmission', () => {
  it('정상 제출은 통과한다', () => {
    const r = validateSubmission(body({ nickname: '  홍  길동 ' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.nickname).toBe('홍 길동');
  });

  it.each([
    [{ rounds: 0 }, 'invalid-rounds'],
    [{ rounds: 1000 }, 'invalid-rounds'],
    [{ rounds: 1.5 }, 'invalid-rounds'],
    [{ avgMs: 99, bestMs: 99 }, 'invalid-avg'],
    [{ avgMs: Number.NaN }, 'invalid-avg'],
    [{ avgMs: Number.POSITIVE_INFINITY }, 'invalid-avg'],
    [{ avgMs: 100000 }, 'invalid-avg'],
    [{ bestMs: 300 }, 'invalid-best'],
    [{ bestMs: 99 }, 'invalid-best'],
    [{ gameId: 'x' }, 'invalid-game'],
    [{ playerId: 'abc' }, 'invalid-player'],
    [{ playerId: 'evil:aaaaaaaaaa' }, 'invalid-player'],
    [{ nickname: 'a' }, 'too-short'],
  ])('%j → %s', (over, error) => {
    expect(validateSubmission(body(over))).toEqual({ ok: false, error });
  });

  it('객체가 아니면 invalid-body', () => {
    expect(validateSubmission(null)).toEqual({ ok: false, error: 'invalid-body' });
    expect(validateSubmission('x')).toEqual({ ok: false, error: 'invalid-body' });
  });
});

describe('validateNickname', () => {
  it.each([
    ['a', 'too-short'],
    ['가나다라마바사아자차카타파', 'too-long'],
    ['<b>', 'invalid-char'],
  ])('%s → %s', (raw, error) => {
    expect(validateNickname(raw)).toEqual({ ok: false, error });
  });

  it('차단 훅', () => {
    expect(validateNickname('나쁜말', { isBlocked: () => true })).toEqual({ ok: false, error: 'blocked' });
  });

  it('공백을 정리한다', () => {
    expect(validateNickname('  홍 길동 ')).toEqual({ ok: true, value: '홍 길동' });
    expect(validateNickname('Speed_King-1')).toEqual({ ok: true, value: 'Speed_King-1' });
  });
});

describe('sanitizeNickname', () => {
  it('허용되지 않는 문자를 지우고 12자로 자른다', () => {
    expect(sanitizeNickname('번개★손', '토스 플레이어')).toBe('번개손');
    expect(sanitizeNickname('가나다라마바사아자차카타파하', 'x')).toBe('가나다라마바사아자차카타');
  });

  it('2자 미만이 되면 대체값', () => {
    expect(sanitizeNickname('★☆', '토스 플레이어')).toBe('토스 플레이어');
    expect(sanitizeNickname('a', '토스 플레이어')).toBe('토스 플레이어');
  });
});

describe('rateLimitDecision', () => {
  it('분당 10회까지 허용', () => {
    expect(rateLimitDecision(10, 10)).toBe(true);
    expect(rateLimitDecision(11, 10)).toBe(false);
  });
});

describe('shouldSubmit', () => {
  it('처음이거나 더 좋을 때만', () => {
    expect(shouldSubmit(500, null)).toBe(true);
    expect(shouldSubmit(500, 400)).toBe(true);
    expect(shouldSubmit(400, 400)).toBe(false);
    expect(shouldSubmit(300, 400)).toBe(false);
  });
});

describe('bestComparisonText', () => {
  it('첫 기록', () => {
    expect(bestComparisonText({ rounds: 5, avgMs: 200 }, null)).toBe('첫 기록이에요');
  });

  it('경신', () => {
    expect(bestComparisonText({ rounds: 9, avgMs: 200 }, { rounds: 8, avgMs: 150 })).toBe('최고 기록 경신!');
    expect(bestComparisonText({ rounds: 8, avgMs: 140 }, { rounds: 8, avgMs: 150 })).toBe('최고 기록 경신!');
  });

  it('라운드 부족', () => {
    expect(bestComparisonText({ rounds: 6, avgMs: 200 }, { rounds: 8, avgMs: 150 })).toBe('최고 기록까지 2라운드');
  });

  it('같은 라운드, 평균이 느림', () => {
    expect(bestComparisonText({ rounds: 8, avgMs: 172 }, { rounds: 8, avgMs: 150 })).toBe('최고 기록과 같은 라운드 · 평균 +22ms');
  });

  it('무효 기록은 null', () => {
    expect(bestComparisonText({ rounds: 0, avgMs: null }, { rounds: 8, avgMs: 150 })).toBeNull();
  });
});

describe('ranked games', () => {
  it('vision은 허용, dynamic-vision은 거부', () => {
    expect(validateSubmission(body({ gameId: 'vision', avgMs: 820, bestMs: 500 })).ok).toBe(true);
    expect(validateSubmission(body({ gameId: 'dynamic-vision' }))).toEqual({ ok: false, error: 'invalid-game' });
  });
});
