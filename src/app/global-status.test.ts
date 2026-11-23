// 전체 랭킹 제출 표시 키 단위 테스트
import { describe, expect, it } from 'vitest';
import { submittedKey } from './global-status';

describe('submittedKey', () => {
  it('규칙 변경으로 v2 키를 쓴다', () => {
    expect(submittedKey('reaction')).toBe('pb:rank:submitted:v2:reaction');
  });
});
