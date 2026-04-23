/**
 * Font scale utility.
 * Changing the root font-size scales all rem-based Tailwind utilities
 * (text-sm, text-base, text-lg, padding, etc.) proportionally.
 */

export const FONT_SCALES = [
  { key: 'normal', label: 'A',    px: 15 },
  { key: 'large',  label: 'A+',   px: 17 },
  { key: 'xlarge', label: 'A++',  px: 19 },
  { key: 'xxlarge',label: 'A+++', px: 21 },
];

const STORAGE_KEY = 'certpath_font_scale';
const DEFAULT_SCALE = 'large'; // ships at A+ (17px) — comfortable reading size

export function getSavedScale() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_SCALE;
}

export function applyScale(key) {
  const scale = FONT_SCALES.find((s) => s.key === key) || FONT_SCALES[1];
  document.documentElement.style.fontSize = `${scale.px}px`;
  localStorage.setItem(STORAGE_KEY, key);
}

export function initFontScale() {
  applyScale(getSavedScale());
}
