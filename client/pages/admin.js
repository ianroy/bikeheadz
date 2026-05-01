// P4-005 / P4-006 / P4-010 / P4-014 — admin dashboard.
//
// Minimum-viable shape: four tabs (Overview, Users, Live, DB) backed by the
// admin.* commands shipped in server/commands/admin.js. A non-admin who
// somehow gets here just sees the "admin only" banner — the server-side
// requireAdmin guard rejects every command with FORBIDDEN_ADMIN_ONLY.

import { el, clear } from '../dom.js';
import { loadChart, CHART_PALETTE, chartTheme } from '../util/chart-loader.js';

export function AdminPage({ socket }) {
  const state = {
    activeTab: 'overview',
    range: '30d',
    summary: null,
    users: [],
    live: null,
    slowQueries: [],
    promos: [],
    flags: [],
    invites: [],
    timeseries: null,
    funnel: null,
    geo: null,
    devices: null,
    referrers: null,
    cohorts: null,
    pipeline: null,
    cost: null,
    emailHealth: null,
    failures: null,
    activity: null,
    loaded: false,
    isAdmin: null,
  };
  // Active Chart.js instances by tab key. Destroyed when the tab
  // unmounts so re-renders don't accumulate canvases.
  const charts = new Map();

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
    tabBar.style.flexWrap = 'wrap';
    [
      ['overview',  'Overview'],
      ['trends',    'Trends'],
      ['funnel',    'Funnel'],
      ['cohorts',   'Cohorts'],
      ['map',       'Map'],
      ['devices',   'Devices'],
      ['referrers', 'Referrers'],
      ['pipeline',  'Pipeline'],
      ['regions',   'Regions'],
      ['costs',     'Costs'],
      ['email',     'Email'],
      ['failures',  'Failures'],
      ['live',      'Live'],
      ['users',     'Users'],
      ['invites',   'Invites'],
      ['db',        'DB'],
      ['promos',    'Promos'],
      ['flags',     'Flags'],
    ].forEach(([id, label]) => tabBar.appendChild(tabBtn(id, label)));
  }

  function card(title, body) {
    return el(
      'section',
      {
        style: {
          background: '#E5E0CC',
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
              'div',
              { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' } },
              // Role dropdown — promote / demote a user. Admin-only,
              // changes session_token_version so the target's
              // sessions invalidate on next handshake.
              el('select', {
                style: {
                  background: '#FFFFFF', color: '#0E0A12',
                  border: '2px solid #0E0A12', borderRadius: '6px',
                  padding: '4px 8px', fontSize: '0.78rem',
                  fontWeight: 700, fontStyle: 'italic', cursor: 'pointer',
                },
                value: u.role || 'user',
                onChange: async (e) => {
                  const next = e.target.value;
                  if (next === u.role) return;
                  if (!window.confirm(`Set ${u.email} role to "${next}"?`)) {
                    e.target.value = u.role; return;
                  }
                  try {
                    await socket.request('admin.users.setRole', { userId: u.id, role: next });
                    await loadInitial();
                    renderContent();
                  } catch (err) { window.alert(err.message); e.target.value = u.role; }
                },
              },
                el('option', { value: 'user' }, 'user'),
                el('option', { value: 'admin' }, 'admin'),
                el('option', { value: 'support' }, 'support')
              ),
              // Send-password-reset.
              el('button', {
                style: {
                  background: '#FFFFFF', color: '#0E0A12',
                  border: '2px solid #0E0A12', borderRadius: '6px',
                  padding: '5px 10px', fontSize: '0.78rem',
                  fontWeight: 700, fontStyle: 'italic', cursor: 'pointer',
                },
                onClick: async () => {
                  if (!window.confirm(`Send a password-reset email to ${u.email}?`)) return;
                  try {
                    const r = await socket.request('admin.users.sendPasswordReset', { userId: u.id });
                    window.alert(r.sent ? `Reset email sent to ${u.email}.` : 'Email not sent (provider unconfigured); the link is in the audit log.');
                  } catch (err) { window.alert(err.message); }
                },
              }, 'Reset password'),
              // Force-logout.
              el('button', {
                style: {
                  background: '#FFFFFF', color: '#0E0A12',
                  border: '2px solid #0E0A12', borderRadius: '6px',
                  padding: '5px 10px', fontSize: '0.78rem',
                  fontWeight: 700, fontStyle: 'italic', cursor: 'pointer',
                },
                onClick: () => forceLogout(u.id),
              }, 'Force logout')
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

  // ── Helpers used by the new dashboard tabs ──────────────────────

  function rangeSelector(onChange) {
    const wrap = el('div', {
      style: {
        display: 'inline-flex', gap: '4px',
        background: '#E5E0CC', border: '2px solid #0E0A12',
        borderRadius: '10px', padding: '3px', marginBottom: '14px',
      },
    });
    ['7d', '30d', '90d'].forEach((r) => {
      const active = state.range === r;
      wrap.appendChild(el('button', {
        style: {
          padding: '6px 12px', border: 'none', cursor: 'pointer',
          background: active ? '#0E0A12' : 'transparent',
          color: active ? '#2EFF8C' : '#0E0A12',
          fontWeight: 800, fontStyle: 'italic',
          fontSize: '0.78rem', letterSpacing: '0.06em',
          textTransform: 'uppercase', borderRadius: '7px',
        },
        onClick: () => { state.range = r; onChange(); },
      }, r));
    });
    return wrap;
  }

  function statBox(label, value, sub) {
    return el('div', {
      style: {
        background: '#E5E0CC', border: '2px solid #0E0A12',
        borderRadius: '12px', padding: '16px',
        flex: '1 1 180px', minWidth: '160px',
      },
    },
      el('div', {
        style: {
          fontSize: '0.7rem', fontWeight: 800, fontStyle: 'italic',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: '#3D2F4A', marginBottom: '6px',
        },
      }, label),
      el('div', {
        class: 'sdz-display',
        style: { fontSize: '1.8rem', color: '#0E0A12', lineHeight: '1' },
      }, value),
      sub ? el('div', {
        style: { fontSize: '0.78rem', color: '#3D2F4A', marginTop: '4px', fontStyle: 'italic' },
      }, sub) : null
    );
  }

  function simpleTable(headers, rows, opts = {}) {
    if (!rows.length) {
      return el('p', { style: { color: '#3D2F4A', fontSize: '0.92rem', fontStyle: 'italic', padding: '14px' } },
        opts.empty || 'No data yet.');
    }
    const t = el('table', {
      style: {
        width: '100%', borderCollapse: 'collapse',
        background: '#E5E0CC', border: '2px solid #0E0A12',
        borderRadius: '8px', overflow: 'hidden',
      },
    });
    t.appendChild(el('thead', {},
      el('tr', { style: { background: '#0E0A12' } },
        ...headers.map((h) => el('th', {
          style: {
            padding: '10px 12px', textAlign: 'left',
            fontSize: '0.78rem', fontWeight: 800, fontStyle: 'italic',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#2EFF8C',
          },
        }, h))
      )
    ));
    const body = el('tbody', {});
    rows.forEach((r) => {
      const tr = el('tr', { style: { borderTop: '1px solid #D7CFB6' } });
      r.forEach((cell, i) => tr.appendChild(el('td', {
        style: {
          padding: '10px 12px', fontSize: '0.88rem',
          color: '#0E0A12', fontWeight: i === 0 ? 700 : 500,
        },
      }, cell == null ? '—' : String(cell))));
      body.appendChild(tr);
    });
    t.appendChild(body);
    return t;
  }

  function makeChart(key, configFactory) {
    const canvas = el('canvas', { style: { width: '100%', maxHeight: '320px' } });
    loadChart().then((Chart) => {
      // Tear down a previous instance for the same key (tab re-renders).
      const prev = charts.get(key);
      if (prev) try { prev.destroy(); } catch { /* ignore */ }
      const cfg = configFactory(Chart);
      const inst = new Chart(canvas.getContext('2d'), cfg);
      charts.set(key, inst);
    }).catch(() => {
      canvas.replaceWith(el('p', {
        style: { color: '#3D2F4A', fontStyle: 'italic', padding: '12px' },
      }, 'Chart failed to load. Check network / CSP.'));
    });
    return canvas;
  }

  function emptyTabPlaceholder(title, msg) {
    return el('div', {
      style: {
        background: '#E5E0CC', border: '2px solid #0E0A12',
        borderRadius: '12px', padding: '24px',
      },
    },
      el('h2', {
        style: {
          fontSize: '0.95rem', fontWeight: 800, fontStyle: 'italic',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          marginBottom: '10px', color: '#0E0A12',
        },
      }, title),
      el('p', { style: { color: '#0E0A12', fontSize: '0.92rem' } }, msg)
    );
  }

  // ── New dashboard tabs ──────────────────────────────────────────

  function renderTrends() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    wrap.appendChild(rangeSelector(loadAndRender));
    if (!state.timeseries) {
      wrap.appendChild(el('p', { style: { color: '#0E0A12' } }, 'Loading…'));
      return wrap;
    }
    const t = chartTheme();
    const s = state.timeseries.series || {};
    const labels = Object.values(s).reduce((acc, arr) => acc.length >= arr.length ? acc : arr.map((r) => r.date), []);
    const datasets = [
      { label: 'Site hits',          key: 'hits',           palette: 0 },
      { label: 'New accounts',       key: 'signups',        palette: 1 },
      { label: 'Photos uploaded',    key: 'photos',         palette: 2 },
      { label: 'TRELLIS jobs',       key: 'jobs_started',   palette: 5 },
      { label: 'Jobs succeeded',     key: 'jobs_succeeded', palette: 3 },
      { label: 'STL downloads',      key: 'stl_downloads',  palette: 4 },
    ].map(({ label, key, palette }) => {
      const p = CHART_PALETTE[palette];
      const dateMap = new Map((s[key] || []).map((r) => [String(r.date), r.count]));
      const data = labels.map((d) => dateMap.get(String(d)) || 0);
      return {
        label, data,
        borderColor: p.stroke, backgroundColor: p.fill,
        borderWidth: 2.4, tension: 0.25, fill: false, pointRadius: 0,
      };
    });
    wrap.appendChild(makeChart('trends', () => ({
      type: 'line',
      data: { labels: labels.map((d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })), datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: t.muted, font: { family: t.family } }, grid: { color: t.grid } },
          y: { ticks: { color: t.muted, font: { family: t.family }, precision: 0 }, grid: { color: t.grid }, beginAtZero: true },
        },
        plugins: {
          legend: { labels: { color: t.ink, font: { family: t.family, weight: 'bold' } } },
        },
      },
    })));
    return wrap;
  }

  function renderFunnel() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    wrap.appendChild(rangeSelector(loadAndRender));
    if (!state.funnel) { wrap.appendChild(el('p', {}, 'Loading…')); return wrap; }
    const t = chartTheme();
    const steps = state.funnel.steps || [];
    const top = steps[0]?.n || 1;
    const labels = steps.map((s) => s.label);
    const counts = steps.map((s) => s.n);
    wrap.appendChild(makeChart('funnel', () => ({
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Count',
          data: counts,
          backgroundColor: CHART_PALETTE[0].fill,
          borderColor: CHART_PALETTE[0].stroke,
          borderWidth: 2,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: { x: { beginAtZero: true, ticks: { color: t.muted } }, y: { ticks: { color: t.ink, font: { weight: 'bold' } } } },
        plugins: { legend: { display: false } },
      },
    })));
    wrap.appendChild(simpleTable(
      ['Step', 'Count', '% of step 1', 'Drop-off vs prev'],
      steps.map((s, i) => {
        const pct = top ? ((s.n / top) * 100).toFixed(1) + '%' : '—';
        const drop = i > 0 && steps[i - 1].n
          ? `${(((steps[i - 1].n - s.n) / steps[i - 1].n) * 100).toFixed(1)}%`
          : '—';
        return [s.label, s.n.toLocaleString(), pct, drop];
      })
    ));
    return wrap;
  }

  function renderCohorts() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    if (!state.cohorts) { wrap.appendChild(el('p', {}, 'Loading…')); return wrap; }
    const rows = state.cohorts.rows || [];
    wrap.appendChild(simpleTable(
      ['Cohort (week)', 'Size', 'Day 0', 'Day 1', 'Day 7', 'Day 30'],
      rows.map((r) => [
        new Date(r.cohort).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        r.size,
        r.size ? `${r.d0} (${((r.d0 / r.size) * 100).toFixed(0)}%)` : r.d0,
        r.size ? `${r.d1} (${((r.d1 / r.size) * 100).toFixed(0)}%)` : r.d1,
        r.size ? `${r.d7} (${((r.d7 / r.size) * 100).toFixed(0)}%)` : r.d7,
        r.size ? `${r.d30} (${((r.d30 / r.size) * 100).toFixed(0)}%)` : r.d30,
      ]),
      { empty: 'No cohort data yet — comes online once page-views start populating.' }
    ));
    return wrap;
  }

  function renderMap() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    wrap.appendChild(rangeSelector(loadAndRender));
    if (!state.geo) { wrap.appendChild(el('p', {}, 'Loading…')); return wrap; }
    const rows = state.geo.rows || [];
    if (!rows.length) {
      wrap.appendChild(el('p', { style: { color: '#0E0A12', fontStyle: 'italic' } },
        'No geo data yet — comes online once page-views populate.'));
      return wrap;
    }
    // Country roll-up + top cities. Phase 2D will swap the table for an
    // SVG choropleth + dot-density map; for the launch this is the
    // fastest route to readable data.
    const byCountry = new Map();
    rows.forEach((r) => {
      const c = r.country || '??';
      byCountry.set(c, (byCountry.get(c) || 0) + Number(r.n || 0));
    });
    const countries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
    wrap.appendChild(el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '12px' } },
      statBox('Countries seen', String(byCountry.size), `${rows.length.toLocaleString()} unique cities`),
      statBox('Top country', countries[0]?.[0] || '—', `${(countries[0]?.[1] || 0).toLocaleString()} hits`)
    ));
    wrap.appendChild(simpleTable(
      ['Country', 'Hits'],
      countries.map(([c, n]) => [c, n.toLocaleString()])
    ));
    wrap.appendChild(el('h3', {
      style: { fontSize: '0.9rem', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0E0A12', marginTop: '14px' },
    }, 'Top cities'));
    wrap.appendChild(simpleTable(
      ['City', 'Country', 'Hits', 'Last seen'],
      rows.slice(0, 50).map((r) => [
        r.city || '—',
        r.country || '—',
        Number(r.n).toLocaleString(),
        r.last_seen ? new Date(r.last_seen).toLocaleString() : '—',
      ])
    ));
    return wrap;
  }

  function renderDevices() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    wrap.appendChild(rangeSelector(loadAndRender));
    if (!state.devices) { wrap.appendChild(el('p', {}, 'Loading…')); return wrap; }
    const t = chartTheme();
    const sections = [
      ['Device kind', 'devices', 'devices', state.devices.devices || []],
      ['Operating system', 'oses', 'oses', state.devices.oses || []],
      ['Browser', 'browsers', 'browsers', state.devices.browsers || []],
    ];
    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' } });
    sections.forEach(([title, key, _kind, rows]) => {
      const card = el('div', {
        style: { background: '#E5E0CC', border: '2px solid #0E0A12', borderRadius: '12px', padding: '16px' },
      });
      card.appendChild(el('h3', {
        style: { fontSize: '0.9rem', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0E0A12', marginBottom: '10px' },
      }, title));
      if (!rows.length) {
        card.appendChild(el('p', { style: { color: '#3D2F4A', fontStyle: 'italic' } }, 'No data.'));
      } else {
        const labels = rows.map((r) => r.k);
        const data = rows.map((r) => r.n);
        card.appendChild(makeChart(`devices-${key}`, () => ({
          type: 'doughnut',
          data: { labels, datasets: [{
            data,
            backgroundColor: labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length].stroke),
            borderColor: '#0E0A12', borderWidth: 1.5,
          }] },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: t.ink, font: { family: t.family, weight: 'bold', size: 11 } } } },
          },
        })));
      }
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  function renderReferrers() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    wrap.appendChild(rangeSelector(loadAndRender));
    if (!state.referrers) { wrap.appendChild(el('p', {}, 'Loading…')); return wrap; }
    const rows = state.referrers.rows || [];
    wrap.appendChild(simpleTable(
      ['Referrer host', 'Hits', 'Unique visitors'],
      rows.map((r) => [r.host, Number(r.n).toLocaleString(), Number(r.unique_visitors).toLocaleString()]),
      { empty: 'No referrer data yet.' }
    ));
    return wrap;
  }

  function renderPipeline() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
    wrap.appendChild(rangeSelector(loadAndRender));
    if (!state.pipeline) { wrap.appendChild(el('p', {}, 'Loading…')); return wrap; }
    const p = state.pipeline;
    wrap.appendChild(el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '14px' } },
      statBox('Jobs in range', (p.total || 0).toLocaleString(), null),
      statBox('Watertight rate', (p.watertight_pct || 0).toFixed(1) + '%', 'after stage 5'),
      statBox('Auto-retry rate', (p.retried_pct || 0).toFixed(1) + '%', 'stage-3 thin-walls'),
    ));
    const t = chartTheme();
    const buckets = (p.tri_buckets || []).map((b) => ({ x: b.bucket, n: b.n }));
    if (buckets.length) {
      wrap.appendChild(el('h3', {
        style: { fontSize: '0.9rem', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0E0A12' },
      }, 'Triangle-count distribution'));
      wrap.appendChild(makeChart('pipeline-hist', () => ({
        type: 'bar',
        data: {
          labels: buckets.map((b) => `≤ ${b.x * 10}k tris`),
          datasets: [{ label: 'Jobs', data: buckets.map((b) => b.n), backgroundColor: CHART_PALETTE[2].fill, borderColor: CHART_PALETTE[2].stroke, borderWidth: 2 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { x: { ticks: { color: t.muted } }, y: { beginAtZero: true, ticks: { color: t.muted, precision: 0 } } },
          plugins: { legend: { display: false } },
        },
      })));
    }
    return wrap;
  }

  // Region win-rate dashboard. Surfaces the per-endpoint counters
  // accumulated by server/workers/runpod-client.js when racing
  // multiple RUNPOD_ENDPOINT_URLS regions. Pie = lifetime wins;
  // table = full breakdown (submits / wins / losses / errors / live
  // reachability). Manual refresh button — telemetry is in-memory and
  // updates live, so a full re-fetch is enough.
  function renderRegions() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });

    const refreshBtn = el('button', {
      style: {
        alignSelf: 'flex-start',
        padding: '8px 14px',
        background: '#5A1FCE',
        color: '#FFFFFF',
        border: '2px solid #0E0A12',
        boxShadow: '3px 3px 0 #0E0A12',
        fontFamily: 'ui-monospace, monospace',
        fontWeight: 700,
        fontSize: '0.85rem',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      },
      onClick: async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Refreshing…';
        try {
          state.runpod = await socket.request('admin.metrics.runpod');
        } catch { /* leave previous data */ }
        renderContent();
      },
    }, '↻ Refresh');
    wrap.appendChild(refreshBtn);

    if (!state.runpod) {
      wrap.appendChild(el('p', {}, 'Loading…'));
      return wrap;
    }

    const endpoints = state.runpod.endpoints || [];
    const ping = state.runpod.ping || { endpoints: [] };

    if (endpoints.length === 0 && (ping.endpoints || []).length === 0) {
      wrap.appendChild(emptyTabPlaceholder(
        'No RunPod endpoints configured',
        'Set RUNPOD_ENDPOINT_URLS (comma-separated) on DigitalOcean to enable multi-region racing. Telemetry will start populating after the first generation.'
      ));
      return wrap;
    }

    // Top stat row — total submits / total wins / endpoints active.
    const totalSubmits = endpoints.reduce((s, e) => s + (e.submits || 0), 0);
    const totalWins    = endpoints.reduce((s, e) => s + (e.wins    || 0), 0);
    const totalErrors  = endpoints.reduce((s, e) => s + (e.errors  || 0), 0);
    const reachableCount = (ping.endpoints || []).filter((e) => e.reachable).length;
    const configured     = (ping.endpoints || []).length;

    wrap.appendChild(el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '14px' } },
      statBox('Endpoints', `${reachableCount} / ${configured}`, 'reachable now'),
      statBox('Total submits', totalSubmits.toLocaleString(), 'jobs raced since boot'),
      statBox('Total wins', totalWins.toLocaleString(), `${totalErrors} errors`),
    ));

    // Pie chart — wins per endpoint.
    if (totalWins > 0) {
      const t = chartTheme();
      const labels = endpoints.map((e) => e.id);
      const wins   = endpoints.map((e) => e.wins || 0);
      const colors = labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]);

      wrap.appendChild(el('h3', {
        style: { fontSize: '0.9rem', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0E0A12' },
      }, 'Race wins by region'));

      wrap.appendChild(makeChart('runpod-wins', () => ({
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: wins,
            backgroundColor: colors.map((c) => c.fill),
            borderColor: colors.map((c) => c.stroke),
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { color: t.muted, font: { family: 'ui-monospace' } } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const pct = totalWins ? ((ctx.parsed / totalWins) * 100).toFixed(1) : '0.0';
                  return `${ctx.label}: ${ctx.parsed} wins (${pct}%)`;
                },
              },
            },
          },
        },
      })));
    } else if (totalSubmits === 0) {
      wrap.appendChild(el('p', {
        style: { color: '#3D2F4A', fontStyle: 'italic', padding: '12px' },
      }, 'No races yet. Telemetry will populate after the first generation.'));
    }

    // Per-endpoint table.
    wrap.appendChild(el('h3', {
      style: { fontSize: '0.9rem', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0E0A12', marginTop: '8px' },
    }, 'Per-endpoint breakdown'));

    // Merge ping reachability into the telemetry rows so configured-but-
    // never-raced endpoints still show up.
    const byUrl = new Map(endpoints.map((e) => [e.url, e]));
    for (const p of (ping.endpoints || [])) {
      if (!byUrl.has(p.base)) {
        byUrl.set(p.base, {
          url: p.base, id: p.id, submits: 0, wins: 0, losses: 0, errors: 0,
          lastWinAt: null, lastWinLatencyMs: null, lastErrorAt: null,
        });
      }
    }
    const reachByUrl = new Map((ping.endpoints || []).map((e) => [e.base, e]));

    const rows = Array.from(byUrl.values()).map((e) => {
      const reach = reachByUrl.get(e.url);
      const winPct = e.submits ? ((e.wins / e.submits) * 100).toFixed(1) + '%' : '—';
      const reachLabel = reach
        ? (reach.reachable ? `✓ ${reach.latencyMs ?? '?'}ms` : '✗ unreachable')
        : '—';
      const lastWin = e.lastWinAt
        ? new Date(e.lastWinAt).toLocaleString()
        : '—';
      return [
        e.id,
        reachLabel,
        (e.submits || 0).toLocaleString(),
        (e.wins || 0).toLocaleString(),
        (e.losses || 0).toLocaleString(),
        (e.errors || 0).toLocaleString(),
        winPct,
        e.lastWinLatencyMs != null ? `${e.lastWinLatencyMs}ms` : '—',
        lastWin,
      ];
    });

    wrap.appendChild(simpleTable(
      ['Endpoint ID', 'Reachable', 'Submits', 'Wins', 'Losses', 'Errors', 'Win-rate', 'Last win latency', 'Last win'],
      rows,
      { empty: 'No endpoints to show.' }
    ));

    wrap.appendChild(el('p', {
      style: { color: '#3D2F4A', fontStyle: 'italic', fontSize: '0.85rem', padding: '12px 0 0' },
    },
      'Counters are in-memory; they reset whenever the DigitalOcean app restarts. ',
      'Win-rate = wins / submits — values close to 50/50 mean both regions are healthy ',
      'and load is naturally balanced. A lopsided ratio means the losing region is ',
      'cold-starting / queued / unreachable on most jobs.'
    ));

    return wrap;
  }

  function renderCosts() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
    wrap.appendChild(rangeSelector(loadAndRender));
    if (!state.cost) { wrap.appendChild(el('p', {}, 'Loading…')); return wrap; }
    const c = state.cost;
    const stripeFee = (c.paid_revenue || 0) * 0.029 + (c.paid_count || 0) * 30; // ~2.9% + 30¢
    wrap.appendChild(el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '14px' } },
      statBox('Paid revenue', `$${((c.paid_revenue || 0) / 100).toFixed(2)}`, `${(c.paid_count || 0).toLocaleString()} purchases`),
      statBox('Stripe fees (est.)', `$${(stripeFee / 100).toFixed(2)}`, '2.9% + 30¢ per txn'),
      statBox('Emails sent', (c.email_count || 0).toLocaleString(), 'Resend free tier: 100/day, 3,000/mo'),
    ));
    return wrap;
  }

  function renderEmail() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
    wrap.appendChild(rangeSelector(loadAndRender));
    if (!state.emailHealth) { wrap.appendChild(el('p', {}, 'Loading…')); return wrap; }
    const e = state.emailHealth;
    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' } });
    grid.appendChild(el('div', {},
      el('h3', { style: { fontSize: '0.9rem', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0E0A12', marginBottom: '8px' } }, 'By template'),
      simpleTable(['Template', 'Count'], (e.by_template || []).map((r) => [r.template, Number(r.n).toLocaleString()]))
    ));
    grid.appendChild(el('div', {},
      el('h3', { style: { fontSize: '0.9rem', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0E0A12', marginBottom: '8px' } }, 'By type'),
      simpleTable(['Type', 'Count'], (e.by_type || []).map((r) => [r.type, Number(r.n).toLocaleString()]))
    ));
    wrap.appendChild(grid);
    return wrap;
  }

  function renderFailures() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    if (!state.failures) { wrap.appendChild(el('p', {}, 'Loading…')); return wrap; }
    const rows = state.failures.rows || [];
    wrap.appendChild(simpleTable(
      ['When', 'Action', 'Target', 'Detail'],
      rows.map((r) => [
        new Date(r.created_at).toLocaleString(),
        r.action,
        r.target_type ? `${r.target_type}=${r.target_id || ''}` : '—',
        (() => {
          try { return JSON.stringify(r.metadata); }
          catch { return '—'; }
        })().slice(0, 120),
      ]),
      { empty: 'No failures captured. Comes online when stl.generate audits land.' }
    ));
    return wrap;
  }

  function renderActivity() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    const acts = (state.activity?.rows) || (state.live?.recent) || [];
    if (!acts.length) { wrap.appendChild(el('p', {}, 'Loading…')); return wrap; }
    if (state.live) {
      wrap.appendChild(card('Now',
        el('div', {}, statRow('Active sessions (15min)', String(state.live.sessions || 0)))
      ));
    }
    wrap.appendChild(card('Recent activity',
      el('ul', { style: { listStyle: 'none', margin: 0, padding: 0 } },
        ...acts.slice(0, 50).map((a) => el('li', {
          style: { padding: '8px 0', fontSize: '0.88rem', color: '#0E0A12', borderBottom: '1px solid #D7CFB6' },
        },
          el('span', {
            style: { color: '#5A1FCE', fontWeight: 700, fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem', marginRight: '8px' },
          }, new Date(a.created_at).toLocaleTimeString()),
          el('span', { style: { color: '#0E0A12', fontWeight: 800, marginRight: '8px' } }, a.action),
          a.target_type ? el('span', { style: { color: '#0E0A12' } }, ` ${a.target_type}=${a.target_id || ''}`) : '',
          a.geo_country ? el('span', { style: { color: '#3D2F4A', marginLeft: '8px', fontStyle: 'italic' } }, ` · ${a.geo_country}${a.geo_city ? ', ' + a.geo_city : ''}`) : ''
        ))
      )
    ));
    return wrap;
  }

  function renderInvites() {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
    // Send-an-invite form
    const emailInput = el('input', { type: 'email', placeholder: 'recipient@example.com', style: inputStyle() });
    const messageInput = el('input', { type: 'text', placeholder: 'optional personal note', style: inputStyle() });
    const sendBtn = el('button', {
      class: 'sdz-cta',
      style: { fontSize: '0.85rem', padding: '0.6rem 1.1rem' },
      onClick: async () => {
        const email = emailInput.value.trim();
        if (!email) return;
        try {
          const result = await socket.request('admin.invites.send', {
            email, message: messageInput.value.trim() || undefined,
          });
          emailInput.value = ''; messageInput.value = '';
          window.alert(result.sent ? `Invite sent to ${email}.` : `Invite created (email backend was '${result.invite ? 'console' : 'unavailable'}').`);
          await loadInitial();
          renderContent();
        } catch (err) { window.alert(err.message); }
      },
    }, 'SEND INVITE  →');

    wrap.appendChild(card('Send an invite',
      el('div', {},
        el('div', { style: { display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' } }, emailInput, messageInput),
        sendBtn,
        el('p', { style: { fontSize: '0.78rem', color: '#3D2F4A', marginTop: '10px', fontStyle: 'italic' } },
          'Email comes from noreply@stemdomez.com via Resend. Recipient gets a single-use accept link valid for 7 days.')
      )
    ));

    if (state.invites && state.invites.length) {
      wrap.appendChild(card('Sent invites',
        simpleTable(
          ['Email', 'Sent by', 'Sent', 'Status'],
          state.invites.map((i) => [
            i.email,
            i.sent_by_email || 'system',
            new Date(i.sent_at).toLocaleDateString(),
            i.accepted_at ? 'Accepted ' + new Date(i.accepted_at).toLocaleDateString()
              : (new Date(i.expires_at) < new Date() ? 'Expired' : 'Pending'),
          ])
        )
      ));
    }
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
    // Tear down any chart instances bound to the previous tab so
    // canvases don't accumulate as the operator clicks around.
    charts.forEach((c) => { try { c.destroy(); } catch { /* ignore */ } });
    charts.clear();

    const t = state.activeTab;
    if (t === 'overview') content.appendChild(renderOverview());
    else if (t === 'trends') content.appendChild(renderTrends());
    else if (t === 'funnel') content.appendChild(renderFunnel());
    else if (t === 'cohorts') content.appendChild(renderCohorts());
    else if (t === 'map') content.appendChild(renderMap());
    else if (t === 'devices') content.appendChild(renderDevices());
    else if (t === 'referrers') content.appendChild(renderReferrers());
    else if (t === 'pipeline') content.appendChild(renderPipeline());
    else if (t === 'regions') content.appendChild(renderRegions());
    else if (t === 'costs') content.appendChild(renderCosts());
    else if (t === 'email') content.appendChild(renderEmail());
    else if (t === 'failures') content.appendChild(renderFailures());
    else if (t === 'live') content.appendChild(renderActivity());
    else if (t === 'users') content.appendChild(renderUsers());
    else if (t === 'invites') content.appendChild(renderInvites());
    else if (t === 'db') content.appendChild(renderDb());
    else if (t === 'promos') content.appendChild(renderPromos());
    else if (t === 'flags') content.appendChild(renderFlags());
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
    const r = state.range;
    const [
      summary, users, live, slow, promos, flags, invites,
      timeseries, funnel, geo, devices, referrers, cohorts,
      pipeline, cost, emailHealth, failures, activity, runpod,
    ] = await Promise.all([
      socket.request('admin.metrics.summary', { range: r }).catch(() => null),
      socket.request('admin.users.list', { page: 1, pageSize: 50 }).catch(() => ({ rows: [] })),
      socket.request('admin.live.now').catch(() => null),
      socket.request('admin.db.slowQueries').catch(() => ({ rows: [] })),
      socket.request('promos.list').catch(() => ({ rows: [] })),
      socket.request('flags.list').catch(() => ({ rows: [] })),
      socket.request('admin.invites.list').catch(() => ({ rows: [] })),
      socket.request('admin.metrics.timeseries', { range: r }).catch(() => null),
      socket.request('admin.metrics.funnel', { range: r }).catch(() => null),
      socket.request('admin.metrics.geo', { range: r }).catch(() => null),
      socket.request('admin.metrics.devices', { range: r }).catch(() => null),
      socket.request('admin.metrics.referrers', { range: r }).catch(() => null),
      socket.request('admin.metrics.cohorts').catch(() => null),
      socket.request('admin.metrics.pipeline', { range: r }).catch(() => null),
      socket.request('admin.metrics.cost', { range: r }).catch(() => null),
      socket.request('admin.metrics.email', { range: r }).catch(() => null),
      socket.request('admin.metrics.failures').catch(() => null),
      socket.request('admin.metrics.activity').catch(() => null),
      socket.request('admin.metrics.runpod').catch(() => null),
    ]);
    state.summary = summary;
    state.users = users?.rows || [];
    state.live = live;
    state.slowQueries = slow?.rows || [];
    state.promos = promos?.rows || [];
    state.flags = flags?.rows || [];
    state.invites = invites?.rows || [];
    state.timeseries = timeseries;
    state.funnel = funnel;
    state.geo = geo;
    state.devices = devices;
    state.referrers = referrers;
    state.cohorts = cohorts;
    state.pipeline = pipeline;
    state.cost = cost;
    state.emailHealth = emailHealth;
    state.failures = failures;
    state.activity = activity;
    state.runpod = runpod;
    state.loaded = true;
  }

  // Range-selector callback: re-fetch the metrics that depend on the
  // current range, then redraw whatever tab the operator is on.
  async function loadAndRender() {
    const r = state.range;
    try {
      const [timeseries, funnel, geo, devices, referrers, pipeline, cost, emailHealth] =
        await Promise.all([
          socket.request('admin.metrics.timeseries', { range: r }).catch(() => null),
          socket.request('admin.metrics.funnel', { range: r }).catch(() => null),
          socket.request('admin.metrics.geo', { range: r }).catch(() => null),
          socket.request('admin.metrics.devices', { range: r }).catch(() => null),
          socket.request('admin.metrics.referrers', { range: r }).catch(() => null),
          socket.request('admin.metrics.pipeline', { range: r }).catch(() => null),
          socket.request('admin.metrics.cost', { range: r }).catch(() => null),
          socket.request('admin.metrics.email', { range: r }).catch(() => null),
        ]);
      state.timeseries = timeseries;
      state.funnel = funnel;
      state.geo = geo;
      state.devices = devices;
      state.referrers = referrers;
      state.pipeline = pipeline;
      state.cost = cost;
      state.emailHealth = emailHealth;
    } catch { /* ignore */ }
    renderContent();
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
