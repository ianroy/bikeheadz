import { el, clear } from '../dom.js';
import { icon } from '../icons.js';
import { getCachedAppConfig } from '../util/app-config.js';

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
  const cfg = getCachedAppConfig();
  const paymentsOff = !cfg.paymentsEnabled;
  const state = {
    activeTab: 'designs',
    user: null,
    profile: {
      displayName: '', email: '',
      preferences: {}, emailPrefs: {},
      hasPassword: false, passwordSetAt: null,
      needsTosAccept: false, tosCurrentVersion: null,
    },
    designs: [],
    orders: [],
    photos: [],
    loaded: false,
  };

  const root = el('div.max-w-3xl.mx-auto.px-4.py-8');

  // Guest empty state — replaces the entire page (profile header,
  // tabs, content) when the visitor isn't signed in. Previously the
  // page rendered a fake "Alex Rider" identity with stub orders;
  // that lied about session state and confused fresh visitors.
  const guestSlot = el('div');
  root.appendChild(guestSlot);

  const profileHeader = el('div', {
    class: 'rounded-2xl p-6 border mb-6 flex items-center gap-5',
    style: { background: '#E5E0CC', borderColor: '#0E0A12', borderWidth: '2px' },
  });
  root.appendChild(profileHeader);

  const tabBar = el('div', {
    class: 'flex rounded-xl p-1 mb-5 gap-1',
    style: { background: '#FFFFFF', border: '1px solid #D7CFB6' },
  });
  root.appendChild(tabBar);

  const content = el('div');
  root.appendChild(content);

  function renderGuest() {
    clear(guestSlot);
    // Three states: guest (no user), TOS-required (user exists but
    // needs to accept current TOS), normal. The chrome is hidden in
    // both gating states so the user can't bypass the gate by
    // clicking around.
    const isGuest = !state.user;
    const tosBlocked = !!state.user && !!state.profile.needsTosAccept;
    const showChrome = !isGuest && !tosBlocked;
    profileHeader.style.display = showChrome ? '' : 'none';
    tabBar.style.display = showChrome ? '' : 'none';
    content.style.display = showChrome ? '' : 'none';
    if (showChrome) return;

    if (tosBlocked) {
      const accept = el('input', {
        type: 'checkbox',
        style: { width: '20px', height: '20px', accentColor: '#7B2EFF', cursor: 'pointer' },
      });
      const status = el('p', { style: { color: '#3D2F4A', fontStyle: 'italic', fontSize: '0.85rem', minHeight: '18px' } });
      const acceptBtn = el('button', {
        class: 'sdz-cta',
        style: { fontSize: '0.95rem', padding: '0.75rem 1.4rem' },
        onClick: async () => {
          if (!accept.checked) {
            status.textContent = 'Please tick the box to confirm.';
            status.style.color = '#CE1F8B';
            return;
          }
          status.textContent = 'Saving…';
          status.style.color = '#3D2F4A';
          try {
            await socket.request('account.acceptTos', {
              version: state.profile.tosCurrentVersion,
            });
            state.profile.needsTosAccept = false;
            renderGuest();
            renderProfile();
            renderContent();
          } catch (err) {
            status.textContent = `Couldn't save: ${err?.message || 'unknown error'}`;
            status.style.color = '#CE1F8B';
          }
        },
      }, 'I ACCEPT  →');

      guestSlot.appendChild(
        el('div', {
          style: {
            background: '#F5F2E5', border: '2px solid #0E0A12',
            borderRadius: '14px', padding: '28px 24px',
          },
        },
          el('h1', {
            class: 'sdz-display',
            style: {
              fontSize: '1.7rem', color: '#0E0A12',
              textShadow: '4px 4px 0 #2EFF8C',
              marginBottom: '12px',
            },
          }, 'Welcome to StemDomeZ.'),
          el('p', { style: { color: '#0E0A12', fontSize: '0.95rem', lineHeight: 1.55, marginBottom: '14px' } },
            'Before you can use your account we need you to agree to our Terms of Service and Privacy Policy. ',
            'These were just rewritten with the rules around photo uploads — please give them a read.'
          ),
          el('div', {
            style: {
              display: 'flex', flexDirection: 'column', gap: '8px',
              padding: '14px 16px', background: '#E5E0CC',
              border: '2px solid #0E0A12', borderRadius: '10px',
              marginBottom: '14px',
            },
          },
            el('a', { href: '/terms', 'data-link': '', target: '_blank', rel: 'noopener', style: { color: '#5A1FCE', fontWeight: 700, textDecoration: 'underline' } }, 'Read the Terms of Service ↗'),
            el('a', { href: '/privacy', 'data-link': '', target: '_blank', rel: 'noopener', style: { color: '#5A1FCE', fontWeight: 700, textDecoration: 'underline' } }, 'Read the Privacy Policy ↗'),
            el('a', { href: '/acceptable-use', 'data-link': '', target: '_blank', rel: 'noopener', style: { color: '#5A1FCE', fontWeight: 700, textDecoration: 'underline' } }, 'Read the Acceptable Use Policy ↗'),
            el('a', { href: '/photo-policy', 'data-link': '', target: '_blank', rel: 'noopener', style: { color: '#5A1FCE', fontWeight: 700, textDecoration: 'underline' } }, 'Read the Photo & Likeness Policy ↗')
          ),
          el('label', {
            style: {
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '12px 14px', background: '#FFFFFF',
              border: '2px solid #0E0A12', borderRadius: '10px',
              cursor: 'pointer', marginBottom: '14px',
            },
          },
            accept,
            el('span', { style: { color: '#0E0A12', fontSize: '0.92rem', lineHeight: 1.45, fontWeight: 600 } },
              'I am 18 or older. I agree to the Terms of Service, Privacy Policy, Acceptable Use Policy, and Photo & Likeness Policy. ',
              'I will only upload photos of myself, or of another adult who has given me express consent.'
            )
          ),
          acceptBtn,
          status,
          el('p', { style: { marginTop: '14px', fontSize: '0.78rem', color: '#3D2F4A', fontStyle: 'italic' } },
            'Don\'t agree? You can ',
            el('a', { href: '#', onClick: async (e) => {
              e.preventDefault();
              if (!window.confirm('Sign out without accepting? You can come back any time.')) return;
              try { await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); } catch { /* ignore */ }
              window.location.href = '/';
            }, style: { color: '#5A1FCE', textDecoration: 'underline', fontWeight: 700 } }, 'sign out'),
            ' instead — nothing will be saved against your account.'
          )
        )
      );
      return;
    }

    // Guest state — fall through to the existing sign-in card.
    guestSlot.appendChild(
      el(
        'div',
        {
          class: 'rounded-2xl p-8 border text-center',
          style: { background: '#F5F2E5', borderColor: '#0E0A12', borderWidth: '2px' },
        },
        el(
          'h1',
          {
            class: 'sdz-display',
            style: {
              fontSize: '1.6rem',
              color: '#0E0A12',
              textShadow: '4px 4px 0 #2EFF8C',
              marginBottom: '0.75rem',
            },
          },
          'Sign in to see your account.'
        ),
        el(
          'p',
          {
            style: {
              color: '#0E0A12',
              fontSize: '0.95rem',
              maxWidth: '40ch',
              margin: '0 auto 1.5rem',
              lineHeight: 1.5,
            },
          },
          paymentsOff
            ? 'Sign in and your designs, downloads, and saved photos all live here. STL is free for the MVP launch.'
            : 'Sign in and your designs, photos, orders, and downloads all live here.'
        ),
        el(
          'div',
          { class: 'flex justify-center gap-3 flex-wrap' },
          el('a', { href: '/login?next=/account', 'data-link': '', class: 'sdz-cta' }, 'SIGN IN'),
          el('a', { href: '/stemdome-generator', 'data-link': '', class: 'sdz-cta sdz-cta-secondary' }, 'MAKE YOURS  →')
        )
      )
    );
  }

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
            'div',
            { class: 'flex flex-col items-end gap-2' },
            // Admin-only CTA so operators don't have to type /admin
            // by hand. Only renders when the current user has the
            // admin role; guests + regular riders never see it.
            state.user?.role === 'admin'
              ? el(
                  'a',
                  {
                    href: '/admin',
                    'data-link': true,
                    class: 'sdz-cta',
                    style: {
                      fontSize: '0.78rem',
                      padding: '0.5rem 0.9rem',
                    },
                  },
                  'ADMIN PANEL  →'
                )
              : null,
            el(
              'button',
              {
                class: 'flex items-center gap-1.5 transition-colors',
                style: { color: '#3D2F4A', fontSize: '0.8rem' },
                onClick: signOut,
              },
              icon('logOut', { size: 16 }),
              'Sign out'
            )
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
            style: { background: '#E5E0CC', borderColor: '#0E0A12', borderWidth: '2px' },
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
                  : paymentsOff
                    ? el(
                        'span',
                        {
                          class: 'px-1.5 py-0.5 rounded',
                          style: { background: '#2EFF8C', color: '#0E0A12', fontSize: '0.65rem', fontWeight: 800 },
                        },
                        'FREE'
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
              'div.flex.gap-2.flex-wrap',
              // v0.1.42 dual-output: separate download buttons for the
              // head-only STL and the head+cap final. Both show when
              // the design has either (a) been paid for, or (b) the
              // free-MVP flag is on. Each button greys out when its
              // corresponding STL is unavailable:
              //   • "Head" greys out for legacy designs (has_head_stl
              //     === false) — those came from pre-v0.1.42 jobs.
              //   • "Full" greys out when final_failed === true —
              //     boolean step couldn't seat the cap.
              ((d.paid || paymentsOff) && d.has_head_stl !== false)
                ? el(
                    'button',
                    {
                      class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors',
                      style: { borderColor: '#5A1FCE', color: '#5A1FCE', fontSize: '0.75rem', fontWeight: 700 },
                      onClick: () => downloadStl(d, 'head'),
                      title: 'Stage 1.7 watertight head — ready to print on its own',
                    },
                    icon('download', { size: 14 }),
                    'Head'
                  )
                : (d.paid || paymentsOff)
                  ? el(
                      'span',
                      {
                        class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border',
                        style: { borderColor: '#D7CFB6', color: '#9A8E7A', fontSize: '0.7rem', fontStyle: 'italic' },
                        title: 'Head-only STL not available for this scan (pre-v0.1.42).',
                      },
                      'Head —'
                    )
                  : null,
              ((d.paid || paymentsOff) && !d.final_failed)
                ? el(
                    'button',
                    {
                      class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors',
                      style: { borderColor: '#0E0A12', background: '#0E0A12', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 700 },
                      onClick: () => downloadStl(d, 'final'),
                      title: 'Final mesh: head + valve cap',
                    },
                    icon('download', { size: 14 }),
                    'Full'
                  )
                : (d.paid || paymentsOff)
                  ? el(
                      'span',
                      {
                        class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border',
                        style: { borderColor: '#FF2EAB', color: '#FF2EAB', fontSize: '0.7rem', fontStyle: 'italic' },
                        title: `Boolean step failed${d.final_error ? ` (${d.final_error})` : ''} — head STL is still printable.`,
                      },
                      'Full ✗'
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
                  style: {
                    background: '#FFFFFF',
                    color: '#0E0A12',
                    border: '2px solid #0E0A12',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    fontStyle: 'italic',
                    cursor: 'pointer',
                  },
                  onClick: () => deleteDesign(d),
                  'aria-label': `Delete ${d.photo_name || d.filename || 'design'}`,
                },
                icon('trash2', { size: 14 }),
                'Delete'
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
          href: '/stemdome-generator',
          'data-link': true,
          class: 'flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed transition-colors mt-1',
          style: {
            borderColor: '#0E0A12',
            color: '#0E0A12',
            textDecoration: 'none',
            background: '#F5F2E5',
            fontWeight: 700,
            fontStyle: 'italic',
          },
        },
        el('span', { style: { fontSize: '1.2rem' } }, '+'),
        el('span', { style: { fontSize: '0.95rem', letterSpacing: '0.04em', textTransform: 'uppercase' } }, 'Create new design  →')
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
          { class: 'rounded-xl border p-4', style: { background: '#E5E0CC', borderColor: '#0E0A12', borderWidth: '2px' } },
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
          style: { background: '#E5E0CC', borderColor: '#0E0A12', borderWidth: '2px' },
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

    // Password section — opt-in to password login alongside the
    // magic-link default. When the user already has a password, show
    // a "current + new" change form; first-time set lets them pick
    // a password directly (they're signed in via magic-link, so the
    // session already proves account ownership).
    const hasPwd = !!state.profile.hasPassword;
    const newPwd = el('input', {
      type: 'password',
      autocomplete: 'new-password',
      placeholder: 'at least 10 characters',
      class: 'rounded-xl px-4 py-2.5 border',
      style: {
        background: '#FFFFFF', color: '#0E0A12',
        borderColor: '#D7CFB6', fontSize: '0.9rem', outline: 'none',
      },
    });
    const curPwd = el('input', {
      type: 'password',
      autocomplete: 'current-password',
      placeholder: 'current password',
      class: 'rounded-xl px-4 py-2.5 border',
      style: {
        background: '#FFFFFF', color: '#0E0A12',
        borderColor: '#D7CFB6', fontSize: '0.9rem', outline: 'none',
      },
    });
    const pwdStatus = el('p', {
      style: { color: '#3D2F4A', fontSize: '0.8rem', minHeight: '18px' },
    });
    const pwdBtn = el('button', {
      class: 'mt-3 px-5 py-2 rounded-xl transition-all',
      style: {
        background: '#7B2EFF', color: '#FFFFFF',
        fontWeight: 700, fontStyle: 'italic', fontSize: '0.85rem',
        border: '2px solid #0E0A12', cursor: 'pointer',
      },
      onClick: async () => {
        const password = newPwd.value;
        if (password.length < 10) {
          pwdStatus.textContent = 'Password must be at least 10 characters.';
          pwdStatus.style.color = '#CE1F8B';
          return;
        }
        const payload = { password };
        if (hasPwd) payload.currentPassword = curPwd.value;
        pwdStatus.textContent = 'Saving…';
        pwdStatus.style.color = '#3D2F4A';
        try {
          await socket.request('account.setPassword', payload);
          pwdStatus.textContent = hasPwd ? 'Password updated.' : 'Password set. You can sign in with email + password from now on.';
          pwdStatus.style.color = '#1FCE6E';
          newPwd.value = '';
          curPwd.value = '';
          state.profile.hasPassword = true;
          // Re-render so the form swaps to "change" mode.
          renderContent();
        } catch (err) {
          pwdStatus.textContent = err?.message === 'wrong_current_password'
            ? 'Current password is wrong.'
            : `Error: ${err?.message || 'failed to save'}`;
          pwdStatus.style.color = '#CE1F8B';
        }
      },
    }, hasPwd ? 'Change password' : 'Set password');
    const pwdCard = el('div',
      {
        class: 'rounded-2xl border p-5',
        style: { background: '#E5E0CC', borderColor: '#0E0A12', borderWidth: '2px' },
      },
      el('h3.mb-1', { style: { fontWeight: 700, fontSize: '0.95rem' } },
        hasPwd ? 'Change password' : 'Add a password (optional)'),
      el('p', {
        style: { color: '#3D2F4A', fontSize: '0.82rem', marginBottom: '14px' },
      },
        hasPwd
          ? `Last set ${state.profile.passwordSetAt ? new Date(state.profile.passwordSetAt).toLocaleDateString() : 'unknown'}. Magic-link sign-in still works either way.`
          : 'Magic-link sign-in keeps working as the default. Set a password if you’d rather skip the email step.'
      ),
      hasPwd ? el('div', { class: 'flex flex-col gap-2 mb-3' },
        el('label', { style: { color: '#3D2F4A', fontSize: '0.78rem', fontWeight: 600 } }, 'Current password'),
        curPwd
      ) : null,
      el('div', { class: 'flex flex-col gap-2' },
        el('label', { style: { color: '#3D2F4A', fontSize: '0.78rem', fontWeight: 600 } }, hasPwd ? 'New password' : 'Password'),
        newPwd
      ),
      pwdBtn,
      pwdStatus
    );
    wrap.appendChild(pwdCard);

    const prefs = [
      { key: 'order_updates', label: 'Email me when my print ships' },
      { key: 'design_reminders', label: 'Email me reminders to finish a design' },
      { key: 'marketing', label: 'Marketing emails about new features' },
    ];
    const prefBox = el(
      'div',
      {
        class: 'rounded-2xl border p-5',
        style: { background: '#E5E0CC', borderColor: '#0E0A12', borderWidth: '2px' },
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
            style: { background: '#E5E0CC', borderColor: '#0E0A12', borderWidth: '2px' },
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

  async function downloadStl(design, kind = 'final') {
    // In free-MVP mode the design has no purchase row, so the
    // payment-gated stl.download command would 402. Use the
    // login-gated stl.downloadFree command instead.
    // v0.1.42: kind = 'head' | 'final'. The server filename includes
    // the discriminator so users with both files in their Downloads
    // folder can tell which is which.
    const command = paymentsOff ? 'stl.downloadFree' : 'stl.download';
    try {
      const res = await socket.request(command, { designId: design.id, kind });
      const bytes = atob(res.stl_b64);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      const blob = new Blob([buf], { type: 'model/stl' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || (kind === 'head' ? 'StemDomeZ_HeadOnly.stl' : 'StemDomeZ_ValveStem.stl');
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err.message === 'auth_required') {
        window.alert("Please sign in to download — it's free for the MVP launch.");
        window.location.assign(`/login?next=${encodeURIComponent('/account')}`);
        return;
      }
      // Friendlier error for the two specific not-available cases the
      // server can return.
      if (err.message === 'head_stl_not_available') {
        window.alert('Head-only STL is not available for this scan (it predates v0.1.42). Try generating again to get the new dual output.');
        return;
      }
      if (err.message === 'final_stl_not_available') {
        window.alert('The full STL failed during boolean booleans for this scan. Use the "Head" download instead — it\'s still printable on its own.');
        return;
      }
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
    if (!state.user) {
      // Guest — skip profile / designs / orders fetches entirely so
      // the SPA never holds onto a fake identity, then render the
      // sign-in card.
      state.loaded = true;
      renderGuest();
      return;
    }
    try {
      const profile = await socket.request('account.get');
      if (profile) {
        state.profile.displayName = profile.displayName || state.profile.displayName;
        state.profile.email = profile.email || '';
        state.profile.preferences = profile.preferences || {};
        state.profile.emailPrefs = profile.emailPrefs || {};
        state.profile.hasPassword = !!profile.hasPassword;
        state.profile.passwordSetAt = profile.passwordSetAt || null;
        state.profile.needsTosAccept = !!profile.needsTosAccept;
        state.profile.tosCurrentVersion = profile.tosCurrentVersion || null;
      }
    } catch {
      /* ignore */
    }
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
    try {
      const orders = await socket.request('orders.list');
      state.orders = orders || [];
    } catch {
      /* ignore */
    }
    state.loaded = true;
    renderGuest();
    renderProfile();
    renderContent();
  }

  // First paint: hide the auth-only chrome so guests don't flash the
  // empty profile header before loadInitial resolves.
  renderGuest();
  renderProfile();
  renderTabs();
  renderContent();
  loadInitial();

  return { el: root };
}
