// 다중 물체 추적 게임 모듈 (Canvas2D)
import './style.css';
import { clearTest, exposeTest } from '../test-hook';
import type { GameContext, GameInstance, GameModule, GameResult, InputSample } from '../types';
import {
  ANSWER_LIMIT_MS,
  BALL_RADIUS,
  HIGHLIGHT_MS,
  HIT_RADIUS,
  MIN_PICK_MS,
  ballCount,
  hitBall,
  judgePick,
  pickTargets,
  placeBalls,
  speedPx,
  speedScale,
  stepBalls,
  summarizeRun,
  targetCount,
  trackMs,
  type Ball,
  type Bounds,
  type MotSummary,
} from './scoring';

type Phase = 'ready' | 'show' | 'track' | 'answer' | 'feedback' | 'over';

const TIMEOUT_GRACE_MS = 30;
const FEEDBACK_MS = 700;
const END_HINT: Record<string, string> = { wrong: '틀렸어요!', timeout: '시간 초과!' };
const COLORS = {
  bg: '#10131a',
  ball: '#c9d1e3',
  target: '#3ddc84',
  picked: '#3ddc84',
  wrong: '#ff5d6c',
  ring: '#f2f4f8',
};

function createMotGame(ctx: GameContext): GameInstance {
  const area = document.createElement('div');
  area.className = 'mot-area';
  const canvas = document.createElement('canvas');
  canvas.className = 'mot-canvas';
  canvas.setAttribute('aria-label', '공 추적 화면');
  const hint = document.createElement('p');
  hint.className = 'mot-hint';
  area.append(canvas, hint);
  ctx.root.appendChild(area);
  const g = canvas.getContext('2d');

  let phase: Phase = 'ready';
  let level = 1;
  let balls: Ball[] = [];
  let targets: number[] = [];
  let picked: number[] = [];
  let wrongPick = -1;
  let bounds: Bounds = { width: 0, height: 0 };
  let dpr = 1;
  let phaseStart = 0;
  let lastTs = 0;
  let answerAt: number | null = null;
  let frame = 0;
  let timeoutTimer = 0;
  let feedbackTimer = 0;
  let listening = false;
  const levelMs: number[] = [];
  let finished: GameResult | null = null;

  const syncHook = () => {
    exposeTest('mot', {
      phase,
      targets: [...targets],
      balls: balls.map((b) => ({ x: b.x, y: b.y, r: b.r })),
    });
  };

  const setPhase = (next: Phase) => {
    phase = next;
    area.dataset.phase = next;
    syncHook();
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    bounds = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(bounds.width * dpr);
    canvas.height = Math.round(bounds.height * dpr);
    if (balls.length > 0) balls = stepBalls(balls, 0, bounds);
    draw();
  };

  const draw = () => {
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = COLORS.bg;
    g.fillRect(0, 0, bounds.width, bounds.height);
    const reveal = phase === 'show' || phase === 'feedback' || phase === 'over';
    balls.forEach((b, i) => {
      const isTarget = targets.includes(i);
      let fill = COLORS.ball;
      if (reveal && isTarget) fill = COLORS.target;
      if (phase === 'answer' && picked.includes(i)) fill = COLORS.picked;
      if (i === wrongPick) fill = COLORS.wrong;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.fillStyle = fill;
      g.fill();
      if (reveal && isTarget) {
        g.lineWidth = 3;
        g.strokeStyle = COLORS.ring;
        g.beginPath();
        g.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2);
        g.stroke();
      }
    });
  };

  const clearTimers = () => {
    window.clearTimeout(timeoutTimer);
    window.clearTimeout(feedbackTimer);
    window.cancelAnimationFrame(frame);
  };

  const updateStatus = () => {
    const k = targetCount(level);
    if (phase === 'answer') ctx.setStatus(`레벨 ${level} · ${k}개 중 ${picked.length}개 선택`);
    else ctx.setStatus(`레벨 ${level} · 공 ${ballCount(level)}개 중 ${k}개 추적`);
  };

  const finish = (endReason: MotSummary['endReason']) => {
    if (phase === 'over') return;
    clearTimers();
    hint.textContent = END_HINT[endReason] ?? '';
    setPhase('over');
    draw();
    finished = { gameId: 'mot', ...summarizeRun(levelMs, endReason) };
    ctx.onFinish(finished);
  };

  const loop = (ts: number) => {
    if (phase === 'show') {
      if (phaseStart === 0) phaseStart = ts;
      if (ts - phaseStart >= HIGHLIGHT_MS) {
        setPhase('track');
        phaseStart = ts;
        lastTs = ts;
      }
    } else if (phase === 'track') {
      balls = stepBalls(balls, ts - lastTs, bounds);
      lastTs = ts;
      syncHook();
      if (ts - phaseStart >= trackMs(level)) {
        answerAt = ts;
        setPhase('answer');
        updateStatus();
        draw();
        timeoutTimer = window.setTimeout(() => {
          if (phase === 'answer') finish('timeout');
        }, ANSWER_LIMIT_MS + TIMEOUT_GRACE_MS);
        return;
      }
    } else {
      return;
    }
    draw();
    frame = window.requestAnimationFrame(loop);
  };

  const startLevel = () => {
    clearTimers();
    resize();
    picked = [];
    wrongPick = -1;
    answerAt = null;
    hint.textContent = '';
    const n = ballCount(level);
    balls = placeBalls(n, bounds, BALL_RADIUS, Math.random, speedPx(level, speedScale(bounds)));
    targets = pickTargets(n, targetCount(level), Math.random);
    phaseStart = 0;
    setPhase('show');
    updateStatus();
    draw();
    frame = window.requestAnimationFrame(loop);
  };

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    instance.measure({ t: event.timeStamp, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };
  const onResize = () => resize();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && phase !== 'ready' && phase !== 'over') finish('timeout');
  };

  const addListeners = () => {
    if (listening) return;
    listening = true;
    area.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
  };
  const removeListeners = () => {
    listening = false;
    area.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
  };

  const instance: GameInstance = {
    start() {
      clearTimers();
      level = 1;
      levelMs.length = 0;
      finished = null;
      balls = [];
      targets = [];
      picked = [];
      wrongPick = -1;
      setPhase('ready');
      hint.textContent = '화면을 탭하면 시작합니다';
      ctx.setStatus('표시된 공을 끝까지 따라가 고르세요');
      addListeners();
      resize();
    },
    measure(input: InputSample) {
      if (phase === 'ready') {
        startLevel();
        return;
      }
      if (phase !== 'answer' || answerAt === null) return;
      const elapsed = input.t - answerAt;
      if (!Number.isFinite(elapsed) || elapsed < MIN_PICK_MS) return;
      if (elapsed > ANSWER_LIMIT_MS) {
        finish('timeout');
        return;
      }
      const i = hitBall({ x: input.x, y: input.y }, balls, HIT_RADIUS);
      const j = judgePick(targets, picked, i);
      if (j === 'ignore') return;
      if (j === 'wrong') {
        wrongPick = i;
        finish('wrong');
        return;
      }
      picked.push(i);
      if (j === 'correct') {
        updateStatus();
        draw();
        return;
      }
      window.clearTimeout(timeoutTimer);
      levelMs.push(elapsed);
      setPhase('feedback');
      hint.textContent = `${Math.round(elapsed)}ms`;
      draw();
      level += 1;
      feedbackTimer = window.setTimeout(startLevel, FEEDBACK_MS);
    },
    result() {
      return finished;
    },
    dispose() {
      clearTimers();
      removeListeners();
      clearTest();
      area.remove();
    },
  };
  return instance;
}

export const motGame: GameModule = {
  id: 'mot',
  title: '다중 물체 추적',
  description: '잠깐 표시된 공들을 눈으로 따라가 멈춘 뒤 골라내세요.',
  labels: { roundsWord: '레벨', roundsUnit: 'L', roundsLabel: '레벨 성공', avgLabel: '평균 선택', bestLabel: '최고 선택' },
  create: createMotGame,
};
