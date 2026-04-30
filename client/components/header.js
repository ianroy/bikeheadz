import { el, clear } from '../dom.js';
import { icon } from '../icons.js';
import { getCachedAppConfig } from '../util/app-config.js';

// StemDomeZ header — Mongoose-BMX styling.
//
// Design notes:
//   • Top is a checker strip (ink × fluoro green) — period detail.
//   • Body is paper (cream), no backdrop-blur (90s shops don't shimmer).
//   • Logo wordmark is italic with a green drop shadow.
//   • Active nav link gets a fluoro-green Memphis-offset bar underneath.
export function HeaderComponent() {
  let currentPath = location.pathname;

  const desktopNav = el('nav.items-center.gap-1', { class: 'hidden md:flex' });
  const mobilePanel = el('div', {
    class: 'md:hidden border-t px-4 py-3 flex-col gap-1',
    style: {
      background: 'var(--paper)',
      borderColor: 'var(--paper-edge)',
      display: 'none',
    },
  });

  let menuOpen = false;
  const setMenu = (open) => {
    menuOpen = open;
    mobilePanel.style.display = open ? 'flex' : 'none';
    clear(menuButton);
    menuButton.appendChild(icon(open ? 'x' : 'menu', { size: 20 }));
  };

  const menuButton = el('button', {
    class: 'md:hidden p-2 rounded-lg transition-colors',
    style: { color: 'var(--ink-muted)' },
    onClick: () => setMenu(!menuOpen),
  });
  menuButton.appendChild(icon('menu', { size: 20 }));

  // Period checker strip across the top of the header.
  const checker = el('div', {
    class: 'sdz-checker',
    style: { height: '6px', width: '100%' },
  });

  const header = el('header', {
    class: 'sticky top-0 z-50',
    style: {
      background: 'var(--paper)',
      borderBottom: '3px solid var(--ink)',
    },
  },
    checker,
    el('div.max-w-7xl.mx-auto.px-4.h-16.flex.items-center.justify-between',
      el('a.flex.items-center.gap-2', {
        href: '/',
        'data-link': '',
      },
        // Cap-and-head mark — square tile with neon-purple cap +
        // tiny ink head silhouette + fluoro Memphis offset behind.
        el('span', {
          class: 'relative',
          style: {
            display: 'inline-block',
            width: '40px',
            height: '40px',
            background: 'var(--accent2)',
            borderRadius: '8px',
            transform: 'translate(-3px,-3px)',
          },
        }),
        el('span', {
          style: {
            position: 'absolute',
            display: 'inline-block',
            width: '40px',
            height: '40px',
            marginLeft: '-46px',
            marginTop: '0px',
          },
          html: `
            <svg viewBox="0 0 64 64" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="8" fill="#F5F2E5" stroke="#0E0A12" stroke-width="3"/>
              <rect x="10" y="32" width="44" height="20" rx="3" fill="#7B2EFF"/>
              <ellipse cx="32" cy="32" rx="22" ry="3" fill="#A267FF"/>
              <ellipse cx="32" cy="52" rx="22" ry="3" fill="#5A1FCE"/>
              <rect x="14" y="40" width="36" height="2" fill="#5A1FCE"/>
              <rect x="14" y="44" width="36" height="2" fill="#5A1FCE"/>
              <ellipse cx="32" cy="20" rx="11" ry="13" fill="#0E0A12"/>
              <rect x="22" y="22" width="6" height="3" rx="1" fill="#F5F2E5"/>
              <rect x="32" y="22" width="8" height="3" rx="1" fill="#F5F2E5"/>
            </svg>
          `,
        }),
        // Wordmark
        el('span', {
          class: 'sdz-display sdz-wordmark',
          style: { fontSize: '1.4rem', marginLeft: '8px' },
        },
          'StemDome',
          el('span', { class: 'z' }, 'Z'),
        ),
      ),
      desktopNav,
      menuButton,
    ),
    mobilePanel,
  );

  function renderLinks() {
    clear(desktopNav);
    clear(mobilePanel);

    const cfg = getCachedAppConfig();
    const paymentsOff = !cfg.paymentsEnabled;

    // No "Account" entry — the avatar circle on the right is the
    // single entry point so guests don't see a redundant "Account"
    // link next to a profile chip that goes to the same place.
    const links = [
      ['/how-it-works', 'How It Works'],
      ['/sixpack', 'Sixpack'],
      ['/pricing', 'Pricing'],
      ['/showcase', 'Showcase'],
      ['/help', 'Help'],
    ];

    for (const [to, label] of links) {
      desktopNav.appendChild(navLink(to, label, undefined, { graffiti: paymentsOff && to === '/pricing' }));
      mobilePanel.appendChild(navLink(to, label, () => setMenu(false), { graffiti: paymentsOff && to === '/pricing' }));
    }

    // Primary "Make yours" CTA — points at the generator. The money
    // button on every page; lives in the nav so it's always one click
    // away regardless of where the visitor is on the site.
    const makeYours = el(
      'a',
      {
        href: '/stemdome-generator',
        'data-link': '',
        class: 'ml-3 sdz-cta',
        style: { fontSize: '0.78rem', padding: '0.55rem 1.1rem' },
      },
      'MAKE YOURS  →'
    );
    desktopNav.appendChild(makeYours);
    // Mirror in the mobile drawer.
    const mobileMakeYours = el(
      'a',
      {
        href: '/stemdome-generator',
        'data-link': '',
        class: 'sdz-cta mt-2',
        style: { fontSize: '0.85rem', alignSelf: 'flex-start' },
        onClick: () => setMenu(false),
      },
      'MAKE YOURS  →'
    );
    mobilePanel.appendChild(mobileMakeYours);

    // Profile chip — circular, fluoro-green Memphis offset behind.
    const profile = el('a', {
      href: '/account',
      'data-link': '',
      class: 'ml-2 sdz-memphis',
      style: {
        position: 'relative',
        display: 'inline-flex',
        width: '40px',
        height: '40px',
        borderRadius: '999px',
        background: 'var(--paper)',
        border: '3px solid var(--ink)',
        alignItems: 'center',
        justifyContent: 'center',
        '--memphis-offset': '4px',
      },
    }, icon('user', { size: 18, color: 'var(--ink)' }));
    desktopNav.appendChild(profile);
  }

  function navLink(to, label, onClick, opts = {}) {
    const active = currentPath === to;
    const a = el('a', {
      href: to,
      'data-link': '',
      class: 'relative px-3 py-2 rounded-md transition-all cursor-pointer',
      style: {
        color: active ? 'var(--brand)' : 'var(--ink)',
        fontStyle: 'italic',
        fontWeight: 800,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        fontSize: '0.85rem',
        // Extra top padding when graffiti is overlaid, so the "FREE!"
        // tag has room to sit above the text without crowding the
        // checker strip.
        paddingTop: opts.graffiti ? '1.4rem' : undefined,
      },
      onClick: (e) => {
        onClick?.(e);
      },
    });
    if (opts.graffiti) {
      // Magenta spraypaint slash through "Pricing" + a fluoro-green
      // "FREE!" tag spray-stenciled above. Exactly what the brand
      // standards' 90s graphic vocabulary asks for, layered with
      // pointer-events: none so the link still routes cleanly.
      a.appendChild(el('span', { class: 'sdz-graffiti-strike' }, label));
      a.appendChild(
        el(
          'span',
          {
            class: 'sdz-graffiti-tag',
            style: {
              position: 'absolute',
              top: '-0.1rem',
              left: '50%',
              transform: 'translateX(-50%) rotate(-8deg)',
              fontSize: '0.95rem',
              whiteSpace: 'nowrap',
              zIndex: 2,
            },
            'aria-label': 'Free',
          },
          'FREE!'
        )
      );
    } else {
      a.appendChild(document.createTextNode(label));
    }
    if (active) {
      // Active-state underline bar — brand purple (5.09:1 against
      // paper ✓ AA UI). Using fluoro green here would only get 1.18:1
      // and fail the 3:1 threshold (caught by tools/audit_a11y.py).
      const bar = el('span', {
        style: {
          position: 'absolute',
          left: '0.5rem',
          right: '0.5rem',
          bottom: '-2px',
          height: '4px',
          background: 'var(--brand)',
          borderRadius: '2px',
        },
      });
      a.appendChild(bar);
    } else {
      a.addEventListener('mouseenter', () => {
        a.style.color = 'var(--brand)';
      });
      a.addEventListener('mouseleave', () => {
        a.style.color = 'var(--ink)';
      });
    }
    return a;
  }

  renderLinks();

  return {
    el: header,
    setActive(path) {
      currentPath = path;
      renderLinks();
      setMenu(false);
    },
  };
}
