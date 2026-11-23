// 게임 목록 단위 테스트
import { describe, expect, it } from 'vitest';
import { RANKED_GAME_IDS } from '../core/ranking';
import { allGames } from './registry';

describe('registry', () => {
  it('모든 게임이 랭킹 대상이고 id가 겹치지 않는다', () => {
    const ids = allGames.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(RANKED_GAME_IDS as readonly string[]).toContain(id);
  });
});
