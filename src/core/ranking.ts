// 전체 랭킹 점수 인코딩·제출 검증·닉네임 규칙 (클라이언트·서버 공용)
import { DEFAULT_LABELS, type ScoreLabels } from './labels';

export const RANKED_GAME_IDS = [
  'reaction',
  'vision',
  'gonogo',
  'timing',
  'flash',
  'peripheral',
  'tapspeed',
  'stroop',
  'mot',
  'balance',
] as const;
export const MAX_ROUNDS = 999;
export const MIN_MS = 100;
export const MAX_AVG_MS = 99999;
export const SCORE_BASE = 100000;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;
export const RATE_LIMIT_PER_MINUTE = 10;
export const TOP_LIMIT = 100;

const PLAYER_ID = /^(toss|web):[A-Za-z0-9+/=_-]{8,128}$/;
const NICKNAME_CHARS = /^[가-힣A-Za-z0-9 _-]+$/;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export interface Submission {
  gameId: string;
  playerId: string;
  nickname: string;
  rounds: number;
  avgMs: number;
  bestMs: number;
}

export type SubmissionError =
  | 'invalid-body'
  | 'invalid-game'
  | 'invalid-player'
  | 'invalid-rounds'
  | 'invalid-avg'
  | 'invalid-best'
  | NicknameError;

export type NicknameError = 'too-short' | 'too-long' | 'invalid-char' | 'blocked';

export interface ScoreRule {
  maxRounds: number;
  minAvg: number;
  maxAvg: number;
  minBest: number;
  minIntervalMs?: number;
}

export const DEFAULT_RULE: ScoreRule = { maxRounds: MAX_ROUNDS, minAvg: MIN_MS, maxAvg: MAX_AVG_MS, minBest: MIN_MS };

export const SCORE_RULES: Record<string, ScoreRule> = {
  timing: { maxRounds: MAX_ROUNDS, minAvg: 0, maxAvg: 120, minBest: 0 },
  tapspeed: { maxRounds: 248, minAvg: 100, maxAvg: 10000, minBest: 40, minIntervalMs: 40 },
};

export function ruleFor(gameId?: string): ScoreRule {
  return (gameId && SCORE_RULES[gameId]) || DEFAULT_RULE;
}

export type ScoreError = 'invalid-rounds' | 'invalid-avg' | 'invalid-best';

export function checkScore(gameId: string, rounds: unknown, avgMs: unknown, bestMs: unknown): ScoreError | null {
  const rule = ruleFor(gameId);
  if (!Number.isInteger(rounds) || (rounds as number) < 1 || (rounds as number) > rule.maxRounds) return 'invalid-rounds';
  if (!isFiniteNumber(avgMs) || avgMs < rule.minAvg || avgMs > rule.maxAvg) return 'invalid-avg';
  if (!isFiniteNumber(bestMs) || bestMs < rule.minBest || bestMs > avgMs) return 'invalid-best';
  if (rule.minIntervalMs && (rounds as number) > 1 + Math.floor((avgMs - MIN_MS) / rule.minIntervalMs)) return 'invalid-rounds';
  return null;
}

export function encodeScore(rounds: number, avgMs: number, gameId?: string): number {
  const avg = Math.min(MAX_AVG_MS, Math.max(ruleFor(gameId).minAvg, Math.round(avgMs)));
  return rounds * SCORE_BASE + (MAX_AVG_MS - avg);
}

export function decodeScore(score: number): { rounds: number; avgMs: number } {
  return { rounds: Math.floor(score / SCORE_BASE), avgMs: MAX_AVG_MS - (score % SCORE_BASE) };
}

export function normalizeNickname(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function validateNickname(
  raw: unknown,
  options: { isBlocked?: (name: string) => boolean } = {},
): { ok: true; value: string } | { ok: false; error: NicknameError } {
  if (typeof raw !== 'string') return { ok: false, error: 'too-short' };
  const value = normalizeNickname(raw);
  const length = [...value].length;
  if (length < NICKNAME_MIN) return { ok: false, error: 'too-short' };
  if (length > NICKNAME_MAX) return { ok: false, error: 'too-long' };
  if (!NICKNAME_CHARS.test(value)) return { ok: false, error: 'invalid-char' };
  if (options.isBlocked?.(value)) return { ok: false, error: 'blocked' };
  return { ok: true, value };
}

export function sanitizeNickname(raw: string, fallback: string): string {
  const cleaned = normalizeNickname(raw.normalize('NFC').replace(/[^가-힣A-Za-z0-9 _-]/g, ''));
  const clipped = [...cleaned].slice(0, NICKNAME_MAX).join('').trim();
  return [...clipped].length >= NICKNAME_MIN ? clipped : fallback;
}


export function validateSubmission(
  body: unknown,
  options: { isBlocked?: (name: string) => boolean } = {},
): { ok: true; value: Submission } | { ok: false; error: SubmissionError } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid-body' };
  const b = body as Record<string, unknown>;
  if (typeof b.gameId !== 'string' || !(RANKED_GAME_IDS as readonly string[]).includes(b.gameId)) {
    return { ok: false, error: 'invalid-game' };
  }
  if (typeof b.playerId !== 'string' || !PLAYER_ID.test(b.playerId)) return { ok: false, error: 'invalid-player' };
  const scoreError = checkScore(b.gameId, b.rounds, b.avgMs, b.bestMs);
  if (scoreError) return { ok: false, error: scoreError };
  const nickname = validateNickname(b.nickname, options);
  if (!nickname.ok) return nickname;
  return {
    ok: true,
    value: {
      gameId: b.gameId,
      playerId: b.playerId,
      nickname: nickname.value,
      rounds: b.rounds as number,
      avgMs: b.avgMs as number,
      bestMs: b.bestMs as number,
    },
  };
}

export function rateLimitDecision(count: number, limit = RATE_LIMIT_PER_MINUTE): boolean {
  return count <= limit;
}

export function shouldSubmit(score: number, lastSubmitted: number | null): boolean {
  return lastSubmitted === null || score > lastSubmitted;
}

export interface BestLike {
  rounds: number;
  avgMs: number;
}

export function bestComparisonText(
  current: { rounds: number; avgMs: number | null },
  previousBest: BestLike | null,
  gameId?: string,
  labels: Pick<ScoreLabels, 'roundsWord' | 'compareAvg'> = DEFAULT_LABELS,
): string | null {
  if (current.rounds < 1 || current.avgMs === null || !Number.isFinite(current.avgMs)) return null;
  if (previousBest === null) return '첫 기록이에요';
  const now = encodeScore(current.rounds, current.avgMs, gameId);
  const before = encodeScore(previousBest.rounds, previousBest.avgMs, gameId);
  if (now > before) return '최고 기록 경신!';
  if (current.rounds < previousBest.rounds) return `최고 기록까지 ${previousBest.rounds - current.rounds}${labels.roundsWord}`;
  const gap = Math.max(0, Math.round(current.avgMs) - Math.round(previousBest.avgMs));
  return `최고 기록과 같은 ${labels.roundsWord} · ${labels.compareAvg} +${gap}ms`;
}
