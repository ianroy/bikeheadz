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

  const root = el('main', {
    style: { maxWidth: '1100px', margin: '32px auto', padding: '0 24px' },
  });
  const heading = el(
    'h1',
    { style: { fontSize: '28px', color: '#7B2EFF', marginBottom: '8px' } },
    'Admin'
  );
  const sub = el(
    'p',
    { style: { color: '#3D2F4A', marginBottom: '20px' } },
    'Operator-only dashboard. Every action is audit-logged.'
  );
  const tabBar = el('div', {
    style: {
      display: 'flex',
      gap: '8px',
      marginBottom: '20px',
      borderBottom: '1px solid #D7CFB6',
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
          color: active ? '#7B2EFF' : '#3D2F4A',
          fontSize: '0.9rem',
          fontWeight: active ? 700 : 500,
          borderBottom: active ? '2px solid #7B2EFF' : '2px solid transparent',
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
          border: '1px solid #D7CFB6',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
        },
      },
      el('h2', { style: { fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#0E0A12' } }, title),
      body
    );
  }

  function statRow(label, value) {
    return el(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #ECE8D6' } },
      el('span', { style: { color: '#3D2F4A', fontSize: '0.85rem' } }, label),
      el('span', { style: { color: '#0E0A12', fontSize: '0.9rem', fontWeight: 600 } }, value)
    );
  }

  function renderOverview() {
    const wrap = el('div');
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

  function renderUsers() {
    const wrap = el('div');
    if (!state.users.length) {
      wrap.appendChild(el('p', { style: { color: '#3D2F4A' } }, state.loaded ? 'No users.' : 'Loading…'));
      return wrap;
    }
    const table = el('table', {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        background: '#FFFFFF',
        border: '1px solid #D7CFB6',
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
          { style: { background: '#E5E0CC' } },
          ...['Email', 'Role', 'Designs', 'Spend', 'Last login', 'Actions'].map((h) =>
            el(
              'th',
              { style: { padding: '10px', textAlign: 'left', fontSize: '0.78rem', color: '#3D2F4A' } },
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
          el('td', { style: { padding: '8px 10px', fontSize: '0.85rem' } }, u.email),
          el(
            'td',
            { style: { padding: '8px 10px', fontSize: '0.85rem' } },
            el(
              'span',
              {
                style: {
                  background: u.role === 'admin' ? 'rgba(123,46,255,0.1)' : '#D7CFB6',
                  color: u.role === 'admin' ? '#7B2EFF' : '#3D2F4A',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                },
              },
              u.role
            )
          ),
          el('td', { style: { padding: '8px 10px', fontSize: '0.85rem' } }, String(u.designs)),
          el(
            'td',
            { style: { padding: '8px 10px', fontSize: '0.85rem' } },
            `$${(Number(u.spend_cents || 0) / 100).toFixed(2)}`
          ),
          el(
            'td',
            { style: { padding: '8px 10px', fontSize: '0.85rem', color: '#3D2F4A' } },
            u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'
          ),
          el(
            'td',
            { style: { padding: '8px 10px', fontSize: '0.85rem' } },
            el(
              'button',
              {
                style: {
                  background: 'transparent',
                  color: '#3D2F4A',
                  border: '1px solid #C9C0B0',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
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
      wrap.appendChild(el('p', { style: { color: '#3D2F4A' } }, 'Loading…'));
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
                { style: { padding: '4px 0', fontSize: '0.8rem', borderBottom: '1px solid #ECE8D6' } },
                el('span', { style: { color: '#3D2F4A' } }, new Date(a.created_at).toLocaleTimeString()),
                ' ',
                el('span', { style: { color: '#0E0A12', fontWeight: 600 } }, a.action),
                a.target_type ? ` ${a.target_type}=${a.target_id || ''}` : ''
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
        el('p', { style: { color: '#3D2F4A' } }, 'No slow-query data (pg_stat_statements may be off).')
      );
      return wrap;
    }
    wrap.appendChild(
      card(
        'Top mean-time queries',
        el(
          'table',
          { style: { width: '100%', fontSize: '0.78rem' } },
          el(
            'thead',
            {},
            el(
              'tr',
              {},
              ...['Query', 'Calls', 'Mean (ms)'].map((h) =>
                el(
                  'th',
                  { style: { textAlign: 'left', padding: '6px', color: '#3D2F4A' } },
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
                {},
                el(
                  'td',
                  { style: { padding: '6px', fontFamily: 'monospace', maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                  q.query
                ),
                el('td', { style: { padding: '6px' } }, String(q.calls)),
                el('td', { style: { padding: '6px' } }, Number(q.mean_exec_time).toFixed(2))
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
                { style: { padding: '6px 0', fontSize: '0.85rem' } },
                el('strong', {}, p.code),
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
        { style: { display: 'flex', gap: '8px', marginBottom: '8px' } },
        codeInput,
        pctInput,
        maxInput
      ),
      el(
        'button',
        {
          style: {
            background: '#7B2EFF',
            color: '#fff',
            border: 'none',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          },
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
        'Create'
      )
    );
  }

  function renderFlags() {
    const wrap = el('div');
    if (!state.flags.length) {
      wrap.appendChild(el('p', { style: { color: '#3D2F4A' } }, 'No flags yet.'));
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
                style: { padding: '6px 0', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' },
              },
              el('span', {}, el('strong', {}, f.key), f.percent ? ` (${f.percent}%)` : ''),
              el(
                'button',
                {
                  style: {
                    background: f.enabled ? '#7B2EFF' : '#D7CFB6',
                    color: f.enabled ? '#fff' : '#0E0A12',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
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
              border: '1px solid #C9C0B0',
              borderRadius: '12px',
              background: '#FFFDF8',
              color: '#3D2F4A',
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
      padding: '6px 10px',
      border: '1px solid #C9C0B0',
      borderRadius: '6px',
      background: '#F5F2E5',
      color: '#0E0A12',
      fontSize: '0.85rem',
      flex: 1,
    };
  }

  renderTabs();
  renderContent();
  loadInitial().then(() => renderContent());

  return { el: root };
}
