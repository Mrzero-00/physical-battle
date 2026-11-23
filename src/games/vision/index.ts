// 동체시력 게임 모듈 (날아가는 공의 숫자 읽기)
import { createStage, type StageTone } from '../reaction/stage';
import type { GameContext, GameInstance, GameModule, GameResult, InputSample } from '../types';
import {
  ANSWER_LIMIT_MS,
  answerFor,
  ballSizeFor,
  digitsFor,
  exposureFor,
  fontSizeFor,
  judge,
  makeChoices,
  pathFor,
  pickDelay,
  pointAt,
  summarizeRun,
  type Path,
  type VisionJudgement,
} from './scoring';

type Phase = 'ready' | 'waiting' | 'flight' | 'choose' | 'feedback' | 'over';

const TIMEOUT_GRACE_MS = 30;
const CORRECT_PAUSE_MS = 350;
const END_HINT: Record<string, string> = { wrong: '틀렸어요!', timeout: '시간 초과!' };

function createVisionGame(ctx: GameContext): GameInstance {
  const area = document.createElement('div');
  area.className = 'vision-area';
  const field = document.createElement('div');
  field.className = 'vision-field';
  const ball = document.createElement('div');
  ball.className = 'vision-ball';
  ball.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('p');
  hint.className = 'reaction-hint vision-hint';
  const choicesBox = document.createElement('div');
  choicesBox.className = 'vision-choices';
  choicesBox.setAttribute('role', 'group');
  choicesBox.setAttribute('aria-label', '보기');
  field.append(ball, hint);
  area.append(field, choicesBox);
  ctx.root.appendChild(area);

  const stage = createStage(field);
  const results: VisionJudgement[] = [];
  let phase: Phase = 'ready';
  let round = 1;
  let answer = 0;
  let prevAnswer: number | null = null;
  let choices: number[] = [];
  let choiceShownAt: number | null = null;
  let lastMs: number | undefined;
  let delayTimer = 0;
  let timeoutTimer = 0;
  let pauseTimer = 0;
  let frame = 0;
  let finished: GameResult | null = null;

  const setPhase = (next: Phase) => {
    phase = next;
    area.dataset.phase = next;
    const tone: StageTone = next === 'flight' || next === 'choose' || next === 'feedback' ? 'shown' : next === 'over' ? 'over' : next === 'ready' ? 'ready' : 'waiting';
    stage.setTone(tone);
  };

  const updateStatus = () => {
    const last = lastMs === undefined ? '' : ` · 직전 ${Math.round(lastMs)}ms`;
    ctx.setStatus(`라운드 ${round} · 노출 ${exposureFor(round)}ms${last}`);
  };

  const clearTimers = () => {
    window.clearTimeout(delayTimer);
    window.clearTimeout(timeoutTimer);
    window.clearTimeout(pauseTimer);
    window.cancelAnimationFrame(frame);
  };

  const hideBall = () => {
    ball.classList.remove('visible');
    ball.textContent = '';
  };

  const finish = (judgement: VisionJudgement) => {
    if (phase === 'over') return;
    clearTimers();
    results.push(judgement);
    hideBall();
    for (const el of choicesBox.children) {
      const value = Number((el as HTMLElement).dataset.value);
      if (value === answer) el.classList.add('is-answer');
    }
    hint.textContent = END_HINT[judgement.kind] ?? '';
    setPhase('over');
    finished = { gameId: 'vision', ...summarizeRun(results) };
    ctx.onFinish(finished);
  };

  const showChoices = (ts: number) => {
    choicesBox.replaceChildren();
    for (const value of choices) {
      const item = document.createElement('div');
      item.className = 'vision-choice';
      item.setAttribute('role', 'button');
      item.dataset.value = String(value);
      item.textContent = String(value);
      choicesBox.appendChild(item);
    }
    choiceShownAt = ts;
    setPhase('choose');
    timeoutTimer = window.setTimeout(() => {
      if (phase === 'choose') finish({ kind: 'timeout' });
    }, ANSWER_LIMIT_MS + TIMEOUT_GRACE_MS);
  };

  const fly = (path: Path, exposure: number) => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (phase !== 'flight') return;
      if (start === null) {
        start = ts;
        ball.textContent = String(answer);
        ball.classList.add('visible');
      }
      const elapsed = ts - start;
      if (elapsed >= exposure) {
        hideBall();
        showChoices(ts);
        return;
      }
      const p = pointAt(path, elapsed, exposure);
      ball.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      frame = window.requestAnimationFrame(step);
    };
    ball.style.transform = `translate3d(${path.from.x}px, ${path.from.y}px, 0)`;
    frame = window.requestAnimationFrame(step);
  };

  const startRound = () => {
    choicesBox.replaceChildren();
    choiceShownAt = null;
    hint.textContent = '';
    setPhase('waiting');
    updateStatus();
    delayTimer = window.setTimeout(() => {
      prevAnswer = answer || null;
      answer = answerFor(round, Math.random, prevAnswer);
      choices = makeChoices(answer, digitsFor(round), Math.random);
      const size = ballSizeFor(round);
      ball.style.width = `${size}px`;
      ball.style.height = `${size}px`;
      ball.style.fontSize = `${fontSizeFor(round)}px`;
      const path = pathFor(round, Math.random, { width: field.clientWidth, height: field.clientHeight }, size);
      setPhase('flight');
      fly(path, exposureFor(round));
    }, pickDelay(Math.random));
  };

  const pickedValue = (x: number, y: number): number | null => {
    for (const el of choicesBox.children) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return Number((el as HTMLElement).dataset.value);
    }
    return null;
  };

  const onResize = () => stage.resize();
  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    instance.measure({ t: event.timeStamp, x: event.clientX, y: event.clientY });
  };

  const instance: GameInstance = {
    start() {
      clearTimers();
      round = 1;
      answer = 0;
      lastMs = undefined;
      results.length = 0;
      finished = null;
      hideBall();
      choicesBox.replaceChildren();
      setPhase('ready');
      hint.textContent = '화면을 탭하면 시작합니다';
      ctx.setStatus('공에 적힌 숫자를 기억하세요');
      area.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('resize', onResize);
    },
    measure(input: InputSample) {
      if (phase === 'ready') {
        startRound();
        return;
      }
      if (phase !== 'choose' || choiceShownAt === null) return;
      const choice = pickedValue(input.x, input.y);
      const j = judge(choice, answer, input.t - choiceShownAt, ANSWER_LIMIT_MS);
      if (j.kind === 'ignore') return;
      if (j.kind !== 'correct') {
        if (j.kind === 'wrong') {
          for (const el of choicesBox.children) if (Number((el as HTMLElement).dataset.value) === choice) el.classList.add('is-wrong');
        }
        finish(j);
        return;
      }
      window.clearTimeout(timeoutTimer);
      results.push(j);
      lastMs = j.ms;
      for (const el of choicesBox.children) if (Number((el as HTMLElement).dataset.value) === choice) el.classList.add('is-correct');
      setPhase('feedback');
      round += 1;
      pauseTimer = window.setTimeout(startRound, CORRECT_PAUSE_MS);
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

export const visionGame: GameModule = {
  id: 'vision',
  title: '동체시력',
  description: '날아가는 공에 적힌 숫자를 읽어 맞히세요. 라운드마다 더 빠르고 작아집니다.',
  create: createVisionGame,
};
