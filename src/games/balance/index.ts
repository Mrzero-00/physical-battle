// 균형 게임 모듈 (기울기·드래그로 공 굴리기, Canvas2D)
import './style.css';
import { clearTest, exposeTest } from '../test-hook';
import type { GameContext, GameInstance, GameModule, GameResult } from '../types';
import { createPhysics, loadRapier, type PhysicsWorld } from './physics';
import {
  BALL_RADIUS_PX,
  LEVEL_LIMIT_MS,
  autopilotGravity,
  dragToGravity,
  halfWidthPx,
  isOnPath,
  makeObstacles,
  makePath,
  reachedGoal,
  summarizeRun,
  tiltToGravity,
  viewScale,
  type BalanceSummary,
  type Circle,
  type Gravity,
  type Orientation,
  type Point,
} from './scoring';

type Phase = 'ready' | 'loading' | 'failed' | 'play' | 'feedback' | 'over';
type Mode = 'detecting' | 'tilt' | 'drag';
type Rapier = Awaited<ReturnType<typeof loadRapier>>;
type PermissionCtor = { requestPermission?: () => Promise<'granted' | 'denied' | 'default'> };

const DETECT_MS = 1000;
const FEEDBACK_MS = 600;
const END_HINT: Record<string, string> = { 'off-path': '길을 벗어났어요!', timeout: '시간 초과!' };
const MODE_LABEL: Record<Mode, string> = { detecting: '입력 확인 중', tilt: '기울기', drag: '드래그' };
const COLORS = {
  bg: '#10131a',
  path: '#202633',
  center: '#2f3747',
  goal: '#3ddc84',
  start: '#8b93a7',
  obstacle: '#ff9f43',
  ball: '#f7f7f2',
  fail: '#ff5d6c',
};

function screenAngle(): number {
  const angle = window.screen?.orientation?.angle;
  if (typeof angle === 'number') return angle;
  const legacy = (window as Window & { orientation?: number }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

function createBalanceGame(ctx: GameContext): GameInstance {
  const area = document.createElement('div');
  area.className = 'balance-area';
  const canvas = document.createElement('canvas');
  canvas.className = 'balance-canvas';
  canvas.setAttribute('aria-label', '균형 게임 화면');
  const hint = document.createElement('p');
  hint.className = 'balance-hint';
  const tiltButton = document.createElement('button');
  tiltButton.type = 'button';
  tiltButton.className = 'balance-tilt-btn';
  tiltButton.textContent = '기울기 사용';
  area.append(canvas, hint);
  ctx.root.appendChild(area);
  const g = canvas.getContext('2d');

  const permissionCtor = (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : undefined) as unknown as PermissionCtor | undefined;
  const needsPermission = typeof permissionCtor?.requestPermission === 'function';

  let phase: Phase = 'ready';
  let mode: Mode = 'detecting';
  let level = 1;
  let rapier: Rapier | null = null;
  let physics: PhysicsWorld | null = null;
  let path: Point[] = [];
  let obstacles: Circle[] = [];
  let hw = 0;
  let ballPos: Point | null = null;
  let viewport = { width: 0, height: 0 };
  let dpr = 1;
  let levelStart = 0;
  let lastTs = 0;
  let frame = 0;
  let detectTimer = 0;
  let feedbackTimer = 0;
  let autopilot = false;
  let orientation: Orientation = { beta: null, gamma: null };
  let base: Orientation = { beta: 0, gamma: 0 };
  let drag: { id: number; x0: number; y0: number; x: number; y: number } | null = null;
  let listening = false;
  let orientationListening = false;
  let runToken = 0;
  const levelMs: number[] = [];
  let finished: GameResult | null = null;

  const syncHook = () => {
    exposeTest('balance', {
      phase,
      level,
      autopilot(on: boolean) {
        autopilot = Boolean(on);
      },
    });
  };

  const setPhase = (next: Phase) => {
    phase = next;
    area.dataset.phase = next;
    syncHook();
  };

  const updateStatus = () => {
    if (phase === 'play' || phase === 'feedback') {
      const left = phase === 'play' && levelStart > 0 ? Math.max(0, Math.ceil((LEVEL_LIMIT_MS - (lastTs - levelStart)) / 1000)) : 60;
      ctx.setStatus(`레벨 ${level} · ${MODE_LABEL[mode]} · ${left}초`);
    } else {
      ctx.setStatus(`폰을 기울여 공을 골까지 굴리세요 · ${MODE_LABEL[mode]}`);
    }
  };

  const setMode = (next: Mode) => {
    if (mode === next) return;
    mode = next;
    if (next === 'tilt') base = { ...orientation };
    updateStatus();
  };

  const onOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta === null) return;
    orientation = { beta: event.beta, gamma: event.gamma };
    if (mode === 'detecting') {
      window.clearTimeout(detectTimer);
      setMode('tilt');
    }
  };

  const listenOrientation = () => {
    if (orientationListening) return;
    orientationListening = true;
    window.addEventListener('deviceorientation', onOrientation);
    window.clearTimeout(detectTimer);
    detectTimer = window.setTimeout(() => {
      if (mode === 'detecting') setMode('drag');
    }, DETECT_MS);
  };

  const stopOrientation = () => {
    orientationListening = false;
    window.removeEventListener('deviceorientation', onOrientation);
    window.clearTimeout(detectTimer);
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    viewport = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(viewport.width * dpr);
    canvas.height = Math.round(viewport.height * dpr);
    draw();
  };

  const draw = () => {
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = COLORS.bg;
    g.fillRect(0, 0, viewport.width, viewport.height);
    if (path.length < 2) return;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = COLORS.path;
    g.lineWidth = hw * 2;
    g.beginPath();
    path.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    g.stroke();
    g.strokeStyle = COLORS.center;
    g.lineWidth = 2;
    g.setLineDash([6, 8]);
    g.stroke();
    g.setLineDash([]);
    const start = path[0];
    const goal = path[path.length - 1];
    g.fillStyle = COLORS.start;
    g.beginPath();
    g.arc(start.x, start.y, 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = COLORS.goal;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(goal.x, goal.y, hw, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = COLORS.obstacle;
    for (const o of obstacles) {
      g.beginPath();
      g.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      g.fill();
    }
    if (ballPos) {
      g.fillStyle = phase === 'over' ? COLORS.fail : COLORS.ball;
      g.beginPath();
      g.arc(ballPos.x, ballPos.y, BALL_RADIUS_PX, 0, Math.PI * 2);
      g.fill();
    }
  };

  const clearTimers = () => {
    window.clearTimeout(feedbackTimer);
    window.cancelAnimationFrame(frame);
  };

  const disposePhysics = () => {
    physics?.dispose();
    physics = null;
  };

  const finish = (endReason: BalanceSummary['endReason']) => {
    if (phase === 'over') return;
    clearTimers();
    drag = null;
    hint.textContent = END_HINT[endReason] ?? '';
    setPhase('over');
    draw();
    disposePhysics();
    finished = { gameId: 'balance', ...summarizeRun(levelMs, endReason) };
    ctx.onFinish(finished);
  };

  const inputGravity = (ball: { x: number; y: number; vx: number; vy: number }): Gravity => {
    if (autopilot) return autopilotGravity(ball, path, hw);
    if (mode === 'tilt') return tiltToGravity(orientation.beta, orientation.gamma, base, screenAngle());
    if (mode === 'drag' && drag) return dragToGravity(drag.x - drag.x0, drag.y - drag.y0);
    return { x: 0, y: 0 };
  };

  const loop = (ts: number) => {
    if (phase !== 'play' || !physics) return;
    if (levelStart === 0) {
      levelStart = ts;
      lastTs = ts;
    }
    const before = physics.ball();
    physics.step(ts - lastTs, inputGravity(before));
    lastTs = ts;
    const now = physics.ball();
    ballPos = { x: now.x, y: now.y };
    const elapsed = ts - levelStart;
    if (reachedGoal(ballPos, path, hw)) {
      levelMs.push(Math.max(elapsed, 0));
      disposePhysics();
      setPhase('feedback');
      hint.textContent = `${(elapsed / 1000).toFixed(2)}초`;
      draw();
      level += 1;
      feedbackTimer = window.setTimeout(startLevel, FEEDBACK_MS);
      return;
    }
    if (!isOnPath(ballPos, path, hw)) {
      finish('off-path');
      return;
    }
    if (elapsed > LEVEL_LIMIT_MS) {
      finish('timeout');
      return;
    }
    updateStatus();
    draw();
    frame = window.requestAnimationFrame(loop);
  };

  const startLevel = () => {
    if (!rapier) return;
    clearTimers();
    disposePhysics();
    resize();
    hw = halfWidthPx(level, viewScale(viewport));
    path = makePath(level, viewport, Math.random);
    obstacles = makeObstacles(level, path, hw, Math.random);
    ballPos = { ...path[0] };
    physics = createPhysics(rapier, path[0], obstacles);
    base = { ...orientation };
    drag = null;
    levelStart = 0;
    hint.textContent = '';
    setPhase('play');
    updateStatus();
    draw();
    frame = window.requestAnimationFrame(loop);
  };

  const begin = () => {
    tiltButton.remove();
    if (!needsPermission) listenOrientation();
    setPhase('loading');
    hint.textContent = '물리 엔진 불러오는 중…';
    updateStatus();
    const token = ++runToken;
    loadRapier().then(
      (r) => {
        if (token !== runToken || phase !== 'loading') return;
        rapier = r;
        startLevel();
      },
      () => {
        if (token !== runToken || phase !== 'loading') return;
        setPhase('failed');
        hint.textContent = '불러오지 못했어요 · 다시 시도';
      },
    );
  };

  const onTiltButton = () => {
    if (phase !== 'ready' || !permissionCtor?.requestPermission) return;
    permissionCtor.requestPermission().then(
      (state) => {
        if (phase !== 'ready') return;
        if (state === 'granted') {
          mode = 'detecting';
          listenOrientation();
        } else {
          setMode('drag');
        }
        begin();
      },
      () => {
        if (phase !== 'ready') return;
        setMode('drag');
        begin();
      },
    );
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.target instanceof Node && tiltButton.contains(event.target)) return;
    event.preventDefault();
    if (phase === 'play' && mode === 'drag') {
      drag = { id: event.pointerId, x0: event.clientX, y0: event.clientY, x: event.clientX, y: event.clientY };
      return;
    }
    instance.measure({ t: event.timeStamp, x: event.clientX, y: event.clientY });
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (drag && event.pointerId === drag.id) drag = null;
  };
  const onResize = () => resize();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && phase !== 'ready' && phase !== 'over' && phase !== 'failed') finish('timeout');
  };

  const addListeners = () => {
    if (listening) return;
    listening = true;
    area.addEventListener('pointerdown', onPointerDown);
    area.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    tiltButton.addEventListener('click', onTiltButton);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
  };
  const removeListeners = () => {
    listening = false;
    area.removeEventListener('pointerdown', onPointerDown);
    area.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    tiltButton.removeEventListener('click', onTiltButton);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
  };

  const instance: GameInstance = {
    start() {
      clearTimers();
      disposePhysics();
      runToken++;
      level = 1;
      levelMs.length = 0;
      finished = null;
      path = [];
      obstacles = [];
      ballPos = null;
      drag = null;
      autopilot = false;
      if (!orientationListening) mode = needsPermission ? 'drag' : 'detecting';
      setPhase('ready');
      hint.textContent = '화면을 탭하면 시작합니다';
      if (needsPermission && !orientationListening) area.appendChild(tiltButton);
      addListeners();
      if (!needsPermission) listenOrientation();
      updateStatus();
      resize();
    },
    measure() {
      if (phase === 'ready' || phase === 'failed') begin();
    },
    result() {
      return finished;
    },
    dispose() {
      clearTimers();
      runToken++;
      disposePhysics();
      stopOrientation();
      removeListeners();
      clearTest();
      area.remove();
    },
  };
  return instance;
}

export const balanceGame: GameModule = {
  id: 'balance',
  title: '균형',
  description: '폰을 기울여 공이 길을 벗어나지 않게 골까지 굴리세요.',
  labels: { roundsWord: '레벨', roundsUnit: 'L', roundsLabel: '레벨 성공', avgLabel: '평균 클리어', bestLabel: '최고 클리어' },
  create: createBalanceGame,
};
