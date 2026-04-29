import { el, clear } from '../dom.js';
import { icon } from '../icons.js';

const STATUS_COLORS = {
  Shipped: '#7B2EFF',
  Delivered: '#7B2EFF',
  Processing: '#7C5E1F',
  Paid: '#D89E2F',
  Refunded: '#3D2F4A',
  Printing: '#7C5E1F',
  'In Queue': '#3D2F4A',
};

export function AccountPage({ socket }) {
  const state = {
    activeTab: 'designs',
    user: null,
    profile: { displayName: 'Guest', email: '', preferences: {}, emailPrefs: {} },
    designs: [],
    orders: [],
    photos: [],
    loaded: false,
  };

  const root = el('div.max-w-3xl.mx-auto.px-4.py-8');

  const profileHeader = el('div', {
    class: 'rounded-2xl p-6 border mb-6 flex items-center gap-5',
    style: { background: '#FFFFFF', borderColor: '#D7CFB6' },
  });
  root.appendChild(profileHeader);

  const tabBar = el('div', {
    class: 'flex rounded-xl p-1 mb-5 gap-1',
    style: { background: '#FFFFFF', border: '1px solid #D7CFB6' },
  });
  root.appendChild(tabBar);

  const content = el('div');
  root.appendChild(content);

  function renderProfile() {
    clear(profileHeader);
    const isGuest = !state.user;
    profileHeader.append(
      el(
        'div.relative',
        el(
          'div',
          {
            class: 'w-20 h-20 rounded-2xl flex items-center justify-center',
            style: { background: 'linear-gradient(135deg, #E5E0CC, #FFFFFF)', fontSize: '1.875rem' },
          },
          '\u{1F6B4}'
        )
      ),
      el(
        'div.flex-1',
        el('h1', { style: { fontWeight: 800, fontSize: '1.3rem' } }, state.profile.displayName || 'Guest'),
        el('p', { style: { color: '#3D2F4A', fontSize: '0.85rem' } }, state.profile.email || 'Not signed in'),
        el(
          'div.flex.items-center.gap-3.mt-2',
          state.user
            ? el(
                'span',
                {
                  class: 'px-2 py-0.5 rounded-full',
                  style: {
                    background: 'rgba(123,46,255,0.12)',
                    color: '#7B2EFF',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  },
                },
                '✓ Verified Rider'
              )
            : null,
          el(
            'span',
            { style: { color: '#3D2F4A', fontSize: '0.75rem' } },
            `${state.designs.length} designs · ${state.orders.length} orders`
          )
        )
      ),
      isGuest
        ? el(
            'a',
            {
              href: '/login?next=/account',
              'data-link': true,
              class: 'flex items-center gap-1.5 transition-colors',
              style: {
                color: '#FFFFFF',
                background: '#7B2EFF',
                fontSize: '0.85rem',
                padding: '8px 12px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: 600,
              },
            },
            'Sign in'
          )
        : el(
            'button',
            {
              class: 'flex items-center gap-1.5 transition-colors',
              style: { color: '#3D2F4A', fontSize: '0.8rem' },
              onClick: signOut,
            },
            icon('logOut', { size: 16 }),
            'Sign out'
          )
    );
  }

  function renderTabs() {
    clear(tabBar);
    const tabs = [
      { id: 'designs', label: 'My Designs', ico: 'bike' },
      { id: 'orders', label: 'Orders', ico: 'package' },
      { id: 'settings', label: 'Settings', ico: 'settingsGear' },
    ];
    for (const tab of tabs) {
      const active = state.activeTab === tab.id;
      tabBar.appendChild(
        el(
          'button',
          {
            class: 'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-all',
            style: {
              background: active ? '#7B2EFF' : 'transparent',
              color: active ? '#FFFFFF' : '#3D2F4A',
              fontWeight: active ? 700 : 500,
              fontSize: '0.85rem',
            },
            onClick: () => {
              state.activeTab = tab.id;
              renderContent();
              renderTabs();
            },
          },
          icon(tab.ico, { size: 16, color: active ? '#FFFFFF' : '#3D2F4A' }),
          tab.label
        )
      );
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
    if (state.photos.length) {
      const strip = el('div', {
        style: {
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          padding: '4px 0 12px',
          marginBottom: '8px',
        },
      });
      strip.appendChild(
        el(
          'p',
          { style: { color: '#3D2F4A', fontSize: '0.75rem', margin: '0 8px 0 0', whiteSpace: 'nowrap' } },
          'Your photos:'
        )
      );
      for (const p of state.photos) {
        strip.appendChild(
          el(
            'a',
            {
              href: `/?photo=${encodeURIComponent(p.id)}`,
              'data-link': true,
              style: {
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                background: '#D7CFB6',
                border: '1px solid #D7CFB6',
                color: '#3D2F4A',
                fontSize: '0.65rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                flexShrink: 0,
              },
              title: p.filename || 'photo',
            },
            (p.filename || 'IMG').slice(0, 4)
          )
        );
      }
      wrap.appendChild(strip);
    }

    if (!state.designs.length) {
      wrap.appendChild(
        el(
          'p',
          { style: { color: '#3D2F4A', fontSize: '0.85rem', padding: '1.5rem', textAlign: 'center' } },
          state.user
            ? 'No designs yet — make one from the home page.'
            : 'Sign in to see your designs.'
        )
      );
    }

    for (const d of state.designs) {
      const date = d.date || (d.created_at ? new Date(d.created_at).toLocaleDateString() : '');
      wrap.appendChild(
        el(
          'div',
          {
            class: 'rounded-xl border transition-colors',
            style: { background: '#FFFFFF', borderColor: '#D7CFB6' },
          },
          el(
            'div.flex.items-center.gap-4.p-4',
            el(
              'div',
              {
                class: 'w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border',
                style: { background: '#2A1F3D', borderColor: '#D7CFB6' },
              },
              ''
            ),
            el(
              'div.flex-1',
              el(
                'p',
                { style: { color: '#0E0A12', fontWeight: 600, fontSize: '0.9rem' } },
                d.photo_name || d.filename || 'Untitled design'
              ),
              el('p', { style: { color: '#3D2F4A', fontSize: '0.75rem' } }, date),
              el(
                'div',
                { class: 'flex items-center gap-2 mt-1.5' },
                d.paid
                  ? el(
                      'span',
                      {
                        class: 'px-1.5 py-0.5 rounded',
                        style: { background: 'rgba(123,46,255,0.12)', color: '#7B2EFF', fontSize: '0.65rem' },
                      },
                      'PAID'
                    )
                  : null,
                d.is_public
                  ? el(
                      'span',
                      {
                        class: 'px-1.5 py-0.5 rounded',
                        style: { background: '#D7CFB6', color: '#3D2F4A', fontSize: '0.65rem' },
                      },
                      'PUBLIC'
                    )
                  : null
              )
            ),
            el(
              'div.flex.gap-2',
              d.paid
                ? el(
                    'button',
                    {
                      class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors',
                      style: { borderColor: '#D7CFB6', color: '#3D2F4A', fontSize: '0.75rem' },
                      onClick: () => downloadStl(d),
                    },
                    icon('download', { size: 14 }),
                    'STL'
                  )
                : null,
              el(
                'button',
                {
                  class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors',
                  style: { background: '#7C5E1F', color: '#fff', fontSize: '0.75rem', fontWeight: 600 },
                  onClick: () => shareDesign(d),
                },
                'Share'
              ),
              el(
                'button',
                {
                  class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors',
                  style: { background: 'transparent', color: '#3D2F4A', fontSize: '0.75rem' },
                  onClick: () => deleteDesign(d),
                },
                icon('trash2', { size: 14 })
              )
            )
          )
        )
      );
    }

    wrap.appendChild(
      el(
        'a',
        {
          href: '/',
          'data-link': true,
          class: 'flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed transition-colors mt-1',
          style: { borderColor: '#D7CFB6', color: '#3D2F4A', textDecoration: 'none' },
        },
        el('span', { style: { fontSize: '1.2rem' } }, '+'),
        el('span', { style: { fontSize: '0.85rem', fontWeight: 600 } }, 'Create New Design')
      )
    );
    return wrap;
  }

  function renderOrders() {
    const wrap = el('div.flex.flex-col.gap-3');
    if (!state.orders.length) {
      wrap.appendChild(
        el(
          'p',
          { style: { color: '#3D2F4A', fontSize: '0.85rem', padding: '1.5rem', textAlign: 'center' } },
          state.loaded ? 'No orders yet.' : 'Loading orders…'
        )
      );
    }
    for (const order of state.orders) {
      wrap.appendChild(
        el(
          'div',
          { class: 'rounded-xl border p-4', style: { background: '#FFFFFF', borderColor: '#D7CFB6' } },
          el(
            'div.flex.items-start.justify-between.gap-3',
            el(
              'div.flex-1',
              el(
                'div.flex.items-center.gap-2.mb-1',
                el('span', { style: { color: '#0E0A12', fontWeight: 600, fontSize: '0.88rem' } }, order.name),
                el(
                  'span',
                  {
                    class: 'px-2 py-0.5 rounded-full',
                    style: {
                      background: `${STATUS_COLORS[order.status] || '#3D2F4A'}18`,
                      color: STATUS_COLORS[order.status] || '#3D2F4A',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      border: `1px solid ${STATUS_COLORS[order.status] || '#3D2F4A'}30`,
                    },
                  },
                  order.status
                )
              ),
              el(
                'p',
                { style: { color: '#3D2F4A', fontSize: '0.75rem' } },
                `${order.id} · ${order.date} · Qty: ${order.qty}`
              )
            ),
            el(
              'div.text-right',
              el('p', { style: { color: '#7B2EFF', fontWeight: 700, fontSize: '0.9rem' } }, order.price)
            )
          )
        )
      );
    }
    return wrap;
  }

  function renderSettings() {
    const wrap = el('div.flex.flex-col.gap-4');
    const nameInput = el('input', {
      value: state.profile.displayName || '',
      class: 'rounded-xl px-4 py-2.5 border',
      style: {
        background: '#FFFFFF',
        color: '#0E0A12',
        borderColor: '#D7CFB6',
        fontSize: '0.9rem',
        outline: 'none',
      },
      onInput: (e) => {
        state.profile.displayName = e.target.value;
      },
    });
    const emailDisplay = el('p', { style: { color: '#3D2F4A', fontSize: '0.85rem' } }, state.profile.email);

    wrap.appendChild(
      el(
        'div',
        {
          class: 'rounded-2xl border p-5',
          style: { background: '#FFFFFF', borderColor: '#D7CFB6' },
        },
        el('h3.mb-4', { style: { fontWeight: 700, fontSize: '0.95rem' } }, 'Profile'),
        el(
          'div.flex.flex-col.gap-4',
          el(
            'div',
            { class: 'flex flex-col gap-1.5' },
            el('label', { style: { color: '#3D2F4A', fontSize: '0.8rem' } }, 'Display Name'),
            nameInput
          ),
          el(
            'div',
            { class: 'flex flex-col gap-1.5' },
            el('label', { style: { color: '#3D2F4A', fontSize: '0.8rem' } }, 'Email'),
            emailDisplay
          )
        ),
        el(
          'button',
          {
            class: 'mt-4 px-5 py-2 rounded-xl transition-all',
            style: {
              background: '#7B2EFF',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.85rem',
            },
            onClick: async () => {
              await socket
                .request('account.update', {
                  displayName: state.profile.displayName,
                })
                .catch(() => {});
              renderProfile();
            },
          },
          'Save Changes'
        )
      )
    );

    const prefs = [
      { key: 'order_updates', label: 'Email me when my print ships' },
      { key: 'design_reminders', label: 'Email me reminders to finish a design' },
      { key: 'marketing', label: 'Marketing emails about new features' },
    ];
    const prefBox = el(
      'div',
      {
        class: 'rounded-2xl border p-5',
        style: { background: '#FFFFFF', borderColor: '#D7CFB6' },
      },
      el('h3.mb-4', { style: { fontWeight: 700, fontSize: '0.95rem' } }, 'Email preferences')
    );
    for (const p of prefs) {
      const row = el(
        'div',
        {
          class: 'flex items-center justify-between py-2.5',
          style: { borderBottom: '1px solid #D7CFB6' },
        },
        el('span', { style: { color: '#3D2F4A', fontSize: '0.85rem' } }, p.label),
        toggleSwitch(state.profile.emailPrefs[p.key] !== false, async (v) => {
          state.profile.emailPrefs[p.key] = v;
          await socket
            .request('account.update', { emailPrefs: { [p.key]: v } })
            .catch(() => {});
        })
      );
      prefBox.appendChild(row);
    }
    wrap.appendChild(prefBox);

    if (state.user) {
      wrap.appendChild(
        el(
          'div',
          {
            class: 'rounded-2xl border p-5',
            style: { background: '#FFFFFF', borderColor: '#D7CFB6' },
          },
          el('h3.mb-2', { style: { fontWeight: 700, fontSize: '0.95rem' } }, 'Privacy & data'),
          el(
            'p',
            { style: { color: '#3D2F4A', fontSize: '0.8rem', marginBottom: '12px' } },
            'Export everything we have on you, or delete your account.'
          ),
          el(
            'div.flex.gap-2',
            el(
              'button',
              {
                class: 'px-4 py-2 rounded-xl border',
                style: { borderColor: '#D7CFB6', color: '#0E0A12', fontSize: '0.8rem' },
                onClick: exportData,
              },
              'Download my data'
            ),
            el(
              'button',
              {
                class: 'px-4 py-2 rounded-xl',
                style: { background: '#3D2F4A', color: '#fff', fontSize: '0.8rem' },
                onClick: deleteAccount,
              },
              'Delete account'
            )
          )
        )
      );
    }
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
    const track = el(
      'button',
      {
        class: 'relative rounded-full transition-colors',
        style: {
          width: '42px',
          height: '22px',
          border: 'none',
          background: on ? '#7B2EFF' : '#D7CFB6',
          cursor: 'pointer',
        },
        onClick: () => {
          on = !on;
          track.style.background = on ? '#7B2EFF' : '#D7CFB6';
          knob.style.transform = on ? 'translateX(22px)' : 'translateX(2px)';
          onChange(on);
        },
      },
      knob
    );
    return track;
  }

  async function signOut() {
    try {
      await socket.request('auth.logout', {});
    } catch {
      /* ignore */
    }
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore */
    }
    window.location.href = '/';
  }

  async function downloadStl(design) {
    try {
      const res = await socket.request('stl.download', { designId: design.id });
      const bytes = atob(res.stl_b64);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      const blob = new Blob([buf], { type: 'model/stl' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || 'StemDomeZ_ValveStem.stl';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err.message || 'Download failed');
    }
  }

  async function shareDesign(design) {
    try {
      const res = await socket.request('designs.createShareLink', { designId: design.id });
      const url = `${location.origin}/d/${res.token}`;
      if (navigator.share) {
        await navigator.share({ title: 'My StemDomeZ', text: 'Check out my design.', url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        window.alert('Share link copied to clipboard.');
      } else {
        window.prompt('Copy this share URL:', url);
      }
    } catch (err) {
      window.alert(err.message || 'Could not create share link');
    }
  }

  async function deleteDesign(design) {
    if (!window.confirm('Delete this design? This cannot be undone.')) return;
    try {
      await socket.request('designs.delete', { id: design.id });
      state.designs = state.designs.filter((d) => d.id !== design.id);
      renderContent();
    } catch (err) {
      window.alert(err.message || 'Delete failed');
    }
  }

  async function exportData() {
    try {
      const data = await socket.request('account.exportData');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stemdomez-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err.message || 'Export failed');
    }
  }

  async function deleteAccount() {
    if (!window.confirm('Permanently delete your account? Your designs and photos will be removed.')) return;
    try {
      await socket.request('account.delete');
      window.location.href = '/?deleted=1';
    } catch (err) {
      window.alert(err.message || 'Delete failed');
    }
  }

  async function loadInitial() {
    try {
      const who = await socket.request('auth.whoami');
      state.user = who?.user || null;
    } catch {
      /* ignore */
    }
    try {
      const profile = await socket.request('account.get');
      if (profile) {
        state.profile.displayName = profile.displayName || state.profile.displayName;
        state.profile.email = profile.email || '';
        state.profile.preferences = profile.preferences || {};
        state.profile.emailPrefs = profile.emailPrefs || {};
      }
    } catch {
      /* ignore */
    }
    if (state.user) {
      try {
        const r = await socket.request('designs.listMine', { page: 1, pageSize: 12 });
        state.designs = r?.rows || [];
      } catch {
        state.designs = [];
      }
      try {
        const ph = await socket.request('photos.list', { page: 1, pageSize: 8 });
        state.photos = ph?.rows || [];
      } catch {
        state.photos = [];
      }
    }
    try {
      const orders = await socket.request('orders.list');
      state.orders = orders || [];
    } catch {
      /* ignore */
    }
    state.loaded = true;
    renderProfile();
    renderContent();
  }

  renderProfile();
  renderTabs();
  renderContent();
  loadInitial();

  return { el: root };
}
