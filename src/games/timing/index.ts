// 타이밍 예측 게임 모듈 (공이 선을 지나는 순간 탭)
import { clearTest, exposeTest } from '../test-hook';
import type { GameContext, GameInstance, GameModule, GameResult, InputSample } from '../types';
import {
  LINE_RATIO,
  TIMEOUT_GRACE_MS,
  ballX,
  isOccluded,
  judgeTiming,
  occlusion,
  progressAt,
  summarizeTiming,
  toleranceMs,
  travelMs,
  type TimingJudgement,
} from './scoring';
import './style.css';

type Phase = 'ready' | 'waiting' | 'moving' | 'feedback' | 'over';

const BALL_SIZE = 40;
const EDGE_PAD = 8;
const WAIT_MS = 700;
const FEEDBACK_MS = 800;
const END_HINT: Record<string, string> = { 'off-timing': '타이밍이 어긋났어요!', timeout: '시간 초과!' };

function createTimingGame(ctx: GameContext): GameInstance {
  const area = document.createElement('div');
  area.className = 'timing-area';
  const track = document.createElement('div');
  track.className = 'timing-track';
  const rail = document.createElement('div');
  rail.className = 'timing-rail';
  const line = document.createElement('div');
  line.className = 'timing-line';
  const cover = document.createElement('div');
  cover.className = 'timing-cover';
  const ball = document.createElement('div');
  ball.className = 'timing-ball';
  ball.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('p');
  hint.className = 'timing-hint';
  const feedback = document.createElement('p');
  feedback.className = 'timing-feedback';
  track.append(rail, line, ball, cover);
  area.append(track, feedback, hint);
  ctx.root.appendChild(area);

  const results: TimingJudgement[] = [];
  let phase: Phase = 'ready';
  let round = 1;
  let startAt: number | null = null;
  let crossAt: number | null = null;
  let tol = toleranceMs(1);
  let occ = 0;
  let travel = 0;
  let startX = 0;
  let lineX = 0;
  let maxX = 0;
  let lastErr: number | undefined;
  let waitTimer = 0;
  let timeoutTimer = 0;
  let pauseTimer = 0;
  let frame = 0;
  let finished: GameResult | null = null;

  const publish = () => exposeTest('timing', { phase, crossAt });

  const setPhase = (next: Phase) => {
    phase = next;
    area.dataset.phase = next;
    publish();
  };

  const updateStatus = () => {
    const last = lastErr === undefined ? '' : ` · 직전 ${Math.round(Math.abs(lastErr))}ms`;
    ctx.setStatus(`라운드 ${round} · 허용 ±${toleranceMs(round)}ms${last}`);
  };

  const clearTimers = () => {
    window.clearTimeout(waitTimer);
    window.clearTimeout(timeoutTimer);
    window.clearTimeout(pauseTimer);
    window.cancelAnimationFrame(frame);
  };

  const placeBall = (x: number) => {
    ball.style.transform = `translate3d(${Math.round(x - BALL_SIZE / 2)}px, 0, 0)`;
  };

  const measureTrack = () => {
    const width = track.clientWidth;
    startX = BALL_SIZE / 2 + EDGE_PAD;
    lineX = width * LINE_RATIO;
    maxX = Math.max(startX, width - BALL_SIZE / 2 - EDGE_PAD);
    line.style.left = `${Math.round(lineX)}px`;
  };

  const layoutCover = () => {
    if (occ <= 0) {
      cover.classList.remove('visible');
      return;
    }
    const from = ballX(1 - occ, startX, lineX) - BALL_SIZE / 2;
    cover.style.left = `${Math.round(from)}px`;
    cover.style.width = `${Math.max(0, Math.round(lineX - from))}px`;
    cover.classList.add('visible');
  };

  const finish = (judgement: TimingJudgement) => {
    if (phase === 'over' || phase === 'ready') return;
    clearTimers();
    results.push(judgement);
    startAt = null;
    crossAt = null;
    ball.classList.remove('hidden');
    hint.textContent = END_HINT[judgement.kind] ?? '';
    feedback.textContent = '';
    setPhase('over');
    finished = { gameId: 'timing', ...summarizeTiming(results) };
    ctx.onFinish(finished);
  };

  const step = (ts: number) => {
    if (phase !== 'moving') return;
    if (startAt === null) {
      startAt = ts;
      crossAt = ts + travel;
      ball.classList.add('visible');
      publish();
      timeoutTimer = window.setTimeout(() => {
        if (phase === 'moving') finish({ kind: 'timeout' });
      }, travel + tol + TIMEOUT_GRACE_MS);
    }
    const p = progressAt(startAt, crossAt as number, ts);
    placeBall(Math.min(maxX, ballX(p, startX, lineX)));
    ball.classList.toggle('hidden', isOccluded(p, occ));
    frame = window.requestAnimationFrame(step);
  };

  const startRound = () => {
    startAt = null;
    crossAt = null;
    tol = toleranceMs(round);
    occ = occlusion(round);
    travel = travelMs(round, Math.random);
    measureTrack();
    layoutCover();
    placeBall(startX);
    ball.classList.remove('visible', 'hidden', 'is-hit');
    hint.textContent = '';
    feedback.textContent = '';
    setPhase('waiting');
    updateStatus();
    waitTimer = window.setTimeout(() => {
      setPhase('moving');
      frame = window.requestAnimationFrame(step);
    }, WAIT_MS);
  };

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    instance.measure({ t: event.timeStamp, x: event.clientX, y: event.clientY });
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && phase !== 'ready' && phase !== 'over') finish({ kind: 'timeout' });
  };

  const onResize = () => {
    if (phase === 'ready' || phase === 'over') return;
    measureTrack();
    layoutCover();
  };

  const instance: GameInstance = {
    start() {
      clearTimers();
      round = 1;
      startAt = null;
      crossAt = null;
      occ = 0;
      lastErr = undefined;
      results.length = 0;
      finished = null;
      ball.classList.remove('visible', 'hidden', 'is-hit');
      cover.classList.remove('visible');
      feedback.textContent = '';
      setPhase('ready');
      hint.textContent = '화면을 탭하면 시작합니다';
      ctx.setStatus('공이 선을 지나는 순간 탭하세요');
      area.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisibility);
    },
    measure(input: InputSample) {
      if (phase === 'ready') {
        startRound();
        return;
      }
      if (phase !== 'moving' || startAt === null || crossAt === null) return;
      const j = judgeTiming(startAt, crossAt, input.t, tol);
      if (j.kind === 'ignore') return;
      if (j.kind !== 'hit') {
        finish(j);
        return;
      }
      window.clearTimeout(timeoutTimer);
      window.cancelAnimationFrame(frame);
      results.push(j);
      lastErr = j.errMs;
      placeBall(Math.min(maxX, ballX(progressAt(startAt, crossAt, input.t), startX, lineX)));
      startAt = null;
      crossAt = null;
      ball.classList.remove('hidden');
      ball.classList.add('is-hit');
      const ms = Math.round(Math.abs(j.errMs));
      feedback.textContent = ms === 0 ? '정확해요!' : `${ms}ms ${j.errMs < 0 ? '빨랐어요' : '늦었어요'}`;
      setPhase('feedback');
      round += 1;
      pauseTimer = window.setTimeout(startRound, FEEDBACK_MS);
    },
    result() {
      return finished;
    },
    dispose() {
      clearTimers();
      area.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      clearTest();
      area.remove();
    },
  };
  return instance;
}

export const timingGame: GameModule = {
  id: 'timing',
  title: '타이밍 예측',
  description: '움직이는 공이 선을 지나는 순간을 예측해 탭하세요. 라운드마다 빨라지고 가려집니다.',
  labels: { avgLabel: '평균 오차', bestLabel: '최소 오차', compareAvg: '평균 오차' },
  create: createTimingGame,
};
