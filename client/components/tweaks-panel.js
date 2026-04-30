// Tweaks panel — vanilla port of the prototype's React TweaksPanel.
// Dev/design tool that surfaces live knobs for the radical layer:
// hero variant, halftone density, splatter count, marquee speed,
// jitter amplitude, checker size. Persists to localStorage.
//
// Gated behind ?tweaks=1 OR localStorage['sdz-tweaks-on']=1 so the
// panel doesn't ship to every visitor — it's a workshop instrument,
// not a feature for end users.

import { el } from '../dom.js';
import { HERO_VARIANTS, getHeroVariant, setHeroVariant } from './sdzr-hero.js';

const TWEAKS_KEY = 'sdz-tweaks';
const ENABLE_KEY = 'sdz-tweaks-on';

const DEFAULTS = {
  halftoneDensity: 8,
  splatterCount: 80,
  marqueeSpeed: 30,
  jitter: 1.2,
  checkerSize: 18,
};

export function isTweaksEnabled() {
  try {
    if (new URLSearchParams(location.search).get('tweaks') === '1') {
      localStorage.setItem(ENABLE_KEY, '1');
      return true;
    }
    if (new URLSearchParams(location.search).get('tweaks') === '0') {
      localStorage.removeItem(ENABLE_KEY);
      return false;
    }
    return localStorage.getItem(ENABLE_KEY) === '1';
  } catch { return false; }
}

function loadTweaks() {
  try {
    const raw = localStorage.getItem(TWEAKS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULTS }; }
}

function saveTweaks(t) {
  try { localStorage.setItem(TWEAKS_KEY, JSON.stringify(t)); } catch { /* ignore */ }
}

function applyTweaks(t) {
  const r = document.documentElement;
  r.style.setProperty('--sdzr-halftone-density', t.halftoneDensity + 'px');
  r.style.setProperty('--sdzr-marquee-speed', t.marqueeSpeed + 's');
  r.style.setProperty('--sdzr-jitter-amount', t.jitter + 'px');
  r.style.setProperty('--sdzr-checker-size', t.checkerSize + 'px');
  if (window.SDZRadical?.refreshSplatter) {
    try { window.SDZRadical.refreshSplatter(document, t.splatterCount); } catch { /* ignore */ }
  }
}

// Apply persisted tweaks on first paint regardless of whether the panel
// is mounted — that way refreshing the page keeps your settings.
export function applyPersistedTweaks() {
  applyTweaks(loadTweaks());
  document.body.dataset.hero = getHeroVariant();
}

function row(label, child) {
  return el('label', {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '4px',
      marginBottom: '10px',
      fontSize: '0.78rem',
      fontFamily: 'ui-monospace, monospace',
      color: 'var(--ink)',
    },
  },
    el('span', { style: { letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 } }, label),
    child,
  );
}

function slider(min, max, step, value, onChange, suffix) {
  const out = el('span', {
    style: {
      display: 'inline-block',
      minWidth: '40px',
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--ink-muted)',
    },
  }, String(value) + (suffix || ''));
  const input = el('input', {
    type: 'range',
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
    style: { flex: '1', accentColor: 'var(--brand)' },
    onInput: (e) => {
      const v = Number(e.currentTarget.value);
      out.textContent = String(v) + (suffix || '');
      onChange(v);
    },
  });
  return el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, input, out);
}

function select(value, options, onChange) {
  return el('select', {
    style: {
      width: '100%',
      padding: '6px 8px',
      border: '2px solid var(--ink)',
      background: 'var(--paper)',
      color: 'var(--ink)',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '0.85rem',
      borderRadius: '4px',
    },
    onChange: (e) => onChange(e.currentTarget.value),
  }, ...options.map((o) =>
    el('option', { value: o.value, ...(o.value === value ? { selected: 'selected' } : {}) }, o.label)
  ));
}

export function mountTweaksPanel() {
  if (!isTweaksEnabled()) return;
  applyPersistedTweaks();

  let tweaks = loadTweaks();
  let open = false;

  const fab = el('button', {
    type: 'button',
    'aria-label': 'Open Tweaks panel',
    title: 'Tweaks',
    style: {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '40',
      width: '44px',
      height: '44px',
      borderRadius: '999px',
      background: 'var(--brand)',
      color: '#FFFFFF',
      border: '2px solid var(--ink)',
      boxShadow: '3px 3px 0 var(--ink)',
      cursor: 'pointer',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '1.1rem',
      lineHeight: '1',
      display: 'grid',
      placeItems: 'center',
    },
  }, '⚙');

  const panel = el('div', {
    role: 'dialog',
    'aria-label': 'Tweaks',
    style: {
      position: 'fixed',
      right: '16px',
      bottom: '72px',
      zIndex: '41',
      width: 'min(320px, calc(100vw - 32px))',
      maxHeight: 'calc(100vh - 100px)',
      overflowY: 'auto',
      background: 'var(--paper)',
      color: 'var(--ink)',
      border: '3px solid var(--ink)',
      borderRadius: '12px',
      boxShadow: '8px 8px 0 var(--ink)',
      padding: '14px',
      display: 'none',
    },
  });

  function rebuild() {
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    panel.appendChild(el('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '2px solid var(--ink)',
      },
    },
      el('span', {
        class: 'sdz-display',
        style: { fontSize: '1.1rem', color: 'var(--ink)' },
      }, 'Tweaks'),
      el('span', {
        style: {
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.7rem',
          background: 'var(--accent3)',
          color: '#FFFFFF',
          padding: '2px 6px',
          letterSpacing: '0.1em',
        },
      }, '?TWEAKS=1'),
    ));

    panel.appendChild(el('div', {
      style: { fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' },
    }, 'Hero variant'));

    panel.appendChild(row('Layout', select(getHeroVariant(), [
      { value: 'default', label: 'Default (existing landing)' },
      { value: 'cap',     label: 'Spinning valve cap' },
      { value: 'card',    label: 'Trading card' },
      { value: 'sheet',   label: 'Sticker sheet' },
    ], (v) => {
      setHeroVariant(v);
      // Trigger a router re-render so home.js picks up the new hero.
      try { window.__router?.render?.(location.pathname + location.search); } catch { /* ignore */ }
    })));

    panel.appendChild(el('div', {
      style: { fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '14px 0 6px' },
    }, 'Chaos sliders'));

    panel.appendChild(row('Halftone density', slider(4, 20, 1, tweaks.halftoneDensity, (v) => {
      tweaks.halftoneDensity = v; saveTweaks(tweaks); applyTweaks(tweaks);
    }, 'px')));
    panel.appendChild(row('Splatter count', slider(0, 300, 10, tweaks.splatterCount, (v) => {
      tweaks.splatterCount = v; saveTweaks(tweaks); applyTweaks(tweaks);
    })));
    panel.appendChild(row('Marquee speed', slider(6, 90, 2, tweaks.marqueeSpeed, (v) => {
      tweaks.marqueeSpeed = v; saveTweaks(tweaks); applyTweaks(tweaks);
    }, 's')));
    panel.appendChild(row('Jitter amplitude', slider(0, 4, 0.2, tweaks.jitter, (v) => {
      tweaks.jitter = v; saveTweaks(tweaks); applyTweaks(tweaks);
    }, 'px')));
    panel.appendChild(row('Checker size', slider(8, 36, 2, tweaks.checkerSize, (v) => {
      tweaks.checkerSize = v; saveTweaks(tweaks); applyTweaks(tweaks);
    }, 'px')));

    panel.appendChild(el('div', { style: { borderTop: '2px dashed var(--ink)', marginTop: '14px', paddingTop: '10px' } },
      el('div', { style: { fontSize: '0.72rem', color: 'var(--ink-muted)', lineHeight: '1.4' } },
        'Free-mode pricing is wired to the ',
        el('code', { style: { background: 'var(--paper-soft)', padding: '0 4px' } }, 'payments_enabled'),
        ' admin flag — flip it in ',
        el('a', { href: '/admin', 'data-link': '', style: { color: 'var(--brand)' } }, '/admin'),
        '.',
      ),
      el('button', {
        type: 'button',
        style: {
          marginTop: '10px',
          width: '100%',
          padding: '6px 10px',
          background: 'var(--ink)',
          color: 'var(--paper)',
          border: '2px solid var(--ink)',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.78rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        },
        onClick: () => {
          tweaks = { ...DEFAULTS };
          saveTweaks(tweaks);
          applyTweaks(tweaks);
          rebuild();
        },
      }, 'Reset all'),
      el('button', {
        type: 'button',
        style: {
          marginTop: '6px',
          width: '100%',
          padding: '6px 10px',
          background: 'var(--paper)',
          color: 'var(--ink)',
          border: '2px solid var(--ink)',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.78rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        },
        onClick: () => {
          try { localStorage.removeItem(ENABLE_KEY); } catch { /* ignore */ }
          fab.remove();
          panel.remove();
        },
      }, 'Hide panel (until ?tweaks=1)'),
    ));
  }

  fab.addEventListener('click', () => {
    open = !open;
    panel.style.display = open ? 'block' : 'none';
    if (open) rebuild();
  });

  document.body.appendChild(panel);
  document.body.appendChild(fab);
}
