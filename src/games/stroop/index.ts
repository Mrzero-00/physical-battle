// 색-단어 간섭 게임 모듈 (글자 뜻이 아닌 글자 색 고르기)
import { clearTest, exposeTest } from '../test-hook';
import type { GameContext, GameInstance, GameModule, GameResult, InputSample } from '../types';
import './style.css';
import {
  buttonOrder,
  colorOf,
  judgeStroop,
  limitMs,
  makeTrial,
  summarizeStroop,
  type ColorId,
  type StroopJudgement,
  type StroopTrial,
} from './scoring';

type Phase = 'ready' | 'blank' | 'shown' | 'over';

const TIMEOUT_GRACE_MS = 30;
const BLANK_MS = 300;
const END_HINT: Record<string, string> = { wrong: '틀렸어요!', timeout: '시간 초과!' };

function createStroopGame(ctx: GameContext): GameInstance {
  const area = document.createElement('div');
  area.className = 'stroop-area';
  const field = document.createElement('div');
  field.className = 'stroop-field';
  const word = document.createElement('div');
  word.className = 'stroop-word';
  word.setAttribute('aria-live', 'off');
  const hint = document.createElement('p');
  hint.className = 'stroop-hint';
  field.append(word, hint);
  const buttons = document.createElement('div');
  buttons.className = 'stroop-buttons';
  buttons.setAttribute('role', 'group');
  buttons.setAttribute('aria-label', '색 보기');
  area.append(field, buttons);
  ctx.root.appendChild(area);

  const results: StroopJudgement[] = [];
  let phase: Phase = 'ready';
  let round = 1;
  let trial: StroopTrial | null = null;
  let shownAt: number | null = null;
  let lastMs: number | undefined;
  let blankTimer = 0;
  let timeoutTimer = 0;
  let frame = 0;
  let finished: GameResult | null = null;

  const publish = () => {
    exposeTest('stroop', { phase, ink: phase === 'shown' && trial ? trial.ink : null });
  };

  const setPhase = (next: Phase) => {
    phase = next;
    area.dataset.phase = next;
    publish();
  };

  const updateStatus = () => {
    const last = lastMs === undefined ? '' : ` · 직전 ${Math.round(lastMs)}ms`;
    ctx.setStatus(`라운드 ${round} · 제한 ${limitMs(round)}ms${last}`);
  };

  const clearTimers = () => {
    window.clearTimeout(blankTimer);
    window.clearTimeout(timeoutTimer);
    window.cancelAnimationFrame(frame);
  };

  const clearWord = () => {
    word.textContent = '';
    word.style.color = '';
  };

  const renderButtons = (order: ColorId[]) => {
    buttons.replaceChildren();
    for (const id of order) {
      const item = document.createElement('div');
      item.className = 'stroop-button';
      item.setAttribute('role', 'button');
      item.dataset.color = id;
      item.textContent = colorOf(id).name;
      buttons.appendChild(item);
    }
  };

  const finish = (judgement: StroopJudgement) => {
    if (phase === 'over') return;
    clearTimers();
    results.push(judgement);
    clearWord();
    shownAt = null;
    trial = null;
    hint.textContent = END_HINT[judgement.kind] ?? '';
    setPhase('over');
    finished = { gameId: 'stroop', ...summarizeStroop(results) };
    ctx.onFinish(finished);
  };

  const show = () => {
    const next = makeTrial(round, Math.random);
    renderButtons(buttonOrder(round, Math.random));
    frame = window.requestAnimationFrame((ts) => {
      if (phase !== 'blank') return;
      trial = next;
      word.textContent = colorOf(next.word).name;
      word.style.color = colorOf(next.ink).hex;
      shownAt = ts;
      setPhase('shown');
      timeoutTimer = window.setTimeout(() => {
        if (phase === 'shown') finish({ kind: 'timeout' });
      }, limitMs(round) + TIMEOUT_GRACE_MS);
    });
  };

  const scheduleRound = () => {
    clearWord();
    trial = null;
    shownAt = null;
    hint.textContent = '';
    setPhase('blank');
    updateStatus();
    blankTimer = window.setTimeout(show, BLANK_MS);
  };

  const pickedColor = (x: number, y: number): ColorId | null => {
    for (const el of buttons.children) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return (el as HTMLElement).dataset.color as ColorId;
    }
    return null;
  };

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    instance.measure({ t: event.timeStamp, x: event.clientX, y: event.clientY });
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && (phase === 'blank' || phase === 'shown')) finish({ kind: 'timeout' });
  };

  const instance: GameInstance = {
    start() {
      clearTimers();
      round = 1;
      trial = null;
      shownAt = null;
      lastMs = undefined;
      results.length = 0;
      finished = null;
      clearWord();
      renderButtons(buttonOrder(1, Math.random));
      setPhase('ready');
      hint.textContent = '화면을 탭하면 시작합니다';
      ctx.setStatus('글자 뜻이 아니라 글자 색을 고르세요');
      area.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('visibilitychange', onVisibility);
    },
    measure(input: InputSample) {
      if (phase === 'ready') {
        scheduleRound();
        return;
      }
      if (phase !== 'shown' || trial === null) return;
      const j = judgeStroop(trial, shownAt, input.t, limitMs(round), pickedColor(input.x, input.y));
      if (j.kind === 'ignore') return;
      if (j.kind !== 'hit') {
        finish(j);
        return;
      }
      window.clearTimeout(timeoutTimer);
      results.push(j);
      lastMs = j.ms;
      round += 1;
      scheduleRound();
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

export const stroopGame: GameModule = {
  id: 'stroop',
  title: '색-단어 간섭',
  description: '글자의 뜻이 아니라 글자에 칠해진 색을 골라 누르세요.',
  labels: { avgLabel: '평균 판단', bestLabel: '최고 판단' },
  create: createStroopGame,
};
