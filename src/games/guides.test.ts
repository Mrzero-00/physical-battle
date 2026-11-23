// 게임 가이드 데이터 단위 테스트
import { describe, expect, it } from 'vitest';
import { GUIDES, guideFor, guideSeenKey } from './guides';
import { allGames } from './registry';

describe('guides', () => {
  it.each(allGames.map((g) => [g.id, g.title]))('%s 가이드가 있고 제목이 같다', (id, title) => {
    const guide = guideFor(id);
    expect(guide).not.toBeNull();
    expect(guide?.title).toBe(title);
    expect(guide?.steps).toHaveLength(3);
    for (const step of guide?.steps ?? []) {
      expect(step.length).toBeGreaterThan(0);
      expect(step.length).toBeLessThanOrEqual(30);
    }
    expect(guide?.gameOver.length).toBeGreaterThan(0);
    expect(guide?.record.length).toBeGreaterThan(0);
  });

  it('없는 게임은 null', () => {
    expect(guideFor('nope')).toBeNull();
    expect(guideFor('toString')).toBeNull();
  });

  it('seen 키', () => {
    expect(guideSeenKey('reaction')).toBe('pb:guide-seen:reaction');
  });

  it.each(Object.entries(GUIDES))('%s 그림은 안전하고 작다', (_, guide) => {
    expect(guide.svg.startsWith('<svg')).toBe(true);
    expect(guide.svg.endsWith('</svg>')).toBe(true);
    expect(guide.svg.length).toBeLessThanOrEqual(1500);
    expect(guide.svg).not.toMatch(/<script|href|url\(|on[a-z]+=|\sid=|<!--|<animate|<style/i);
    expect(guide.svg.replace('xmlns="http://www.w3.org/2000/svg"', '')).not.toContain('http');
  });

  it('핵심 문구가 그대로 들어 있다', () => {
    expect(GUIDES.reaction.record).toBe('버틴 라운드 수, 같으면 평균 반응이 빠른 쪽');
    expect(GUIDES.tapspeed.record).toBe('10초 동안 인정된 탭 수, 같으면 마지막 탭이 빠른 쪽');
    expect(GUIDES.flash.gameOver).toBe('숫자를 하나라도 틀리거나 제한 시간(3초+자리당 1초)을 넘기면 끝나요.');
  });
});
