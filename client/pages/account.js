import { el, clear } from '../dom.js';
import { icon } from '../icons.js';

const STATUS_COLORS = {
  Shipped:    '#1D4ED8',
  Delivered:  '#DC2626',
  Processing: '#C2410C',
};

const LOCAL_DESIGNS = [
  { name: 'My Chrome Head', date: 'Apr 18, 2026', material: 'chrome', stars: 5, img: 'https://images.unsplash.com/photo-1684770114368-6e01b4f8741a?w=200&q=80' },
  { name: 'Matte Version',  date: 'Apr 5, 2026',  material: 'matte',  stars: 4, img: 'https://images.unsplash.com/photo-1667761673934-70b67e527f1f?w=200&q=80' },
  { name: 'Gloss Test',     date: 'Mar 29, 2026', material: 'gloss',  stars: 4, img: 'https://images.unsplash.com/photo-1651557747176-5aa3c20b6780?w=200&q=80' },
];

export function AccountPage({ socket }) {
  const state = {
    activeTab: 'designs',
    displayName: 'Alex Rider',
    email: 'alex@bikeheadz.com',
    preferences: { shipNotify: true, marketing: false, defaultChrome: true },
    orders: [],
  };

  const root = el('div.max-w-3xl.mx-auto.px-4.py-8');

  const profileHeader = el('div', {
    class: 'rounded-2xl p-6 border mb-6 flex items-center gap-5',
    style: { background: '#FFFFFF', borderColor: '#E5DFD3' },
  });
  root.appendChild(profileHeader);

  const tabBar = el('div', {
    class: 'flex rounded-xl p-1 mb-5 gap-1',
    style: { background: '#FFFFFF', border: '1px solid #E5DFD3' },
  });
  root.appendChild(tabBar);

  const content = el('div');
  root.appendChild(content);

  function renderProfile() {
    clear(profileHeader);
    profileHeader.append(
      el('div.relative',
        el('div', {
          class: 'w-20 h-20 rounded-2xl flex items-center justify-center',
          style: {
            background: 'linear-gradient(135deg, #F5F1E8, #FFFFFF)',
            fontSize: '1.875rem',
          },
        }, '\u{1F6B4}'),
        el('button', {
          class: 'absolute w-7 h-7 rounded-lg flex items-center justify-center border',
          style: {
            right: '-4px',
            bottom: '-4px',
            background: '#F5F1E8',
            borderColor: '#E5DFD3',
          },
        }, icon('camera', { size: 14, color: '#DC2626' })),
      ),
      el('div.flex-1',
        el('h1.text-white', { style: { fontWeight: 800, fontSize: '1.3rem' } }, state.displayName),
        el('p', { style: { color: '#6B6157', fontSize: '0.85rem' } }, state.email),
        el('div.flex.items-center.gap-3.mt-2',
          el('span', {
            class: 'px-2 py-0.5 rounded-full',
            style: { background: 'rgba(220,38,38,0.12)', color: '#DC2626', fontSize: '0.72rem', fontWeight: 700 },
          }, '\u2713 Verified Rider'),
          el('span', { style: { color: '#8B8278', fontSize: '0.75rem' } }, '3 designs · 2 orders'),
        ),
      ),
      el('button', {
        class: 'flex items-center gap-1.5 transition-colors',
        style: { color: '#8B8278', fontSize: '0.8rem' },
      },
        icon('logOut', { size: 16 }),
        'Sign out',
      ),
    );
  }

  function renderTabs() {
    clear(tabBar);
    const tabs = [
      { id: 'designs',  label: 'My Designs', ico: 'bike' },
      { id: 'orders',   label: 'Orders',     ico: 'package' },
      { id: 'settings', label: 'Settings',   ico: 'settingsGear' },
    ];
    for (const tab of tabs) {
      const active = state.activeTab === tab.id;
      tabBar.appendChild(el('button', {
        class: 'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-all',
        style: {
          background: active ? '#DC2626' : 'transparent',
          color: active ? '#000' : '#6B6157',
          fontWeight: active ? 700 : 500,
          fontSize: '0.85rem',
        },
        onClick: () => { state.activeTab = tab.id; renderContent(); renderTabs(); },
      },
        icon(tab.ico, { size: 16, color: active ? '#000' : '#6B6157' }),
        tab.label,
      ));
    }
  }

  function renderContent() {
    clear(content);
    if (state.activeTab === 'designs') content.appendChild(renderDesigns());
    else if (state.activeTab === 'orders') content.appendChild(renderOrders());
    else content.appendChild(renderSettings());
  }

  function renderDesigns() {
    const wrap = el('div.flex.flex-col.gap-3');
    for (const d of LOCAL_DESIGNS) {
      wrap.appendChild(el('div', {
        class: 'rounded-xl border transition-colors',
        style: { background: '#FFFFFF', borderColor: '#E5DFD3' },
      },
        el('div.flex.items-center.gap-4.p-4',
          el('div', {
            class: 'w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border',
            style: { borderColor: '#E5DFD3' },
          },
            el('img', {
              src: d.img,
              alt: d.name,
              class: 'w-full h-full object-cover',
            }),
          ),
          el('div.flex-1',
            el('p', {
              style: { color: '#1A1614', fontWeight: 600, fontSize: '0.9rem' },
            }, d.name),
            el('p', { style: { color: '#8B8278', fontSize: '0.75rem' } }, d.date),
            el('div', { class: 'flex items-center gap-2 mt-1.5' },
              ...Array.from({ length: d.stars }, () =>
                icon('star', { size: 12, color: '#DC2626' })
              ),
              el('span', {
                class: 'px-1.5 py-0.5 rounded capitalize',
                style: { background: '#E5DFD3', color: '#6B6157', fontSize: '0.65rem' },
              }, d.material),
            ),
          ),
          el('div.flex.gap-2',
            el('button', {
              class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors',
              style: { borderColor: '#E5DFD3', color: '#6B6157', fontSize: '0.75rem' },
            },
              icon('download', { size: 14 }),
              'STL',
            ),
            el('button', {
              class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors',
              style: { background: '#C2410C', color: '#fff', fontSize: '0.75rem', fontWeight: 600 },
            }, 'Reorder'),
          ),
        ),
      ));
    }
    wrap.appendChild(el('a', {
      href: '/',
      'data-link': '',
      class: 'flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed transition-colors mt-1',
      style: { borderColor: '#E5DFD3', color: '#8B8278', textDecoration: 'none' },
    },
      el('span', { style: { fontSize: '1.2rem' } }, '+'),
      el('span', { style: { fontSize: '0.85rem', fontWeight: 600 } }, 'Create New Design'),
    ));
    return wrap;
  }

  function renderOrders() {
    const wrap = el('div.flex.flex-col.gap-3');
    if (!state.orders.length) {
      wrap.appendChild(el('p', {
        style: { color: '#8B8278', fontSize: '0.85rem', padding: '1.5rem', textAlign: 'center' },
      }, 'Loading orders…'));
    }
    for (const order of state.orders) {
      wrap.appendChild(el('div', {
        class: 'rounded-xl border p-4',
        style: { background: '#FFFFFF', borderColor: '#E5DFD3' },
      },
        el('div.flex.items-start.justify-between.gap-3',
          el('div.flex-1',
            el('div.flex.items-center.gap-2.mb-1',
              el('span', {
                style: { color: '#1A1614', fontWeight: 600, fontSize: '0.88rem' },
              }, order.name),
              el('span', {
                class: 'px-2 py-0.5 rounded-full',
                style: {
                  background: `${STATUS_COLORS[order.status] || '#8B8278'}18`,
                  color: STATUS_COLORS[order.status] || '#3D3A36',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  border: `1px solid ${STATUS_COLORS[order.status] || '#8B8278'}30`,
                },
              }, order.status),
            ),
            el('p', { style: { color: '#8B8278', fontSize: '0.75rem' } },
              `${order.id} · ${order.date} · Qty: ${order.qty}`,
            ),
          ),
          el('div.text-right',
            el('p', {
              style: { color: '#DC2626', fontWeight: 700, fontSize: '0.9rem' },
            }, order.price),
            el('button', {
              class: 'flex items-center gap-1 transition-colors mt-1',
              style: { color: '#8B8278', fontSize: '0.72rem' },
            }, 'Details', icon('chevronRight', { size: 12 })),
          ),
        ),
      ));
    }
    return wrap;
  }

  function renderSettings() {
    const wrap = el('div.flex.flex-col.gap-4');
    const nameInput = el('input', {
      value: state.displayName,
      class: 'rounded-xl px-4 py-2.5 border transition-colors',
      style: {
        background: '#FFFFFF',
        color: '#1A1614',
        borderColor: '#E5DFD3',
        fontSize: '0.9rem',
        outline: 'none',
      },
      onInput: (e) => { state.displayName = e.target.value; },
    });
    const emailInput = el('input', {
      value: state.email,
      class: 'rounded-xl px-4 py-2.5 border transition-colors',
      style: {
        background: '#FFFFFF',
        color: '#1A1614',
        borderColor: '#E5DFD3',
        fontSize: '0.9rem',
        outline: 'none',
      },
      onInput: (e) => { state.email = e.target.value; },
    });

    wrap.appendChild(el('div', {
      class: 'rounded-2xl border p-5',
      style: { background: '#FFFFFF', borderColor: '#E5DFD3' },
    },
      el('h3.text-white.mb-4', {
        style: { fontWeight: 700, fontSize: '0.95rem' },
      }, 'Profile'),
      el('div.flex.flex-col.gap-4',
        el('div', { class: 'flex flex-col gap-1.5' },
          el('label', { style: { color: '#6B6157', fontSize: '0.8rem' } }, 'Display Name'),
          nameInput,
        ),
        el('div', { class: 'flex flex-col gap-1.5' },
          el('label', { style: { color: '#6B6157', fontSize: '0.8rem' } }, 'Email'),
          emailInput,
        ),
      ),
      el('button', {
        class: 'mt-4 px-5 py-2 rounded-xl transition-all',
        style: {
          background: '#DC2626',
          color: '#000',
          fontWeight: 700,
          fontSize: '0.85rem',
        },
        onClick: async () => {
          await socket.request('account.update', {
            displayName: state.displayName,
            email: state.email,
            preferences: state.preferences,
          }).catch(() => {});
          renderProfile();
        },
      }, 'Save Changes'),
    ));

    const prefs = [
      { key: 'shipNotify',     label: 'Email me when my print ships' },
      { key: 'marketing',      label: 'Marketing emails about new features' },
      { key: 'defaultChrome',  label: 'Default to chrome material' },
    ];
    const prefBox = el('div', {
      class: 'rounded-2xl border p-5',
      style: { background: '#FFFFFF', borderColor: '#E5DFD3' },
    },
      el('h3.text-white.mb-4', {
        style: { fontWeight: 700, fontSize: '0.95rem' },
      }, 'Preferences'),
    );
    for (const p of prefs) {
      const row = el('div', {
        class: 'flex items-center justify-between py-2.5',
        style: { borderBottom: '1px solid #E5DFD3' },
      },
        el('span', { style: { color: '#3D3A36', fontSize: '0.85rem' } }, p.label),
        toggleSwitch(state.preferences[p.key], (v) => { state.preferences[p.key] = v; }),
      );
      prefBox.appendChild(row);
    }
    wrap.appendChild(prefBox);
    return wrap;
  }

  function toggleSwitch(initial, onChange) {
    let on = initial;
    const knob = el('div', {
      class: 'absolute rounded-full transition-transform',
      style: {
        top: '2px',
        width: '18px',
        height: '18px',
        background: '#fff',
        transform: on ? 'translateX(22px)' : 'translateX(2px)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      },
    });
    const track = el('button', {
      class: 'relative rounded-full transition-colors',
      style: {
        width: '42px',
        height: '22px',
        border: 'none',
        background: on ? '#DC2626' : '#E5DFD3',
        cursor: 'pointer',
      },
      onClick: () => {
        on = !on;
        track.style.background = on ? '#DC2626' : '#E5DFD3';
        knob.style.transform = on ? 'translateX(22px)' : 'translateX(2px)';
        onChange(on);
      },
    }, knob);
    return track;
  }

  // Load initial data over the socket.
  async function loadInitial() {
    try {
      const profile = await socket.request('account.get');
      if (profile) {
        state.displayName = profile.displayName ?? state.displayName;
        state.email = profile.email ?? state.email;
        state.preferences = { ...state.preferences, ...(profile.preferences || {}) };
        renderProfile();
      }
    } catch { /* fallbacks already rendered */ }
    try {
      const orders = await socket.request('orders.list');
      state.orders = orders || [];
      if (state.activeTab === 'orders') renderContent();
    } catch { /* ignore */ }
  }

  renderProfile();
  renderTabs();
  renderContent();
  loadInitial();

  return { el: root };
}
