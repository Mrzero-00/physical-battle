// 게임 탭 기본값 단위 테스트
import { describe, expect, it } from 'vitest';
import { resolveGameId } from './game-tabs';

describe('resolveGameId', () => {
  const visible = [{ id: 'reaction' }, { id: 'vision' }];
  it('보이는 게임이면 그대로', () => expect(resolveGameId(visible, 'vision')).toBe('vision'));
  it('숨겼거나 없는 id면 첫 게임', () => {
    expect(resolveGameId(visible, 'stroop')).toBe('reaction');
    expect(resolveGameId(visible, null)).toBe('reaction');
  });
});
