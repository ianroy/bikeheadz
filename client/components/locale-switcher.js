// P6-002 — Locale switcher.
//
// Native <select> styled with the workshop palette so it matches the
// nav-bar chrome. Bind by mounting the returned `el` somewhere (header,
// floating chip, account settings — caller's choice).

import { el } from '../dom.js';
import { availableLocales, getLocale, setLocale } from '../i18n/index.js';

const LABELS = {
  en: 'English',
  es: 'Español',
};

export function LocaleSwitcher() {
  const select = el('select', {
    'aria-label': 'Language',
    class: 'rounded-lg border px-2 py-1 text-sm transition-colors',
    style: {
      background: '#FFFFFF',
      borderColor: 'var(--paper-edge, #E5DFD3)',
      color: 'var(--ink, #1A1614)',
      fontWeight: 500,
    },
    onChange: (e) => setLocale(e.target.value),
  });

  for (const code of availableLocales) {
    const opt = el('option', { value: code }, LABELS[code] || code);
    if (code === getLocale()) opt.selected = true;
    select.appendChild(opt);
  }

  // Stay in sync when other components flip the locale.
  if (typeof window !== 'undefined') {
    window.addEventListener('bh:localechange', (ev) => {
      const next = ev?.detail?.locale ?? getLocale();
      if (select.value !== next) select.value = next;
    });
  }

  const wrap = el('label', {
    class: 'inline-flex items-center gap-1.5 text-sm',
    style: { color: 'var(--ink-muted, #6B6157)' },
  },
    select,
  );

  return { el: wrap };
}
