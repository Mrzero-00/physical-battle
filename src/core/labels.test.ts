// 점수 표기 라벨 단위 테스트
import { describe, expect, it } from 'vitest';
import { DEFAULT_LABELS, formatMs, withLabels } from './labels';

describe('labels', () => {
  it('기본값은 반응속도 표기', () => {
    expect(DEFAULT_LABELS.roundsUnit).toBe('R');
    expect(withLabels({ avgLabel: '평균 판단' }).bestLabel).toBe('최고 반응');
  });

  it('formatMs', () => {
    expect(formatMs(158.4)).toBe('158ms');
    expect(formatMs(9871, withLabels({ avgUnit: 's' }))).toBe('9.87초');
  });
});
