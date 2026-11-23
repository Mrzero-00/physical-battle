// 보상형 광고 이벤트 상태 머신
export type RewardOutcome = 'rewarded' | 'closed' | 'unavailable' | 'failed';

export type AdEventType =
  | 'requested'
  | 'show'
  | 'impression'
  | 'clicked'
  | 'userEarnedReward'
  | 'dismissed'
  | 'failedToShow'
  | 'error'
  | 'visible'
  | 'tick';

export interface AdEvent {
  type: AdEventType;
  at: number;
}

export interface AdState {
  done: boolean;
  rewarded: boolean;
  startedAt: number;
  shownAt: number | null;
  visibleAt: number | null;
  outcome: RewardOutcome | null;
}

export const SHOW_TIMEOUT_MS = 5000;
export const RETURN_GRACE_MS = 1000;
export const HARD_CAP_MS = 90000;

export function startAd(now: number): AdState {
  return { done: false, rewarded: false, startedAt: now, shownAt: null, visibleAt: null, outcome: null };
}

const finish = (state: AdState, outcome: RewardOutcome): AdState => ({ ...state, done: true, outcome });

export function reduceAdEvent(state: AdState, event: AdEvent): AdState {
  if (state.done) return state;
  switch (event.type) {
    case 'requested':
    case 'clicked':
      return state;
    case 'show':
    case 'impression':
      return state.shownAt === null ? { ...state, shownAt: event.at } : state;
    case 'userEarnedReward':
      return {
        ...state,
        rewarded: true,
        shownAt: state.shownAt ?? event.at,
      };
    case 'dismissed':
      return finish(state, state.rewarded ? 'rewarded' : 'closed');
    case 'failedToShow':
    case 'error':
      return finish(state, state.rewarded ? 'rewarded' : 'failed');
    case 'visible':
      return state.shownAt === null ? state : { ...state, visibleAt: event.at };
    case 'tick': {
      if (event.at - state.startedAt >= HARD_CAP_MS) return finish(state, state.rewarded ? 'rewarded' : 'failed');
      if (state.shownAt === null && event.at - state.startedAt >= SHOW_TIMEOUT_MS) return finish(state, 'failed');
      if (state.visibleAt !== null && event.at - state.visibleAt >= RETURN_GRACE_MS) {
        return finish(state, state.rewarded ? 'rewarded' : 'closed');
      }
      return state;
    }
  }
}
