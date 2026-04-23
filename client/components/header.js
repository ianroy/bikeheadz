import { el, clear } from '../dom.js';
import { icon } from '../icons.js';

export function HeaderComponent() {
  let currentPath = location.pathname;

  const desktopNav = el('nav.items-center.gap-1', { class: 'hidden md:flex' });
  const mobilePanel = el('div', {
    class: 'md:hidden border-t px-4 py-3 flex-col gap-1',
    style: { background: '#0d0d1a', borderColor: '#1e1e35', display: 'none' },
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
    style: { color: '#9090b0' },
    onClick: () => setMenu(!menuOpen),
  });
  menuButton.appendChild(icon('menu', { size: 20 }));

  const header = el('header', {
    class: 'sticky top-0 z-50 border-b',
    style: {
      background: 'rgba(9,9,15,0.95)',
      backdropFilter: 'blur(20px)',
      borderColor: '#1e1e35',
    },
  },
    el('div.max-w-7xl.mx-auto.px-4.h-16.flex.items-center.justify-between',
      el('a.flex.items-center', {
        href: '/',
        'data-link': '',
        class: 'gap-2.5',
      },
        el('div', {
          class: 'w-9 h-9 rounded-xl flex items-center justify-center',
          style: { background: 'linear-gradient(135deg, #b4ff45, #7fc718)' },
        }, iconBlack('bike', 18)),
        el('div.flex.flex-col', { style: { lineHeight: '1' } },
          el('span', {
            class: 'text-white tracking-tight',
            style: { fontSize: '1.1rem', fontWeight: 700 },
          }, 'Bike'),
          el('span', {
            class: 'uppercase',
            style: {
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: '#b4ff45',
            },
          }, 'Headz'),
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

    const links = [
      ['/how-it-works', 'How It Works'],
      ['/account', 'Account'],
    ];

    for (const [to, label] of links) {
      desktopNav.appendChild(navLink(to, label));
      mobilePanel.appendChild(navLink(to, label, () => setMenu(false)));
    }

    const profile = el('a', {
      href: '/account',
      'data-link': '',
      class: 'ml-2 w-9 h-9 rounded-full flex items-center justify-center border transition-colors',
      style: { background: '#1a1a2e', borderColor: '#2a2a45' },
    }, icon('user', { size: 16, color: '#9090b0' }));
    desktopNav.appendChild(profile);
  }

  function navLink(to, label, onClick) {
    const active = currentPath === to;
    const a = el('a', {
      href: to,
      'data-link': '',
      class: 'px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer',
      style: active
        ? {
            background: 'rgba(180,255,69,0.2)',
            color: '#b4ff45',
            border: '1px solid rgba(180,255,69,0.3)',
          }
        : {
            color: '#9090b0',
          },
      onClick: (e) => {
        onClick?.(e);
      },
    }, label);
    if (!active) {
      a.addEventListener('mouseenter', () => {
        a.style.color = '#e0e0f0';
        a.style.background = 'rgba(255,255,255,0.05)';
      });
      a.addEventListener('mouseleave', () => {
        a.style.color = '#9090b0';
        a.style.background = 'transparent';
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

// Helper: icon rendered in black (for contrast on green logo bg).
function iconBlack(name, size) {
  return icon(name, { size, color: '#000' });
}
