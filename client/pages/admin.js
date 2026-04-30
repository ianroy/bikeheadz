// P4-005 / P4-006 / P4-010 / P4-014 — admin dashboard.
//
// Minimum-viable shape: four tabs (Overview, Users, Live, DB) backed by the
// admin.* commands shipped in server/commands/admin.js. A non-admin who
// somehow gets here just sees the "admin only" banner — the server-side
// requireAdmin guard rejects every command with FORBIDDEN_ADMIN_ONLY.

import { el, clear } from '../dom.js';

export function AdminPage({ socket }) {
  const state = {
    activeTab: 'overview',
    summary: null,
    users: [],
    live: null,
    slowQueries: [],
    promos: [],
    flags: [],
    loaded: false,
    isAdmin: null,
  };

  // Pin the admin shell to literal light-theme hexes so dark mode
  // can't flip the page ground to #110A1E and tank every literal
  // ink-muted text colour to ~2.8:1. brandstandards.MD §14:
  // operator-facing chrome is a stable light zone.
  const root = el('main', {
    style: {
      maxWidth: '1100px',
      margin: '32px auto',
      padding: '24px',
      background: '#F5F2E5',
      color: '#0E0A12',
      borderRadius: '14px',
      border: '2px solid #D7CFB6',
    },
  });
  const heading = el(
    'h1',
    {
      class: 'sdz-display',
      style: {
        fontSize: '32px',
        color: '#0E0A12',
        textShadow: '4px 4px 0 #2EFF8C',
        marginBottom: '8px',
      },
    },
    'Admin.'
  );
  const sub = el(
    'p',
    {
      style: {
        color: '#1F1A2E',
        marginBottom: '20px',
        fontSize: '0.95rem',
        fontWeight: 500,
        fontStyle: 'italic',
      },
    },
    'Operator-only dashboard. Every action is audit-logged.'
  );
  const tabBar = el('div', {
    style: {
      display: 'flex',
      gap: '8px',
      marginBottom: '20px',
      borderBottom: '2px solid #0E0A12',
    },
  });
  const content = el('div');
  root.append(heading, sub, tabBar, content);

  function tabBtn(id, label) {
    const active = state.activeTab === id;
    return el(
      'button',
      {
        style: {
          padding: '10px 14px',
          border: 'none',
          background: 'transparent',
          // Ink for inactive tabs (17.48:1 on cream) so they don't
          // read weak vs the active brand-purple. Active gets the
          // bold purple (5.09:1) + a chunky underline.
          color: active ? '#5A1FCE' : '#0E0A12',
          fontSize: '0.95rem',
          fontWeight: active ? 800 : 600,
          fontStyle: 'italic',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          borderBottom: active ? '3px solid #5A1FCE' : '3px solid transparent',
          cursor: 'pointer',
        },
        onClick: () => {
          state.activeTab = id;
          renderTabs();
          renderContent();
        },
      },
      label
    );
  }

  function renderTabs() {
    clear(tabBar);
    tabBar.append(
      tabBtn('overview', 'Overview'),
      tabBtn('users', 'Users'),
      tabBtn('live', 'Live'),
      tabBtn('db', 'DB'),
      tabBtn('promos', 'Promos'),
      tabBtn('flags', 'Flags')
    );
  }

  function card(title, body) {
    return el(
      'section',
      {
        style: {
          background: '#FFFFFF',
          border: '2px solid #0E0A12',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '14px',
        },
      },
      el(
        'h2',
        {
          style: {
            fontSize: '0.95rem',
            fontWeight: 800,
            fontStyle: 'italic',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '14px',
            color: '#0E0A12',
            borderBottom: '2px solid #2EFF8C',
            paddingBottom: '6px',
            display: 'inline-block',
          },
        },
        title
      ),
      body
    );
  }

  function statRow(label, value) {
    // Ink (17.48:1) for both label + value on white. Was ink-muted
    // for the label which only got 9.85:1 — strong AA but read as
    // "the secondary stuff" next to bolded values; bumping both to
    // ink unifies the row visually.
    return el(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid #D7CFB6',
        },
      },
      el(
        'span',
        { style: { color: '#0E0A12', fontSize: '0.92rem', fontWeight: 600 } },
        label
      ),
      el(
        'span',
        { style: { color: '#0E0A12', fontSize: '0.95rem', fontWeight: 800 } },
        value
      )
    );
  }

  function renderOverview() {
    const wrap = el('div');

    // MVP launch toggles — payments + 3rd-party printing options.
    // Sit at the top of the overview because they materially change
    // what the rest of the site looks like.
    wrap.appendChild(card('MVP launch toggles', mvpToggles()));

    if (!state.summary) {
      wrap.appendChild(el('p', { style: { color: '#3D2F4A' } }, state.loaded ? 'No data yet.' : 'Loading…'));
      return wrap;
    }
    const s = state.summary;
    wrap.appendChild(
      card(
        `Last ${s.range}`,
        el(
          'div',
          {},
          statRow('Generations', s.generations.toLocaleString()),
          statRow('Unique users', s.unique_users.toLocaleString()),
          statRow('Purchases (paid)', s.purchases.toLocaleString()),
          statRow('Revenue', `$${(s.revenue_cents / 100).toFixed(2)}`),
          statRow(
            'Cache hit rate',
            s.cache_hit_rate ? `${(s.cache_hit_rate * 100).toFixed(1)}%` : '—'
          )
        )
      )
    );
    return wrap;
  }

  function mvpToggles() {
    return el(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      toggleRow({
        flagKey: 'payments_enabled',
        title: 'Payments',
        onLabel: 'Stripe checkout active — site looks normal',
        offLabel: 'Free MVP mode — Stripe disabled, login-gated free downloads, graffiti graphics',
      }),
      toggleRow({
        flagKey: 'printing_enabled',
        title: '3rd-party printing options',
        onLabel: 'Printed Stem + Pack of 4 visible on the site',
        offLabel: 'Printed Stem + Pack of 4 hidden everywhere',
      }),
      toggleRow({
        flagKey: 'aaa_toggle_enabled',
        title: 'AAA contrast toggle chip',
        onLabel: 'Floating "AAA on/off" chip visible bottom-right of every page',
        offLabel: 'Chip hidden — site renders in standard AA palette',
      })
    );
  }

  function toggleRow({ flagKey, title, onLabel, offLabel }) {
    const flag = state.flags.find((f) => f.key === flagKey);
    const enabled = flag ? !!flag.enabled : true;
    const checkbox = el('input', {
      type: 'checkbox',
      checked: enabled,
      style: {
        width: '22px',
        height: '22px',
        accentColor: '#7B2EFF',
        cursor: 'pointer',
      },
      onChange: async (e) => {
        const next = !!e.target.checked;
        try {
          await socket.request('flags.set', {
            key: flagKey,
            enabled: next,
            percent: flag?.percent || 100,
          });
          await loadInitial();
          renderContent();
        } catch (err) {
          window.alert(err.message);
          e.target.checked = enabled;
        }
      },
    });
    return el(
      'label',
      {
        style: {
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '10px 12px',
          background: '#F5F2E5',
          border: '1px solid #D7CFB6',
          borderRadius: '10px',
          cursor: 'pointer',
        },
      },
      checkbox,
      el(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
        el(
          'span',
          { style: { color: '#0E0A12', fontWeight: 700, fontSize: '0.92rem' } },
          title,
          ' ',
          el(
            'span',
            {
              style: {
                marginLeft: '6px',
                background: enabled ? '#2EFF8C' : '#FF2EAB',
                color: '#0E0A12',
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: '6px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              },
            },
            enabled ? 'On' : 'Off'
          )
        ),
        el(
          'span',
          {
            style: {
              color: '#0E0A12',
              fontSize: '0.85rem',
              lineHeight: 1.45,
              fontWeight: 500,
            },
          },
          enabled ? onLabel : offLabel
        )
      )
    );
  }

  function renderUsers() {
    const wrap = el('div');
    if (!state.users.length) {
      wrap.appendChild(
        el(
          'p',
          { style: { color: '#0E0A12', fontSize: '0.95rem' } },
          state.loaded ? 'No users.' : 'Loading…'
        )
      );
      return wrap;
    }
    const table = el('table', {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        background: '#FFFFFF',
        border: '2px solid #0E0A12',
        borderRadius: '8px',
        overflow: 'hidden',
      },
    });
    table.appendChild(
      el(
        'thead',
        {},
        el(
          'tr',
          { style: { background: '#0E0A12' } },
          ...['Email', 'Role', 'Designs', 'Spend', 'Last login', 'Actions'].map((h) =>
            el(
              'th',
              {
                style: {
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  fontStyle: 'italic',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#2EFF8C',
                },
              },
              h
            )
          )
        )
      )
    );
    const tbody = el('tbody', {});
    for (const u of state.users) {
      tbody.appendChild(
        el(
          'tr',
          { style: { borderTop: '1px solid #D7CFB6' } },
          el(
            'td',
            { style: { padding: '10px 12px', fontSize: '0.9rem', color: '#0E0A12', fontWeight: 600 } },
            u.email
          ),
          el(
            'td',
            { style: { padding: '10px 12px', fontSize: '0.9rem' } },
            el(
              'span',
              {
                style: {
                  background: u.role === 'admin' ? '#7B2EFF' : '#0E0A12',
                  color: '#FFFFFF',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                },
              },
              u.role
            )
          ),
          el(
            'td',
            { style: { padding: '10px 12px', fontSize: '0.9rem', color: '#0E0A12', fontWeight: 600 } },
            String(u.designs)
          ),
          el(
            'td',
            { style: { padding: '10px 12px', fontSize: '0.9rem', color: '#0E0A12', fontWeight: 600 } },
            `$${(Number(u.spend_cents || 0) / 100).toFixed(2)}`
          ),
          el(
            'td',
            { style: { padding: '10px 12px', fontSize: '0.88rem', color: '#0E0A12' } },
            u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'
          ),
          el(
            'td',
            { style: { padding: '10px 12px', fontSize: '0.9rem' } },
            el(
              'button',
              {
                style: {
                  background: '#FFFFFF',
                  color: '#0E0A12',
                  border: '2px solid #0E0A12',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  fontStyle: 'italic',
                  cursor: 'pointer',
                  marginRight: '6px',
                },
                onClick: () => forceLogout(u.id),
              },
              'Force logout'
            )
          )
        )
      );
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function renderLive() {
    const wrap = el('div');
    if (!state.live) {
      wrap.appendChild(
        el('p', { style: { color: '#0E0A12', fontSize: '0.95rem' } }, 'Loading…')
      );
      return wrap;
    }
    wrap.appendChild(
      card(
        'Now',
        el(
          'div',
          {},
          statRow('Active sessions (15min)', String(state.live.sessions))
        )
      )
    );
    if (state.live.recent?.length) {
      wrap.appendChild(
        card(
          'Recent audit_log',
          el(
            'ul',
            { style: { listStyle: 'none', margin: 0, padding: 0 } },
            ...state.live.recent.slice(0, 20).map((a) =>
              el(
                'li',
                {
                  style: {
                    padding: '8px 0',
                    fontSize: '0.88rem',
                    color: '#0E0A12',
                    borderBottom: '1px solid #D7CFB6',
                  },
                },
                el(
                  'span',
                  {
                    style: {
                      color: '#5A1FCE',
                      fontWeight: 700,
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.82rem',
                    },
                  },
                  new Date(a.created_at).toLocaleTimeString()
                ),
                ' ',
                el(
                  'span',
                  { style: { color: '#0E0A12', fontWeight: 800 } },
                  a.action
                ),
                a.target_type
                  ? el(
                      'span',
                      { style: { color: '#0E0A12', fontWeight: 500 } },
                      ` ${a.target_type}=${a.target_id || ''}`
                    )
                  : ''
              )
            )
          )
        )
      );
    }
    return wrap;
  }

  function renderDb() {
    const wrap = el('div');
    if (!state.slowQueries.length) {
      wrap.appendChild(
        el(
          'p',
          { style: { color: '#0E0A12', fontSize: '0.95rem' } },
          'No slow-query data (pg_stat_statements may be off).'
        )
      );
      return wrap;
    }
    wrap.appendChild(
      card(
        'Top mean-time queries',
        el(
          'table',
          { style: { width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' } },
          el(
            'thead',
            {},
            el(
              'tr',
              { style: { background: '#0E0A12' } },
              ...['Query', 'Calls', 'Mean (ms)'].map((h) =>
                el(
                  'th',
                  {
                    style: {
                      textAlign: 'left',
                      padding: '8px 10px',
                      color: '#2EFF8C',
                      fontWeight: 800,
                      fontStyle: 'italic',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                    },
                  },
                  h
                )
              )
            )
          ),
          el(
            'tbody',
            {},
            ...state.slowQueries.map((q) =>
              el(
                'tr',
                { style: { borderBottom: '1px solid #D7CFB6' } },
                el(
                  'td',
                  {
                    style: {
                      padding: '8px 10px',
                      fontFamily: 'ui-monospace, monospace',
                      color: '#0E0A12',
                      fontSize: '0.8rem',
                      maxWidth: '500px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  },
                  q.query
                ),
                el(
                  'td',
                  { style: { padding: '8px 10px', color: '#0E0A12', fontWeight: 700 } },
                  String(q.calls)
                ),
                el(
                  'td',
                  { style: { padding: '8px 10px', color: '#0E0A12', fontWeight: 700 } },
                  Number(q.mean_exec_time).toFixed(2)
                )
              )
            )
          )
        )
      )
    );
    return wrap;
  }

  function renderPromos() {
    const wrap = el('div');
    wrap.appendChild(
      card(
        'Create promo',
        promoForm()
      )
    );
    if (state.promos.length) {
      wrap.appendChild(
        card(
          'Active promos',
          el(
            'ul',
            { style: { listStyle: 'none', margin: 0, padding: 0 } },
            ...state.promos.map((p) =>
              el(
                'li',
                {
                  style: {
                    padding: '10px 0',
                    fontSize: '0.92rem',
                    color: '#0E0A12',
                    borderBottom: '1px solid #D7CFB6',
                  },
                },
                el(
                  'strong',
                  { style: { color: '#5A1FCE', fontFamily: 'ui-monospace, monospace' } },
                  p.code
                ),
                p.percent_off ? ` ${p.percent_off}% off` : ` $${(p.amount_off / 100).toFixed(2)} off`,
                ` — used ${p.used_count}${p.max_uses ? '/' + p.max_uses : ''}`,
                p.expires_at ? ` (expires ${new Date(p.expires_at).toLocaleDateString()})` : ''
              )
            )
          )
        )
      );
    }
    return wrap;
  }

  function promoForm() {
    const codeInput = el('input', { placeholder: 'CODE', style: inputStyle() });
    const pctInput = el('input', { placeholder: 'percent off (1–100)', type: 'number', style: inputStyle() });
    const maxInput = el('input', { placeholder: 'max uses (optional)', type: 'number', style: inputStyle() });
    return el(
      'div',
      {},
      el(
        'div',
        { style: { display: 'flex', gap: '10px', marginBottom: '12px' } },
        codeInput,
        pctInput,
        maxInput
      ),
      el(
        'button',
        {
          // sdz-cta primary CTA — pinned 5.71:1 white-on-#7B2EFF
          // per brandstandards.MD §14.
          class: 'sdz-cta',
          style: { fontSize: '0.85rem', padding: '0.6rem 1.1rem' },
          onClick: async () => {
            try {
              await socket.request('promos.create', {
                code: codeInput.value.trim(),
                percent_off: Number(pctInput.value) || undefined,
                max_uses: Number(maxInput.value) || undefined,
              });
              codeInput.value = '';
              pctInput.value = '';
              maxInput.value = '';
              await loadInitial();
              renderContent();
            } catch (err) {
              window.alert(err.message);
            }
          },
        },
        'CREATE  →'
      )
    );
  }

  function renderFlags() {
    const wrap = el('div');
    if (!state.flags.length) {
      wrap.appendChild(
        el('p', { style: { color: '#0E0A12', fontSize: '0.95rem' } }, 'No flags yet.')
      );
      return wrap;
    }
    wrap.appendChild(
      card(
        'Feature flags',
        el(
          'ul',
          { style: { listStyle: 'none', margin: 0, padding: 0 } },
          ...state.flags.map((f) =>
            el(
              'li',
              {
                style: {
                  padding: '10px 0',
                  fontSize: '0.92rem',
                  color: '#0E0A12',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #D7CFB6',
                },
              },
              el(
                'span',
                { style: { color: '#0E0A12' } },
                el(
                  'strong',
                  { style: { color: '#5A1FCE', fontFamily: 'ui-monospace, monospace' } },
                  f.key
                ),
                f.percent ? ` (${f.percent}%)` : ''
              ),
              el(
                'button',
                {
                  // ON: pinned brand purple bg + white text (5.71:1).
                  // OFF: ink bg + cream text (17.48:1) — readable
                  // both on the white card and on cream paper.
                  style: {
                    background: f.enabled ? '#7B2EFF' : '#0E0A12',
                    color: '#FFFFFF',
                    border: '2px solid #0E0A12',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    fontStyle: 'italic',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  },
                  onClick: async () => {
                    try {
                      await socket.request('flags.set', {
                        key: f.key,
                        enabled: !f.enabled,
                        percent: f.percent || undefined,
                      });
                      await loadInitial();
                      renderContent();
                    } catch (err) {
                      window.alert(err.message);
                    }
                  },
                },
                f.enabled ? 'On' : 'Off'
              )
            )
          )
        )
      )
    );
    return wrap;
  }

  function renderContent() {
    clear(content);
    if (state.isAdmin === false) {
      content.appendChild(
        el(
          'div',
          {
            style: {
              padding: '24px',
              border: '2px solid #0E0A12',
              borderRadius: '12px',
              background: '#FFFFFF',
              color: '#0E0A12',
              fontSize: '0.95rem',
              fontWeight: 600,
            },
          },
          'You need admin permissions to view this page.'
        )
      );
      return;
    }
    if (state.activeTab === 'overview') content.appendChild(renderOverview());
    else if (state.activeTab === 'users') content.appendChild(renderUsers());
    else if (state.activeTab === 'live') content.appendChild(renderLive());
    else if (state.activeTab === 'db') content.appendChild(renderDb());
    else if (state.activeTab === 'promos') content.appendChild(renderPromos());
    else if (state.activeTab === 'flags') content.appendChild(renderFlags());
  }

  async function forceLogout(userId) {
    if (!window.confirm('Force-logout this user?')) return;
    try {
      await socket.request('admin.users.forceLogout', { userId });
      window.alert('Sessions revoked.');
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function loadInitial() {
    try {
      const who = await socket.request('auth.whoami');
      state.isAdmin = who?.user?.role === 'admin';
    } catch {
      state.isAdmin = false;
    }
    if (!state.isAdmin) {
      state.loaded = true;
      return;
    }
    const [summary, users, live, slow, promos, flags] = await Promise.all([
      socket.request('admin.metrics.summary', { range: '30d' }).catch(() => null),
      socket.request('admin.users.list', { page: 1, pageSize: 50 }).catch(() => ({ rows: [] })),
      socket.request('admin.live.now').catch(() => null),
      socket.request('admin.db.slowQueries').catch(() => ({ rows: [] })),
      socket.request('promos.list').catch(() => ({ rows: [] })),
      socket.request('flags.list').catch(() => ({ rows: [] })),
    ]);
    state.summary = summary;
    state.users = users?.rows || [];
    state.live = live;
    state.slowQueries = slow?.rows || [];
    state.promos = promos?.rows || [];
    state.flags = flags?.rows || [];
    state.loaded = true;
  }

  function inputStyle() {
    return {
      padding: '8px 12px',
      border: '2px solid #0E0A12',
      borderRadius: '8px',
      background: '#FFFFFF',
      color: '#0E0A12',
      fontSize: '0.92rem',
      fontWeight: 600,
      flex: 1,
    };
  }

  renderTabs();
  renderContent();
  loadInitial().then(() => renderContent());

  return { el: root };
}
