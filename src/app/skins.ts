// 버튼 모양 선택 화면
import { loadSkin, saveSkin, skinMarkup, SKINS } from '../core/skins';
import type { KeyValueStorage } from '../platform';
import { el } from './dom';

export interface SkinPickerOptions {
  topBar: HTMLElement;
  storage: KeyValueStorage;
}

export function renderSkinPicker(root: HTMLElement, options: SkinPickerOptions): void {
  const screen = el('main', 'screen page skins');
  const body = el('div', 'page-body');
  body.appendChild(el('p', 'section-empty', '모양만 바뀌고 누르는 영역과 난이도는 똑같아요'));
  const grid = el('div', 'skin-grid');
  const buttons: HTMLButtonElement[] = [];

  const sync = () => {
    const current = loadSkin(options.storage);
    for (const b of buttons) {
      const selected = b.dataset.skin === current;
      b.setAttribute('aria-pressed', String(selected));
      b.classList.toggle('selected', selected);
    }
  };

  for (const skin of SKINS) {
    const option = el('button', 'skin-option');
    option.type = 'button';
    option.dataset.skin = skin.id;
    const preview = el('span', 'skin-preview reaction-target visible');
    preview.dataset.skin = skin.id;
    preview.innerHTML = skinMarkup(skin.id);
    option.append(preview, el('span', 'skin-name', skin.name), el('span', 'skin-check', '✓'));
    option.addEventListener('click', () => {
      saveSkin(options.storage, skin.id);
      sync();
    });
    buttons.push(option);
    grid.appendChild(option);
  }
  sync();

  body.appendChild(grid);
  screen.append(options.topBar, body);
  root.replaceChildren(screen);
}
