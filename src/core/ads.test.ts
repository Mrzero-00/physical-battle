// 보상형 광고 상태 머신 단위 테스트
import { describe, expect, it } from 'vitest';
import { HARD_CAP_MS, reduceAdEvent, startAd, type AdEvent, type AdEventType, type AdState } from './ads';

function run(events: Array<[AdEventType, number]>, start = 0): AdState {
  return events.reduce<AdState>((s, [type, at]) => reduceAdEvent(s, { type, at } as AdEvent), startAd(start));
}

describe('reduceAdEvent', () => {
  it('show → 보상 → dismissed는 rewarded', () => {
    const s = run([['requested', 10], ['show', 20], ['impression', 30], ['userEarnedReward', 4000], ['dismissed', 4100]]);
    expect(s).toMatchObject({ done: true, outcome: 'rewarded' });
  });

  it('show → dismissed는 closed', () => {
    expect(run([['show', 20], ['dismissed', 2000]]).outcome).toBe('closed');
  });

  it('failedToShow와 error는 failed', () => {
    expect(run([['requested', 10], ['failedToShow', 20]]).outcome).toBe('failed');
    expect(run([['error', 20]]).outcome).toBe('failed');
  });

  it('보상 뒤 dismissed가 없어도 화면 복귀 1000ms 후 rewarded', () => {
    const s = run([['show', 20], ['userEarnedReward', 3000], ['visible', 5000], ['tick', 5999]]);
    expect(s.done).toBe(false);
    expect(reduceAdEvent(s, { type: 'tick', at: 6000 })).toMatchObject({ done: true, outcome: 'rewarded' });
  });

  it('보상 없이 화면 복귀 1000ms 후 closed', () => {
    expect(run([['show', 20], ['visible', 3000], ['tick', 4000]]).outcome).toBe('closed');
  });

  it('보상 이벤트가 두 번 와도 보상은 한 번', () => {
    const s = run([['show', 20], ['userEarnedReward', 100], ['userEarnedReward', 110], ['dismissed', 200]]);
    expect(s).toMatchObject({ done: true, rewarded: true, outcome: 'rewarded' });
  });

  it('5000ms 동안 show가 없으면 failed', () => {
    expect(run([['requested', 10], ['tick', 4999]]).done).toBe(false);
    expect(run([['requested', 10], ['tick', 5000]]).outcome).toBe('failed');
  });

  it('90000ms가 지나면 강제 종료', () => {
    expect(run([['show', 20], ['tick', HARD_CAP_MS]])).toMatchObject({ done: true, outcome: 'failed' });
    expect(run([['show', 20], ['userEarnedReward', 30], ['tick', HARD_CAP_MS]])).toMatchObject({ done: true, outcome: 'rewarded' });
  });

  it('show 전의 visible은 무시한다', () => {
    expect(run([['visible', 100], ['tick', 1200]]).done).toBe(false);
  });

  it('종료 뒤 들어온 이벤트는 무시한다', () => {
    const done = run([['show', 20], ['dismissed', 100]]);
    expect(reduceAdEvent(done, { type: 'userEarnedReward', at: 200 })).toBe(done);
    expect(reduceAdEvent(done, { type: 'failedToShow', at: 200 })).toBe(done);
  });
});
