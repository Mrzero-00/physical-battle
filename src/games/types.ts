// 피지컬 테스트 미니게임 공통 인터페이스
import type { ScoreLabels } from '../core/labels';
import type { SkinId } from '../core/skins';
import type { KeyValueStorage } from '../platform';

export interface InputSample {
  t: number;
  x: number;
  y: number;
}

export interface GameResult {
  gameId: string;
  rounds: number;
  avgMs: number | null;
  bestMs: number | null;
  endReason: string;
}

export interface GameContext {
  root: HTMLElement;
  storage: KeyValueStorage;
  safeInsets: { top: number; right: number; bottom: number; left: number };
  setStatus(text: string): void;
  skin?: SkinId;
  onFinish(result: GameResult): void;
}

export interface GameInstance {
  start(): void;
  measure(input: InputSample): void;
  result(): GameResult | null;
  dispose(): void;
}

export interface GameModule {
  id: string;
  title: string;
  description: string;
  labels?: Partial<ScoreLabels>;
  create(ctx: GameContext): GameInstance;
}
