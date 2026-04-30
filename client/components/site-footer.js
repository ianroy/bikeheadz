// Site-wide footer — pinned-ink ground, accent2 (fluoro-green) type
// for §14 contrast (stays at 14.75:1 in light + dark + AAA modes
// without flipping). Mounted once globally below the router's <main>
// element from client/main.js, re-rendered when the runtime config
// changes (so the Pricing graffiti tracks payments_enabled).

import { el } from '../dom.js';

export function createSiteFooter({ paymentsOff } = {}) {
  return el('footer', {
    style: {
      background: '#0E0A12',
      color: '#F5F2E5',
      borderTop: '3px solid #0E0A12',
      padding: '2.5rem 0 3rem',
    },
  },
    el('div', { class: 'max-w-6xl mx-auto px-6' },
      el('div', { class: 'grid md:grid-cols-4 gap-8 mb-8' },
        footerCol('Product', [
          ['Make yours', '/stemdome-generator'],
          ['Pricing', '/pricing', paymentsOff ? { graffiti: 'free' } : null],
          ['Sadie’s Sixpack', '/#sixpack'],
          ['Showcase', '/showcase'],
          ['How it works', '/#how'],
          ['Account', '/account'],
        ]),
        footerCol('Help', [
          ['FAQ', '/help'],
          ['Status', '/status'],
          ['Changelog', '/changelog'],
          ['Press kit', '/press'],
        ]),
        footerCol('Legal', [
          ['Terms', '/terms'],
          ['Privacy', '/privacy'],
          ['Acceptable use', '/acceptable-use'],
          ['DMCA', '/dmca'],
          ['Photo policy', '/photo-policy'],
          ['Cookies', '/cookies'],
          ['Refunds', '/refunds'],
          ['Security', '/security'],
        ]),
        el('div', null,
          el('div', {
            class: 'sdz-display sdz-wordmark',
            style: { color: '#F5F2E5', fontSize: '1.6rem', textShadow: '3px 3px 0 #2EFF8C' },
          },
            'StemDome',
            el('span', { class: 'z' }, 'Z'),
          ),
          el('p', { style: { color: '#2EFF8C', fontStyle: 'italic', fontSize: '0.85rem', marginTop: '0.75rem' } },
            'Race day at the trails, 1993.'),
        ),
      ),
      el('div', {
        class: 'pt-6 flex flex-wrap items-center justify-between gap-2',
        style: { borderTop: '1px solid #2EFF8C', fontSize: '0.78rem', color: '#2EFF8C' },
      },
        el('span', null,
          '© ' + new Date().getFullYear() + ' StemDomeZ. Made in a workshop by ',
          el('a', {
            href: 'https://ianroy.org/',
            target: '_blank',
            rel: 'noopener noreferrer',
            style: { color: '#2EFF8C', textDecoration: 'underline', fontWeight: 600 },
          }, 'ianroy.org'),
          '.',
        ),
        el('span', null,
          'stemdomez.com · ',
          el('a', {
            href: '/.well-known/security.txt',
            style: { color: '#2EFF8C', textDecoration: 'underline' },
          }, 'security.txt'),
        ),
      ),
    ),
  );
}

function footerCol(title, links) {
  return el('div', null,
    el('h4', {
      style: {
        color: '#2EFF8C',
        fontSize: '0.78rem',
        fontWeight: 800,
        fontStyle: 'italic',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '0.75rem',
      },
    }, title),
    el('ul', { style: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' } },
      ...links.map(([label, href, opts]) => {
        const a = el('a', { href, 'data-link': '', style: { color: '#F5F2E5', textDecoration: 'none', fontSize: '0.92rem' } });
        if (opts && opts.graffiti === 'free') {
          a.appendChild(el('span', { class: 'sdz-graffiti-strike' }, label));
          a.appendChild(el('span', { class: 'sdz-graffiti-tag', style: { fontSize: '0.85em', marginLeft: '0.4em' } }, 'Free!'));
        } else {
          a.textContent = label;
        }
        return el('li', null, a);
      }),
    ),
  );
}
