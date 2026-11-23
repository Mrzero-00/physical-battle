// 공유 문구 단위 테스트
import { describe, expect, it } from 'vitest';
import { shareText, SITE_URL } from './share';

describe('shareText', () => {
  it('라운드·평균·주소가 들어간다', () => {
    const text = shareText('반응속도', 14, 158.4);
    expect(text).toContain('반응속도');
    expect(text).toContain('14라운드');
    expect(shareText('동체시력', 7, 820)).toContain('피지컬 배틀 동체시력 7라운드 · 평균 820ms');
    expect(text).toContain('158ms');
    expect(text).toContain('https://physical-battle.vercel.app');
    expect(SITE_URL).toBe('https://physical-battle.vercel.app');
  });
});
