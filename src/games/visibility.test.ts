// 게임 숨기기 단위 테스트
import { describe, expect, it } from 'vitest';
import { filterVisible, HIDDEN_GAME_IDS } from './visibility';

describe('filterVisible', () => {
  it('숨긴 id를 빼고 순서를 유지한다', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(filterVisible(list, ['b']).map((g) => g.id)).toEqual(['a', 'c']);
    expect(filterVisible(list, []).map((g) => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('기본값은 비어 있다', () => {
    expect(HIDDEN_GAME_IDS).toEqual([]);
  });
});
