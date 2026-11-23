// 버튼 모양(스킨) 단위 테스트
import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../platform/types';
import { loadSkin, parseSkin, saveSkin, SKIN_KEY, skinMarkup, SKINS } from './skins';

function memory(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v) };
}

describe('skins', () => {
  it('목록 순서와 이름', () => {
    expect(SKINS.map((s) => s.id)).toEqual(['default', 'mosquito', 'butterfly', 'cockroach']);
    expect(SKINS.map((s) => s.name)).toEqual(['기본 버튼', '모기', '나비', '바퀴벌레']);
  });

  it('parseSkin', () => {
    expect(parseSkin('butterfly')).toBe('butterfly');
    for (const raw of [null, '', 'bee', ' butterfly', 'DEFAULT']) expect(parseSkin(raw)).toBe('default');
  });

  it('저장과 불러오기', () => {
    const s = memory();
    expect(loadSkin(s)).toBe('default');
    saveSkin(s, 'cockroach');
    expect(s.map.get(SKIN_KEY)).toBe('cockroach');
    expect(SKIN_KEY).toBe('pb:skin');
    expect(loadSkin(s)).toBe('cockroach');
  });

  it.each(SKINS.map((s) => s.id))('%s 마크업은 안전하고 작다', (id) => {
    const svg = skinMarkup(id);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(`class="skin skin-${id}"`);
    expect(svg).not.toMatch(/<script|href|url\(|http|\bon[a-z]+=|\bid=/i);
    expect(svg.length).toBeLessThanOrEqual(1500);
    if (id !== 'default') expect(svg).toContain('skin-part');
  });
});
