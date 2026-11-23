// 반응속도 버튼 모양(스킨) 목록·저장·SVG 마크업
import type { KeyValueStorage } from '../platform/types';

export type SkinId = 'default' | 'mosquito' | 'butterfly' | 'cockroach';

export const SKINS: ReadonlyArray<{ id: SkinId; name: string }> = [
  { id: 'default', name: '기본 버튼' },
  { id: 'mosquito', name: '모기' },
  { id: 'butterfly', name: '나비' },
  { id: 'cockroach', name: '바퀴벌레' },
];

export const SKIN_KEY = 'pb:skin';

export function parseSkin(raw: string | null): SkinId {
  return SKINS.some((s) => s.id === raw) ? (raw as SkinId) : 'default';
}

export function loadSkin(storage: KeyValueStorage): SkinId {
  return parseSkin(storage.get(SKIN_KEY));
}

export function saveSkin(storage: KeyValueStorage, id: SkinId): void {
  storage.set(SKIN_KEY, parseSkin(id));
}

const open = (id: SkinId) => `<svg class="skin skin-${id}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">`;

const MARKUP: Record<SkinId, string> = {
  default: `${open('default')}</svg>`,
  mosquito:
    `${open('mosquito')}` +
    `<g stroke="#2b2f36" stroke-width="2.2" stroke-linecap="round" fill="none">` +
    `<path d="M44 52 L28 66 L22 80"/><path d="M47 56 L38 74 L36 86"/><path d="M56 52 L72 66 L78 80"/><path d="M53 56 L62 74 L64 86"/>` +
    `<path d="M45 47 L30 40 L24 30"/><path d="M55 47 L70 40 L76 30"/><path d="M50 30 L50 14"/></g>` +
    `<ellipse class="skin-part skin-buzz-l" cx="38" cy="40" rx="14" ry="6" fill="#9fb4c7" fill-opacity="0.75" transform="rotate(-25 38 40)"/>` +
    `<ellipse class="skin-part skin-buzz-r" cx="62" cy="40" rx="14" ry="6" fill="#9fb4c7" fill-opacity="0.75" transform="rotate(25 62 40)"/>` +
    `<ellipse cx="50" cy="56" rx="6" ry="17" fill="#3b3f46"/><circle cx="50" cy="35" r="6" fill="#2b2f36"/>` +
    `<path d="M47 63 H53 M46.5 68 H53.5" stroke="#9aa0a8" stroke-width="1.6"/></svg>`,
  butterfly:
    `${open('butterfly')}` +
    `<g class="skin-part skin-flap-l"><path d="M48 48 C30 18 8 22 12 42 C14 54 32 54 48 52 Z" fill="#ff8a3d"/>` +
    `<path d="M48 54 C32 58 18 70 26 80 C34 88 44 72 48 60 Z" fill="#ffb347"/>` +
    `<circle cx="24" cy="38" r="5" fill="#2b2f36"/></g>` +
    `<g class="skin-part skin-flap-r"><path d="M52 48 C70 18 92 22 88 42 C86 54 68 54 52 52 Z" fill="#ff8a3d"/>` +
    `<path d="M52 54 C68 58 82 70 74 80 C66 88 56 72 52 60 Z" fill="#ffb347"/>` +
    `<circle cx="76" cy="38" r="5" fill="#2b2f36"/></g>` +
    `<ellipse cx="50" cy="54" rx="3.5" ry="18" fill="#2b2f36"/>` +
    `<path d="M49 37 C46 28 42 24 38 22 M51 37 C54 28 58 24 62 22" stroke="#2b2f36" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  cockroach:
    `${open('cockroach')}` +
    `<g class="skin-part skin-legs-a" stroke="#3a2412" stroke-width="2.6" stroke-linecap="round" fill="none">` +
    `<path d="M40 46 L24 38"/><path d="M60 58 L78 62"/><path d="M41 70 L26 82"/></g>` +
    `<g class="skin-part skin-legs-b" stroke="#3a2412" stroke-width="2.6" stroke-linecap="round" fill="none">` +
    `<path d="M60 46 L76 38"/><path d="M40 58 L22 62"/><path d="M59 70 L74 82"/></g>` +
    `<ellipse cx="50" cy="60" rx="14" ry="22" fill="#7a4a24"/><path d="M50 40 V82" stroke="#4e2e15" stroke-width="1.6"/>` +
    `<ellipse cx="50" cy="38" rx="10" ry="7" fill="#5a3418"/>` +
    `<g class="skin-part skin-antenna-l"><path d="M46 33 C40 22 32 16 22 12" stroke="#3a2412" stroke-width="2" fill="none" stroke-linecap="round"/></g>` +
    `<g class="skin-part skin-antenna-r"><path d="M54 33 C60 22 68 16 78 12" stroke="#3a2412" stroke-width="2" fill="none" stroke-linecap="round"/></g></svg>`,
};

export function skinMarkup(id: SkinId): string {
  return MARKUP[parseSkin(id)];
}
