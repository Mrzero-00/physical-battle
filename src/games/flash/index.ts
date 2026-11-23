// 순간 기억 게임 모듈 (잠깐 보인 숫자를 순서대로 입력)
import { clearTest, exposeTest } from '../test-hook';
import type { GameContext, GameInstance, GameModule, GameResult, InputSample } from '../types';
import {
  TIMEOUT_GRACE_MS,
  answerLimitMs,
  digitCount,
  exposureMs,
  judgeDigit,
  makeSequence,
  summarizeFlash,
  tapWindow,
  type FlashResult,
} from './scoring';
import './style.css';

type Phase = 'ready' | 'waiting' | 'show' | 'input' | 'feedback' | 'over';

const WAIT_MS = 700;
const CLEAR_PAUSE_MS = 600;
const KEY_LAYOUT: (number | null)[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, null];
const END_HINT: Record<string, string> = { wrong: '틀렸어요!', timeout: '시간 초과!' };

interface Key {
  el: HTMLElement;
  digit: number | null;
}

function createFlashGame(ctx: GameContext): GameInstance {
  const area = document.createElement('div');
  area.className = 'flash-area';
  const board = document.createElement('div');
  board.className = 'flash-board';
  const digits = document.createElement('p');
  digits.className = 'flash-digits';
  digits.setAttribute('aria-live', 'off');
  const slots = document.createElement('div');
  slots.className = 'flash-slots';
  slots.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('p');
  hint.className = 'flash-hint';
  board.append(digits, slots, hint);
  const keypad = document.createElement('div');
  keypad.className = 'flash-keypad is-disabled';
  keypad.setAttribute('role', 'group');
  keypad.setAttribute('aria-label', '숫자 키패드');
  const keys: Key[] = KEY_LAYOUT.map((digit) => {
    const el = document.createElement('div');
    if (digit === null) {
      el.className = 'flash-key is-blank';
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.className = 'flash-key';
      el.setAttribute('role', 'button');
      el.textContent = String(digit);
    }
    keypad.appendChild(el);
    return { el, digit };
  });
  area.append(board, keypad);
  ctx.root.appendChild(area);

  const results: FlashResult[] = [];
  let phase: Phase = 'ready';
  let level = 1;
  let sequence: number[] = [];
  let index = 0;
  let inputAt: number | null = null;
  let limit = 0;
  let lastMs: number | undefined;
  let waitTimer = 0;
  let timeoutTimer = 0;
  let pauseTimer = 0;
  let frame = 0;
  let finished: GameResult | null = null;

  const publish = () => exposeTest('flash', { phase, sequence: phase === 'show' || phase === 'input' ? [...sequence] : null });

  const setPhase = (next: Phase) => {
    phase = next;
    area.dataset.phase = next;
    keypad.classList.toggle('is-disabled', next !== 'input');
    publish();
  };

  const updateStatus = () => {
    const last = lastMs === undefined ? '' : ` · 직전 ${Math.round(lastMs)}ms`;
    ctx.setStatus(`레벨 ${level} · ${digitCount(level)}자리${last}`);
  };

  const clearTimers = () => {
    window.clearTimeout(waitTimer);
    window.clearTimeout(timeoutTimer);
    window.clearTimeout(pauseTimer);
    window.cancelAnimationFrame(frame);
  };

  const clearKeyMarks = () => {
    for (const k of keys) k.el.classList.remove('is-correct', 'is-wrong');
  };

  const renderSlots = (count: number) => {
    slots.replaceChildren();
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('span');
      dot.className = 'flash-slot';
      slots.appendChild(dot);
    }
  };

  const fillSlot = (i: number) => {
    slots.children[i]?.classList.add('is-filled');
  };

  const finish = (result: FlashResult) => {
    if (phase === 'over' || phase === 'ready') return;
    clearTimers();
    results.push(result);
    digits.textContent = sequence.join('');
    digits.classList.add('is-answer');
    hint.textContent = END_HINT[result.kind] ?? '';
    inputAt = null;
    setPhase('over');
    finished = { gameId: 'flash', ...summarizeFlash(results) };
    ctx.onFinish(finished);
  };

  const show = (exposure: number) => {
    let shownAt: number | null = null;
    const step = (ts: number) => {
      if (phase !== 'show') return;
      if (shownAt === null) {
        shownAt = ts;
        digits.textContent = sequence.join('');
      }
      if (ts - shownAt >= exposure) {
        digits.textContent = '';
        inputAt = ts;
        hint.textContent = '순서대로 누르세요';
        setPhase('input');
        timeoutTimer = window.setTimeout(() => {
          if (phase === 'input') finish({ kind: 'timeout' });
        }, limit + TIMEOUT_GRACE_MS);
        return;
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
  };

  const startLevel = () => {
    clearKeyMarks();
    digits.textContent = '';
    digits.classList.remove('is-answer');
    hint.textContent = '';
    index = 0;
    inputAt = null;
    sequence = [];
    const n = digitCount(level);
    limit = answerLimitMs(n);
    renderSlots(n);
    setPhase('waiting');
    updateStatus();
    waitTimer = window.setTimeout(() => {
      sequence = makeSequence(n, Math.random);
      setPhase('show');
      show(exposureMs(level));
    }, WAIT_MS);
  };

  const keyAt = (x: number, y: number): Key | null => {
    for (const k of keys) {
      if (k.digit === null) continue;
      const r = k.el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return k;
    }
    return null;
  };

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    instance.measure({ t: event.timeStamp, x: event.clientX, y: event.clientY });
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && phase !== 'ready' && phase !== 'over') finish({ kind: 'timeout' });
  };

  const instance: GameInstance = {
    start() {
      clearTimers();
      level = 1;
      sequence = [];
      index = 0;
      inputAt = null;
      lastMs = undefined;
      results.length = 0;
      finished = null;
      clearKeyMarks();
      digits.textContent = '';
      digits.classList.remove('is-answer');
      slots.replaceChildren();
      setPhase('ready');
      hint.textContent = '화면을 탭하면 시작합니다';
      ctx.setStatus('잠깐 보인 숫자를 순서대로 누르세요');
      area.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('visibilitychange', onVisibility);
    },
    measure(input: InputSample) {
      if (phase === 'ready') {
        startLevel();
        return;
      }
      if (phase !== 'input' || inputAt === null) return;
      const key = keyAt(input.x, input.y);
      if (key === null || key.digit === null) return;
      const w = tapWindow(inputAt, input.t, limit);
      if (w === 'ignore') return;
      if (w === 'timeout') {
        finish({ kind: 'timeout' });
        return;
      }
      const j = judgeDigit(sequence, index, key.digit);
      clearKeyMarks();
      if (j === 'wrong') {
        key.el.classList.add('is-wrong');
        finish({ kind: 'wrong' });
        return;
      }
      key.el.classList.add('is-correct');
      fillSlot(index);
      index += 1;
      if (j === 'correct') return;
      window.clearTimeout(timeoutTimer);
      const ms = input.t - inputAt;
      results.push({ kind: 'clear', ms });
      lastMs = ms;
      inputAt = null;
      hint.textContent = '성공!';
      setPhase('feedback');
      level += 1;
      pauseTimer = window.setTimeout(startLevel, CLEAR_PAUSE_MS);
    },
    result() {
      return finished;
    },
    dispose() {
      clearTimers();
      area.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibility);
      clearTest();
      area.remove();
    },
  };
  return instance;
}

export const flashGame: GameModule = {
  id: 'flash',
  title: '순간 기억',
  description: '잠깐 보인 숫자들을 기억해 순서대로 누르세요. 레벨마다 길어지고 짧게 보입니다.',
  labels: { avgLabel: '평균 입력', bestLabel: '최고 입력', roundsWord: '레벨', roundsUnit: 'L', roundsLabel: '레벨 성공' },
  create: createFlashGame,
};
