// 닉네임 정하기 대화상자 (웹 전체 랭킹 참여용)
import { NICKNAME_MAX, NICKNAME_MIN, validateNickname, type NicknameError } from '../core/ranking';
import type { KeyValueStorage } from '../platform';
import { NICKNAME_KEY } from '../platform/web';
import { el } from './dom';

const ERROR_TEXT: Record<NicknameError, string> = {
  'too-short': `${NICKNAME_MIN}자 이상 입력해 주세요`,
  'too-long': `${NICKNAME_MAX}자까지 쓸 수 있어요`,
  'invalid-char': '한글·영문·숫자·공백·_·-만 쓸 수 있어요',
  blocked: '쓸 수 없는 닉네임이에요',
};

export function openNicknameDialog(host: HTMLElement, storage: KeyValueStorage, onSaved: (nickname: string) => void): void {
  host.querySelector('.sheet-backdrop')?.remove();
  const backdrop = el('div', 'sheet-backdrop');
  const sheet = el('form', 'coin-sheet nickname-sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'nickname-title');
  const title = el('h2', 'sheet-title', '닉네임 정하기');
  title.id = 'nickname-title';
  const note = el('p', 'sheet-note', `전체 랭킹에 보일 이름이에요 (${NICKNAME_MIN}~${NICKNAME_MAX}자)`);
  const input = el('input', 'nickname-input');
  input.type = 'text';
  input.name = 'nickname';
  input.maxLength = 24;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', '닉네임');
  input.value = storage.get(NICKNAME_KEY) ?? '';
  const error = el('p', 'nickname-error');
  error.setAttribute('aria-live', 'assertive');
  const save = el('button', 'btn primary', '저장');
  save.type = 'submit';
  const cancel = el('button', 'btn', '취소');
  cancel.type = 'button';

  const dismiss = () => backdrop.remove();
  sheet.addEventListener('submit', (event) => {
    event.preventDefault();
    const checked = validateNickname(input.value);
    if (!checked.ok) {
      error.textContent = ERROR_TEXT[checked.error];
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    storage.set(NICKNAME_KEY, checked.value);
    dismiss();
    onSaved(checked.value);
  });
  cancel.addEventListener('click', dismiss);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) dismiss();
  });

  const actions = el('div', 'sheet-actions');
  actions.append(save, cancel);
  sheet.append(title, note, input, error, actions);
  backdrop.appendChild(sheet);
  host.appendChild(backdrop);
  input.focus();
}
