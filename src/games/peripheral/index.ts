// 주변시야 게임 모듈 (가운데 글자와 가장자리 점 방향 맞히기)
import { clearTest, exposeTest } from '../test-hook';
import type { GameContext, GameInstance, GameModule, GameResult, InputSample } from '../types';
import {
  ANSWER_LIMIT_MS,
  DIRECTIONS,
  DOT_SIZE,
  fixationDelay,
  flashMs,
  flashPosition,
  judgeAnswer,
  letterChoices,
  pickDirection,
  pickLetter,
  radiusRatio,
  summarizePeripheral,
  type Letter,
  type PeripheralResult,
} from './scoring';
import './style.css';

type Phase = 'ready' | 'fixation' | 'flash' | 'mask' | 'direction' | 'letter' | 'feedback' | 'over';

const MASK_MS = 150;
const TIMEOUT_GRACE_MS = 30;
const CORRECT_PAUSE_MS = 400;
const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
const GRID_CELLS: Array<[number, number]> = [
  [1, 2],
  [1, 3],
  [2, 3],
  [3, 3],
  [3, 2],
  [3, 1],
  [2, 1],
  [1, 1],
];
const DIR_NAMES = ['위', '오른쪽 위', '오른쪽', '오른쪽 아래', '아래', '왼쪽 아래', '왼쪽', '왼쪽 위'];
const END_HINT: Record<string, string> = { wrong: '틀렸어요!', timeout: '시간 초과!' };

function createPeripheralGame(ctx: GameContext): GameInstance {
  const area = document.createElement('div');
  area.className = 'peripheral-area';
  const field = document.createElement('div');
  field.className = 'peripheral-field';
  const center = document.createElement('div');
  center.className = 'peripheral-center';
  center.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('div');
  dot.className = 'peripheral-dot';
  dot.setAttribute('aria-hidden', 'true');
  const masks = document.createElement('div');
  masks.className = 'peripheral-masks';
  masks.setAttribute('aria-hidden', 'true');
  const dirsBox = document.createElement('div');
  dirsBox.className = 'peripheral-dirs';
  dirsBox.setAttribute('role', 'group');
  dirsBox.setAttribute('aria-label', '점의 방향');
  const hint = document.createElement('p');
  hint.className = 'peripheral-hint';
  const lettersBox = document.createElement('div');
  lettersBox.className = 'peripheral-letters';
  lettersBox.setAttribute('role', 'group');
  lettersBox.setAttribute('aria-label', '가운데 글자');
  field.append(center, dot, masks, dirsBox, hint);
  area.append(field, lettersBox);
  ctx.root.appendChild(area);

  const dirButtons: HTMLElement[] = [];
  for (let d = 0; d < DIRECTIONS; d++) {
    const btn = document.createElement('div');
    btn.className = 'peripheral-dir';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', DIR_NAMES[d]);
    btn.textContent = ARROWS[d];
    btn.style.gridRow = String(GRID_CELLS[d][0]);
    btn.style.gridColumn = String(GRID_CELLS[d][1]);
    dirButtons.push(btn);
  }
  dirsBox.append(...dirButtons);

  const results: PeripheralResult[] = [];
  let phase: Phase = 'ready';
  let level = 1;
  let dir = -1;
  let letter: Letter | null = null;
  let prevLetter: Letter | null = null;
  let options: Letter[] = [];
  let letterButtons: HTMLElement[] = [];
  let answerAt: number | null = null;
  let lastMs: number | undefined;
  let delayTimer = 0;
  let timeoutTimer = 0;
  let pauseTimer = 0;
  let frame = 0;
  let finished: GameResult | null = null;
  let listening = false;

  const syncHook = () => {
    exposeTest('peripheral', { phase, dir: dir < 0 ? null : dir, letter });
  };

  const setPhase = (next: Phase) => {
    phase = next;
    area.dataset.phase = next;
    syncHook();
  };

  const updateStatus = () => {
    const last = lastMs === undefined ? '' : ` · 직전 ${Math.round(lastMs)}ms`;
    ctx.setStatus(`레벨 ${level} · 노출 ${flashMs(level)}ms${last}`);
  };

  const clearTimers = () => {
    window.clearTimeout(delayTimer);
    window.clearTimeout(timeoutTimer);
    window.clearTimeout(pauseTimer);
    window.cancelAnimationFrame(frame);
  };

  const hideStimulus = () => {
    center.textContent = '';
    center.classList.remove('is-fixation', 'is-letter');
    dot.classList.remove('visible');
    dot.style.transform = '';
  };

  const clearMasks = () => masks.replaceChildren();

  const resetAnswerUi = () => {
    dirsBox.classList.remove('visible');
    for (const b of dirButtons) b.classList.remove('is-correct', 'is-wrong');
    lettersBox.replaceChildren();
    lettersBox.classList.remove('visible');
    letterButtons = [];
    options = [];
  };

  const finish = (result: PeripheralResult) => {
    if (phase === 'over' || phase === 'ready') return;
    clearTimers();
    results.push(result);
    hideStimulus();
    clearMasks();
    dirsBox.classList.remove('visible');
    hint.textContent = END_HINT[result.kind] ?? '';
    setPhase('over');
    finished = { gameId: 'peripheral', ...summarizePeripheral(results) };
    ctx.onFinish(finished);
  };

  const viewport = () => ({ width: field.clientWidth, height: field.clientHeight });

  const showMasks = () => {
    const vp = viewport();
    const ratio = radiusRatio(level);
    const nodes: HTMLElement[] = [];
    const mid = document.createElement('div');
    mid.className = 'peripheral-mask peripheral-mask-center';
    nodes.push(mid);
    for (let d = 0; d < DIRECTIONS; d++) {
      const m = document.createElement('div');
      m.className = 'peripheral-mask';
      const p = flashPosition(d, ratio, vp, DOT_SIZE);
      m.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      nodes.push(m);
    }
    masks.replaceChildren(...nodes);
  };

  const showDirections = (ts: number) => {
    clearMasks();
    answerAt = ts;
    dirsBox.classList.add('visible');
    setPhase('direction');
    timeoutTimer = window.setTimeout(() => {
      if (phase === 'direction' || phase === 'letter') finish({ kind: 'timeout' });
    }, ANSWER_LIMIT_MS + TIMEOUT_GRACE_MS);
  };

  const showLetters = () => {
    if (letter === null) return;
    options = letterChoices(letter, Math.random);
    letterButtons = options.map((l) => {
      const btn = document.createElement('div');
      btn.className = 'peripheral-letter';
      btn.setAttribute('role', 'button');
      btn.textContent = l;
      return btn;
    });
    lettersBox.replaceChildren(...letterButtons);
    lettersBox.classList.add('visible');
    setPhase('letter');
  };

  const runFlash = () => {
    const duration = flashMs(level);
    const pos = flashPosition(dir, radiusRatio(level), viewport(), DOT_SIZE);
    let shownAt: number | null = null;
    let hiddenAt: number | null = null;
    const step = (ts: number) => {
      if (phase !== 'flash' && phase !== 'mask') return;
      if (shownAt === null) {
        shownAt = ts;
        center.classList.remove('is-fixation');
        center.classList.add('is-letter');
        center.textContent = letter ?? '';
        dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        dot.classList.add('visible');
      } else if (hiddenAt === null) {
        if (ts - shownAt >= duration) {
          hiddenAt = ts;
          hideStimulus();
          showMasks();
          setPhase('mask');
        }
      } else if (ts - hiddenAt >= MASK_MS) {
        showDirections(ts);
        return;
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
  };

  const startRound = () => {
    resetAnswerUi();
    clearMasks();
    hideStimulus();
    answerAt = null;
    hint.textContent = '';
    dir = -1;
    letter = null;
    center.textContent = '+';
    center.classList.add('is-fixation');
    setPhase('fixation');
    updateStatus();
    delayTimer = window.setTimeout(() => {
      dir = pickDirection(Math.random);
      letter = pickLetter(Math.random, prevLetter);
      prevLetter = letter;
      setPhase('flash');
      runFlash();
    }, fixationDelay(Math.random));
  };

  const hitIndex = (buttons: readonly HTMLElement[], x: number, y: number): number | null => {
    for (let i = 0; i < buttons.length; i++) {
      const r = buttons[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  };

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    instance.measure({ t: event.timeStamp, x: event.clientX, y: event.clientY });
  };

  const onVisibility = () => {
    if (document.visibilityState !== 'hidden') return;
    if (phase === 'ready' || phase === 'over') return;
    finish({ kind: 'timeout' });
  };

  const instance: GameInstance = {
    start() {
      clearTimers();
      level = 1;
      dir = -1;
      letter = null;
      prevLetter = null;
      lastMs = undefined;
      answerAt = null;
      results.length = 0;
      finished = null;
      hideStimulus();
      clearMasks();
      resetAnswerUi();
      setPhase('ready');
      hint.textContent = '화면을 탭하면 시작합니다';
      ctx.setStatus('가운데 글자와 점의 방향을 기억하세요');
      if (!listening) {
        area.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('visibilitychange', onVisibility);
        listening = true;
      }
    },
    measure(input: InputSample) {
      if (phase === 'ready') {
        startRound();
        return;
      }
      if (answerAt === null) return;
      const elapsed = input.t - answerAt;
      if (phase === 'direction') {
        const picked = hitIndex(dirButtons, input.x, input.y);
        const j = judgeAnswer(picked, dir, elapsed);
        if (j.kind === 'ignore') return;
        if (j.kind !== 'correct') {
          if (j.kind === 'wrong' && picked !== null) dirButtons[picked].classList.add('is-wrong');
          finish(j);
          return;
        }
        if (picked !== null) dirButtons[picked].classList.add('is-correct');
        showLetters();
        return;
      }
      if (phase === 'letter' && letter !== null) {
        const index = hitIndex(letterButtons, input.x, input.y);
        const picked = index === null ? null : options[index];
        const j = judgeAnswer<Letter>(picked, letter, elapsed);
        if (j.kind === 'ignore') return;
        if (j.kind !== 'correct') {
          if (j.kind === 'wrong' && index !== null) letterButtons[index].classList.add('is-wrong');
          finish(j);
          return;
        }
        window.clearTimeout(timeoutTimer);
        results.push(j);
        lastMs = j.ms;
        if (index !== null) letterButtons[index].classList.add('is-correct');
        setPhase('feedback');
        level += 1;
        pauseTimer = window.setTimeout(startRound, CORRECT_PAUSE_MS);
      }
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

export const peripheralGame: GameModule = {
  id: 'peripheral',
  title: '주변시야',
  description: '가운데 글자와 가장자리에 잠깐 뜬 점의 방향을 맞히세요. 레벨마다 더 짧고 멀어집니다.',
  labels: {
    avgLabel: '평균 응답',
    bestLabel: '최고 응답',
    roundsWord: '레벨',
    roundsUnit: 'L',
    roundsLabel: '레벨 성공',
  },
  create: createPeripheralGame,
};
