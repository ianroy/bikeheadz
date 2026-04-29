// P7-009 — Slicer deep-link buttons.
//
//   SlicerButtons({ shareUrl })
//
// Renders three workshop-palette buttons that hand off the share URL to a
// desktop slicer via its custom URL scheme. There is no reliable way to
// detect "is this scheme registered?" in a browser, so we use the standard
// trick: when the user touches a button, schedule a 1-second fallback
// timer; if the page is still focused after the timer fires, the slicer
// almost certainly didn't intercept the navigation, and we surface a
// "Slicer not installed?" hint.

import { el } from '../dom.js';

const SLICERS = [
  { label: 'Open in Bambu Studio', scheme: 'bambustudio' },
  { label: 'Open in OrcaSlicer',  scheme: 'orcaslicer' },
  { label: 'Open in PrusaSlicer', scheme: 'prusaslicer' },
];

export function SlicerButtons({ shareUrl } = {}) {
  const url = shareUrl || (typeof location !== 'undefined' ? location.href : '');
  const encoded = encodeURIComponent(url);

  const hint = el('div', {
    class: 'text-xs',
    style: {
      color: '#3D2F4A',
      display: 'none',
      marginTop: '8px',
    },
  }, 'Slicer not installed? Install it from the slicer’s website, then try again.');

  const buttons = SLICERS.map(({ label, scheme }) => {
    const href = `${scheme}://import?url=${encoded}`;
    let fallbackTimer = 0;
    let pageHidden = false;

    const onVisibilityChange = () => {
      if (document.hidden) pageHidden = true;
    };

    const a = el('a', {
      href,
      target: '_self',
      rel: 'noopener',
      class: 'inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold border transition-colors',
      style: {
        background: '#F5F2E5',
        color: '#0E0A12',
        borderColor: '#D7CFB6',
        textDecoration: 'none',
      },
      onMouseenter: () => {
        a.style.background = '#FFFFFF';
        a.style.borderColor = '#7B2EFF';
        a.style.color = '#7B2EFF';
      },
      onMouseleave: () => {
        a.style.background = '#F5F2E5';
        a.style.borderColor = '#D7CFB6';
        a.style.color = '#0E0A12';
      },
      onTouchstart: () => armFallback(),
      onClick: () => armFallback(),
    }, label);

    function armFallback() {
      pageHidden = false;
      document.addEventListener('visibilitychange', onVisibilityChange, { once: true });
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(() => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        if (!pageHidden && document.visibilityState === 'visible') {
          hint.style.display = 'block';
        }
      }, 1000);
    }

    return a;
  });

  const root = el('div.flex.flex-col.gap-2', {},
    el('div.flex.flex-wrap.gap-2', {}, ...buttons),
    hint,
  );

  return { el: root };
}
