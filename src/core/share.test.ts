// 공유 문구 단위 테스트
import { describe, expect, it } from 'vitest';
import { shareText, SITE_URL } from './share';

describe('shareText', () => {
  it('라운드·평균·주소가 들어간다', () => {
    const text = shareText(14, 158.4);
    expect(text).toContain('14라운드');
    expect(text).toContain('158ms');
    expect(text).toContain('https://physical-battle.vercel.app');
    expect(SITE_URL).toBe('https://physical-battle.vercel.app');
  });
});
