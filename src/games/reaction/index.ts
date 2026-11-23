// 반응속도 테스트 게임 모듈 (무작위 위치 버튼, 끝없는 라운드)
import type { GameContext, GameInstance, GameModule, GameResult, InputSample } from '../types';
import {
  BUTTON_SIZE,
  EDGE_MARGIN,
  type Judgement,
  isHit,
  judgeTap,
  pickDelay,
  randomPosition,
  summarizeRun,
  timeLimitFor,
} from './scoring';
import { createStage, type StageTone } from './stage';

type Phase = 'ready' | 'waiting' | 'shown' | 'over';

const TIMEOUT_GRACE_MS = 30;

const END_HINT: Record<string, string> = {
  timeout: '시간 초과!',
  miss: '빗나갔어요!',
  'false-start': '너무 빨랐어요!',
};

function createReactionGame(ctx: GameContext): GameInstance {
  const area = document.createElement('div');
  area.className = 'reaction-area';
  const button = document.createElement('div');
  button.className = 'reaction-target';
  button.setAttribute('role', 'button');
  button.setAttribute('aria-label', '지금 누르세요');
  button.style.width = `${BUTTON_SIZE}px`;
  button.style.height = `${BUTTON_SIZE}px`;
  const hint = document.createElement('p');
  hint.className = 'reaction-hint';
  area.append(button, hint);
  ctx.root.appendChild(area);

  const stage = createStage(area);
  const results: Judgement[] = [];
  let phase: Phase = 'ready';
  let round = 1;
  let shownAt: number | null = null;
  let delayTimer = 0;
  let timeoutTimer = 0;
  let frame = 0;
  let finished: GameResult | null = null;

  const setPhase = (next: Phase) => {
    phase = next;
    stage.setTone(next as StageTone);
    area.dataset.phase = next;
  };

  const updateStatus = (last?: number) => {
    const lastText = last === undefined ? '' : ` · 직전 ${Math.round(last)}ms`;
    ctx.setStatus(`라운드 ${round} · 제한 ${timeLimitFor(round)}ms${lastText}`);
  };

  const clearTimers = () => {
    window.clearTimeout(delayTimer);
    window.clearTimeout(timeoutTimer);
    window.cancelAnimationFrame(frame);
  };

  const finish = (judgement: Judgement) => {
    if (phase === 'over') return;
    clearTimers();
    results.push(judgement);
    button.classList.remove('visible');
    hint.textContent = END_HINT[judgement.kind] ?? '';
    setPhase('over');
    const summary = summarizeRun(results);
    finished = { gameId: 'reaction', ...summary };
    ctx.onFinish(finished);
  };

  const showButton = () => {
    const insets = ctx.safeInsets;
    const pos = randomPosition(
      Math.random,
      { width: area.clientWidth, height: area.clientHeight },
      BUTTON_SIZE,
      {
        top: EDGE_MARGIN,
        right: EDGE_MARGIN + insets.right,
        bottom: EDGE_MARGIN + insets.bottom,
        left: EDGE_MARGIN + insets.left,
      },
    );
    button.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    frame = window.requestAnimationFrame((ts) => {
      if (phase !== 'waiting') return;
      button.classList.add('visible');
      shownAt = ts;
      setPhase('shown');
      timeoutTimer = window.setTimeout(() => {
        if (phase === 'shown') finish({ kind: 'timeout' });
      }, timeLimitFor(round) + TIMEOUT_GRACE_MS);
    });
  };

  const scheduleRound = () => {
    shownAt = null;
    setPhase('waiting');
    hint.textContent = '';
    delayTimer = window.setTimeout(showButton, pickDelay(Math.random));
  };

  const onResize = () => stage.resize();

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    instance.measure({ t: event.timeStamp, x: event.clientX, y: event.clientY });
  };

  const instance: GameInstance = {
    start() {
      round = 1;
      results.length = 0;
      finished = null;
      setPhase('ready');
      hint.textContent = '화면을 탭하면 시작합니다';
      ctx.setStatus('버튼이 나타나면 최대한 빨리 누르세요');
      area.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('resize', onResize);
    },
    measure(input: InputSample) {
      if (phase === 'over') return;
      if (phase === 'ready') {
        updateStatus();
        scheduleRound();
        return;
      }
      const rect = button.getBoundingClientRect();
      const hit =
        phase === 'shown' &&
        isHit({ x: input.x, y: input.y }, { x: rect.left, y: rect.top, width: rect.width, height: rect.height });
      const judgement = judgeTap(phase === 'shown' ? shownAt : null, input.t, timeLimitFor(round), hit);
      if (judgement.kind !== 'hit') {
        finish(judgement);
        return;
      }
      window.clearTimeout(timeoutTimer);
      results.push(judgement);
      button.classList.remove('visible');
      round += 1;
      updateStatus(judgement.ms);
      scheduleRound();
    },
    result() {
      return finished;
    },
    dispose() {
      clearTimers();
      area.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onResize);
      stage.dispose();
      area.remove();
    },
  };

  return instance;
}

export const reactionGame: GameModule = {
  id: 'reaction',
  title: '반응속도',
  description: '갑자기 나타나는 버튼을 제한 시간 안에 누르세요. 라운드마다 더 빨라집니다.',
  create: createReactionGame,
};
