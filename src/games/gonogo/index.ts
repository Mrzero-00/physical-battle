// 선택 반응 게임 모듈 (초록이면 누르고 빨강이면 참기)
import { clearTest, exposeTest } from '../test-hook';
import { BUTTON_SIZE, EDGE_MARGIN, isHit, randomPositionAwayFrom, type Point } from '../reaction/scoring';
import type { GameContext, GameInstance, GameModule, GameResult, InputSample } from '../types';
import './style.css';
import {
  judgeGoNoGo,
  limitMs,
  noGoHoldMs,
  pickDelay,
  pickKind,
  summarizeGoNoGo,
  type GoNoGoJudgement,
  type SignalKind,
} from './scoring';

type Phase = 'ready' | 'waiting' | 'shown' | 'over';

const TIMEOUT_GRACE_MS = 30;
const MIN_CENTER_GAP = 108;
const END_HINT: Record<string, string> = { 'no-go-tap': '빨강을 눌렀어요!', timeout: '시간 초과!' };

function createGoNoGoGame(ctx: GameContext): GameInstance {
  const area = document.createElement('div');
  area.className = 'gonogo-area';
  const signal = document.createElement('div');
  signal.className = 'gonogo-signal';
  signal.setAttribute('aria-hidden', 'true');
  signal.style.width = `${BUTTON_SIZE}px`;
  signal.style.height = `${BUTTON_SIZE}px`;
  const hint = document.createElement('p');
  hint.className = 'gonogo-hint';
  area.append(signal, hint);
  ctx.root.appendChild(area);

  const results: GoNoGoJudgement[] = [];
  let phase: Phase = 'ready';
  let round = 1;
  let kind: SignalKind = 'go';
  let redStreak = 0;
  let shownAt: number | null = null;
  let lastPos: Point | null = null;
  let lastMs: number | undefined;
  let delayTimer = 0;
  let timeoutTimer = 0;
  let frame = 0;
  let finished: GameResult | null = null;

  const publish = () => {
    const r = phase === 'shown' ? signal.getBoundingClientRect() : null;
    exposeTest('gonogo', {
      phase,
      kind: phase === 'shown' ? kind : null,
      rect: r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null,
    });
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
    window.clearTimeout(delayTimer);
    window.clearTimeout(timeoutTimer);
    window.cancelAnimationFrame(frame);
  };

  const hideSignal = () => {
    signal.classList.remove('visible', 'is-go', 'is-nogo');
    signal.textContent = '';
  };

  const finish = (judgement: GoNoGoJudgement) => {
    if (phase === 'over') return;
    clearTimers();
    results.push(judgement);
    if (judgement.kind !== 'no-go-tap') hideSignal();
    shownAt = null;
    hint.textContent = END_HINT[judgement.kind] ?? '';
    setPhase('over');
    finished = { gameId: 'gonogo', ...summarizeGoNoGo(results) };
    ctx.onFinish(finished);
  };

  const succeed = (judgement: GoNoGoJudgement) => {
    window.clearTimeout(timeoutTimer);
    results.push(judgement);
    if (judgement.kind === 'hit') lastMs = judgement.ms;
    redStreak = kind === 'nogo' ? redStreak + 1 : 0;
    hideSignal();
    round += 1;
    scheduleRound();
  };

  const showSignal = () => {
    kind = pickKind(round, Math.random, redStreak);
    const insets = ctx.safeInsets;
    const pos = randomPositionAwayFrom(
      Math.random,
      { width: area.clientWidth, height: area.clientHeight },
      BUTTON_SIZE,
      { top: EDGE_MARGIN, right: EDGE_MARGIN + insets.right, bottom: EDGE_MARGIN + insets.bottom, left: EDGE_MARGIN + insets.left },
      lastPos,
      MIN_CENTER_GAP,
    );
    lastPos = pos;
    signal.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    frame = window.requestAnimationFrame((ts) => {
      if (phase !== 'waiting') return;
      signal.classList.add('visible', kind === 'go' ? 'is-go' : 'is-nogo');
      signal.textContent = kind === 'go' ? '' : '✕';
      shownAt = ts;
      setPhase('shown');
      if (kind === 'go') {
        timeoutTimer = window.setTimeout(() => {
          if (phase === 'shown') finish({ kind: 'timeout' });
        }, limitMs(round) + TIMEOUT_GRACE_MS);
      } else {
        timeoutTimer = window.setTimeout(() => {
          if (phase === 'shown') succeed({ kind: 'hold' });
        }, noGoHoldMs(round));
      }
    });
  };

  const scheduleRound = () => {
    shownAt = null;
    hint.textContent = '';
    setPhase('waiting');
    updateStatus();
    delayTimer = window.setTimeout(showSignal, pickDelay(Math.random));
  };

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    instance.measure({ t: event.timeStamp, x: event.clientX, y: event.clientY });
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && (phase === 'waiting' || phase === 'shown')) finish({ kind: 'timeout' });
  };

  const instance: GameInstance = {
    start() {
      clearTimers();
      round = 1;
      kind = 'go';
      redStreak = 0;
      shownAt = null;
      lastPos = null;
      lastMs = undefined;
      results.length = 0;
      finished = null;
      hideSignal();
      setPhase('ready');
      hint.textContent = '화면을 탭하면 시작합니다';
      ctx.setStatus('초록이면 누르고 빨강이면 참으세요');
      area.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('visibilitychange', onVisibility);
    },
    measure(input: InputSample) {
      if (phase === 'ready') {
        scheduleRound();
        return;
      }
      if (phase !== 'shown') return;
      const r = signal.getBoundingClientRect();
      const hit = isHit({ x: input.x, y: input.y }, { x: r.left, y: r.top, width: r.width, height: r.height });
      const j = judgeGoNoGo(kind, shownAt, input.t, limitMs(round), hit);
      if (j.kind === 'ignore') return;
      if (j.kind === 'hit') succeed(j);
      else finish(j);
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

export const goNoGoGame: GameModule = {
  id: 'gonogo',
  title: '선택 반응',
  description: '초록 원이면 빠르게 누르고, 빨간 사각형이면 참으세요.',
  create: createGoNoGoGame,
};
