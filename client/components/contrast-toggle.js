// P6-011 — High-contrast (WCAG AAA) toggle.
//
// Flips `<html data-contrast="aaa">` on/off and persists to
// localStorage.vh_contrast. The actual color override lives in
// theme.css under `:root[data-contrast="aaa"]`.

import { el } from '../dom.js';

const STORAGE_KEY = 'vh_contrast';
const ATTR = 'contrast';
const VALUE = 'aaa';

// Hydrate at module load so the page renders with the right palette
// before any component mounts.
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === VALUE) {
    document.documentElement.dataset[ATTR] = VALUE;
  }
} catch { /* localStorage may be unavailable */ }

function isOn() {
  return document.documentElement.dataset[ATTR] === VALUE;
}

function setOn(on) {
  if (on) {
    document.documentElement.dataset[ATTR] = VALUE;
    try { localStorage.setItem(STORAGE_KEY, VALUE); } catch { /* ignore */ }
  } else {
    delete document.documentElement.dataset[ATTR];
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

export function ContrastToggle() {
  const button = el('button', {
    type: 'button',
    'aria-label': 'Toggle high-contrast mode',
    'aria-pressed': isOn() ? 'true' : 'false',
    class: 'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm transition-colors',
    style: {
      background: 'var(--paper-soft, #F5F1E8)',
      borderColor: 'var(--paper-edge, #E5DFD3)',
      color: 'var(--ink, #1A1614)',
      fontWeight: 500,
    },
    onClick: () => {
      const next = !isOn();
      setOn(next);
      button.setAttribute('aria-pressed', next ? 'true' : 'false');
      label.textContent = next ? 'AAA on' : 'AAA off';
    },
  });

  // Tiny contrast glyph (filled half-disc).
  const glyph = el('span', {
    'aria-hidden': 'true',
    style: {
      display: 'inline-block',
      width: '0.75rem',
      height: '0.75rem',
      borderRadius: '9999px',
      background: 'linear-gradient(90deg, var(--ink, #1A1614) 50%, var(--paper, #FAF7F2) 50%)',
      border: '1px solid var(--ink, #1A1614)',
    },
  });
  const label = el('span', {}, isOn() ? 'AAA on' : 'AAA off');

  button.appendChild(glyph);
  button.appendChild(label);

  return { el: button };
}
