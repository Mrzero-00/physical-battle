// 연타 속도 게임 모듈 (10초 동안 좌우 번갈아 탭)
import { clearTest, exposeTest } from '../test-hook';
import type { GameContext, GameInstance, GameModule, GameResult, InputSample } from '../types';
import {
  COUNTDOWN_MS,
  DURATION_MS,
  acceptTap,
  createTapState,
  remainingMs,
  sideOf,
  summarizeTaps,
  type Side,
  type TapState,
} from './scoring';
import './style.css';

type Phase = 'ready' | 'countdown' | 'play' | 'over';

const END_GRACE_MS = 50;
const PRESS_MS = 90;
const END_HINT: Record<string, string> = { 'time-up': '시간 종료!', timeout: '중단됐어요' };

function createTapSpeedGame(ctx: GameContext): GameInstance {
  const area = document.createElement('div');
  area.className = 'tapspeed-area';
  const pads = document.createElement('div');
  pads.className = 'tapspeed-pads';
  const padEls: Record<Side, HTMLElement> = { left: document.createElement('div'), right: document.createElement('div') };
  padEls.left.className = 'tapspeed-pad tapspeed-pad-left';
  padEls.left.textContent = 'L';
  padEls.right.className = 'tapspeed-pad tapspeed-pad-right';
  padEls.right.textContent = 'R';
  pads.append(padEls.left, padEls.right);
  const counter = document.createElement('div');
  counter.className = 'tapspeed-counter';
  counter.setAttribute('aria-live', 'off');
  const hint = document.createElement('p');
  hint.className = 'tapspeed-hint';
  area.append(pads, counter, hint);
  ctx.root.appendChild(area);

  let phase: Phase = 'ready';
  let state: TapState = createTapState(0);
  let goAt: number | null = null;
  let frame = 0;
  let statusText = '';
  let finished: GameResult | null = null;
  let listening = false;
  const pressTimers: Record<Side, number> = { left: 0, right: 0 };

  const syncHook = () => {
    exposeTest('tapspeed', { phase, goAt });
  };

  const setPhase = (next: Phase) => {
    phase = next;
    area.dataset.phase = next;
    syncHook();
  };

  const setStatus = (text: string) => {
    if (text === statusText) return;
    statusText = text;
    ctx.setStatus(text);
  };

  const clearPress = () => {
    for (const side of ['left', 'right'] as const) {
      window.clearTimeout(pressTimers[side]);
      padEls[side].classList.remove('is-pressed');
    }
  };

  const clearTimers = () => {
    window.cancelAnimationFrame(frame);
    clearPress();
  };

  const finish = (endReason: string) => {
    if (phase !== 'countdown' && phase !== 'play') return;
    clearTimers();
    hint.textContent = END_HINT[endReason] ?? '';
    setPhase('over');
    setStatus(`${state.count}회 · ${END_HINT[endReason] ?? ''}`);
    finished = { gameId: 'tapspeed', ...summarizeTaps(state, endReason) };
    ctx.onFinish(finished);
  };

  const tick = (ts: number) => {
    if (phase !== 'countdown' && phase !== 'play') return;
    if (goAt === null) {
      goAt = ts + COUNTDOWN_MS;
      state = createTapState(goAt);
      syncHook();
    }
    if (ts < goAt) {
      counter.textContent = String(Math.max(1, Math.ceil((goAt - ts) / 1000)));
      setStatus('준비하세요');
    } else {
      if (phase === 'countdown') {
        setPhase('play');
        counter.textContent = String(state.count);
        hint.textContent = '';
      }
      setStatus(`남은 시간 ${(remainingMs(goAt, ts) / 1000).toFixed(1)}초`);
      if (ts - goAt >= DURATION_MS + END_GRACE_MS) {
        finish('time-up');
        return;
      }
    }
    frame = window.requestAnimationFrame(tick);
  };

  const press = (side: Side) => {
    const pad = padEls[side];
    window.clearTimeout(pressTimers[side]);
    pad.classList.add('is-pressed');
    pressTimers[side] = window.setTimeout(() => pad.classList.remove('is-pressed'), PRESS_MS);
  };

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    instance.measure({ t: event.timeStamp, x: event.clientX, y: event.clientY });
  };

  const onVisibility = () => {
    if (document.visibilityState !== 'hidden') return;
    finish('timeout');
  };

  const instance: GameInstance = {
    start() {
      clearTimers();
      goAt = null;
      state = createTapState(0);
      finished = null;
      statusText = '';
      counter.textContent = '';
      setPhase('ready');
      hint.textContent = '화면을 탭하면 시작합니다';
      ctx.setStatus('10초 동안 좌우를 번갈아 탭하세요');
      if (!listening) {
        area.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('visibilitychange', onVisibility);
        listening = true;
      }
    },
    measure(input: InputSample) {
      if (phase === 'ready') {
        hint.textContent = '좌우를 번갈아 탭하세요';
        setPhase('countdown');
        frame = window.requestAnimationFrame(tick);
        return;
      }
      if ((phase !== 'play' && phase !== 'countdown') || goAt === null) return;
      const rect = area.getBoundingClientRect();
      const side = sideOf(input.x, rect.left, rect.width);
      const next = acceptTap(state, { t: input.t, side });
      if (!next.accepted) return;
      state = next.state;
      counter.textContent = String(state.count);
      press(side);
    },
    result() {
      return finished;
    },
    dispose() {
      clearTimers();
      area.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibility);
      listening = false;
      clearTest();
      area.remove();
    },
  };
  return instance;
}

export const tapSpeedGame: GameModule = {
  id: 'tapspeed',
  title: '연타 속도',
  description: '10초 동안 화면 좌우를 번갈아 최대한 빨리 탭하세요.',
  labels: {
    roundsWord: '회',
    roundsUnit: '회',
    roundsLabel: '회 연타',
    avgLabel: '마지막 탭',
    bestLabel: '최소 간격',
    compareAvg: '마지막 탭',
    shareAvg: false,
  },
  create: createTapSpeedGame,
};
