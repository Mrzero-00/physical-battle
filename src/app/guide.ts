// 게임 시작 전 가이드 화면·시트
import type { GameGuide } from '../games/guides';
import { el } from './dom';

let guideCount = 0;

function buildGuide(guide: GameGuide, onStart: () => void): { root: HTMLElement; start: HTMLButtonElement } {
  const root = el('section', 'guide');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  const body = el('div', 'guide-body');
  const title = el('h2', 'guide-title', guide.title);
  title.id = `guide-title-${++guideCount}`;
  root.setAttribute('aria-labelledby', title.id);
  const art = el('div', 'guide-art');
  art.innerHTML = guide.svg;
  const steps = el('ol', 'guide-steps');
  for (const step of guide.steps) steps.appendChild(el('li', '', step));
  body.append(
    title,
    art,
    el('h3', 'guide-heading', '하는 법'),
    steps,
    el('h3', 'guide-heading', '게임 오버'),
    el('p', 'guide-over', guide.gameOver),
    el('h3', 'guide-heading', '기록 기준'),
    el('p', 'guide-record', guide.record),
  );
  const start = el('button', 'btn primary guide-start', '시작하기');
  start.type = 'button';
  const footer = el('div', 'guide-footer');
  footer.appendChild(start);
  root.append(body, footer);
  start.addEventListener('click', onStart);
  return { root, start };
}

export type GuideCloseReason = 'start' | 'escape';

export function openGuide(host: HTMLElement, guide: GameGuide, onClose: (reason: GuideCloseReason) => void): () => void {
  let closed = false;
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close('escape');
  };
  const teardown = () => {
    document.removeEventListener('keydown', onKey);
    built.root.remove();
  };
  const close = (reason: GuideCloseReason) => {
    if (closed) return;
    closed = true;
    teardown();
    onClose(reason);
  };
  const built = buildGuide(guide, () => close('start'));
  built.root.classList.add('guide-sheet');
  host.appendChild(built.root);
  document.addEventListener('keydown', onKey);
  built.start.focus({ preventScroll: true });
  return () => {
    if (closed) return;
    closed = true;
    teardown();
  };
}

export function renderGuideScreen(
  root: HTMLElement,
  topBar: HTMLElement,
  guide: GameGuide,
  onClose: (reason: GuideCloseReason) => void,
): () => void {
  const screen = el('main', 'screen page guide-screen');
  const slot = el('div', 'guide-host');
  screen.append(topBar, slot);
  root.replaceChildren(screen);
  return openGuide(slot, guide, onClose);
}
