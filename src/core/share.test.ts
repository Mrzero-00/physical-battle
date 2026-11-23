// 공유 문구 단위 테스트
import { describe, expect, it } from 'vitest';
import { DEFAULT_LABELS } from './labels';
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

  it('평균을 빼는 게임은 회 단위로', () => {
    const text = shareText('연타 속도', 87, 9800, SITE_URL, { ...DEFAULT_LABELS, roundsWord: '회', shareAvg: false });
    expect(text).toBe('피지컬 배틀 연타 속도 87회 달성! 도전해 보세요 https://physical-battle.vercel.app');
    expect(shareText('반응속도', 14, 158)).toBe('피지컬 배틀 반응속도 14라운드 · 평균 158ms 달성! 도전해 보세요 https://physical-battle.vercel.app');
  });
});
