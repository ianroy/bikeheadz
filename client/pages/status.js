// X-013 — /status page. Four traffic-light tiles for Node, RunPod,
// Postgres, and Stripe webhook delivery. Calls socket.request('system.health')
// on mount and renders. The server-side handler is cached for 60 s
// (server/commands/system.js) so reloading this page repeatedly doesn't
// fan out four probes per refresh.

import { el, clear } from '../dom.js';

const COLORS = {
  green: { bg: '#E6F4EA', border: '#86C5A0', dot: '#2F855A' },
  red: { bg: '#FBE9E9', border: '#E89A9A', dot: '#C71F1F' },
  amber: { bg: '#FAF1DC', border: '#D8B665', dot: '#7C5E1F' },
  grey: { bg: '#F1ECE2', border: '#C9C0B0', dot: '#6B6157' },
};

function formatUptime(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function tile({ label, color, statusText, detail }) {
  const palette = COLORS[color] || COLORS.grey;
  return el(
    'div',
    {
      style: {
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: '120px',
      },
    },
    el(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      el('span', {
        'aria-hidden': 'true',
        style: {
          width: '12px',
          height: '12px',
          borderRadius: '999px',
          background: palette.dot,
          display: 'inline-block',
          boxShadow: `0 0 0 3px ${palette.dot}22`,
        },
      }),
      el('h2', { style: { fontSize: '15px', fontWeight: 600, margin: 0, color: '#1A1614' } }, label)
    ),
    el(
      'p',
      { style: { margin: 0, fontSize: '14px', color: '#1A1614', fontWeight: 600 } },
      statusText
    ),
    detail
      ? el('p', { style: { margin: 0, fontSize: '12px', color: '#6B6157', lineHeight: 1.5 } }, detail)
      : null
  );
}

function tileForNode(node) {
  if (!node) return tile({ label: 'Node app', color: 'grey', statusText: 'Unknown' });
  return tile({
    label: 'Node app',
    color: node.ok ? 'green' : 'red',
    statusText: node.ok ? 'Healthy' : 'Down',
    detail: `Uptime ${formatUptime(node.uptimeS)}`,
  });
}

function tileForRunpod(runpod) {
  if (!runpod) {
    return tile({
      label: 'RunPod endpoint',
      color: 'grey',
      statusText: 'Not configured',
      detail: 'RUNPOD_ENDPOINT_URL is unset.',
    });
  }
  if (!runpod.reachable) {
    return tile({
      label: 'RunPod endpoint',
      color: 'red',
      statusText: 'Unreachable',
      detail: 'Last ping failed. The pipeline will fall back to the local stub.',
    });
  }
  const latency = typeof runpod.latencyMs === 'number' ? `${runpod.latencyMs} ms ping` : '';
  const color = runpod.latencyMs != null && runpod.latencyMs > 1500 ? 'amber' : 'green';
  return tile({
    label: 'RunPod endpoint',
    color,
    statusText: 'Reachable',
    detail: latency,
  });
}

function tileForDb(dbStatus) {
  if (dbStatus == null) {
    return tile({
      label: 'Postgres',
      color: 'grey',
      statusText: 'Not configured',
      detail: 'DATABASE_URL is unset — running in-memory fallbacks.',
    });
  }
  if (!dbStatus.ok) {
    return tile({
      label: 'Postgres',
      color: 'red',
      statusText: 'Down',
      detail: dbStatus.error || 'SELECT 1 failed.',
    });
  }
  return tile({
    label: 'Postgres',
    color: 'green',
    statusText: 'Healthy',
    detail: typeof dbStatus.latencyMs === 'number' ? `${dbStatus.latencyMs} ms SELECT 1` : '',
  });
}

function tileForStripe(stripeWebhook) {
  if (stripeWebhook === true) {
    return tile({
      label: 'Stripe webhook',
      color: 'green',
      statusText: 'Enabled',
      detail: 'Webhook deliveries are signed and verified.',
    });
  }
  return tile({
    label: 'Stripe webhook',
    color: 'amber',
    statusText: 'Disabled',
    detail:
      'No webhook secret configured. Checkout-return polling is the source of truth (typical for dev).',
  });
}

export function StatusPage({ socket }) {
  const root = el('main', {
    style: {
      maxWidth: '880px',
      margin: '48px auto',
      padding: '0 24px',
      color: 'var(--ink, #1A1614)',
    },
  });

  root.appendChild(
    el('h1', { style: { fontSize: '32px', marginBottom: '8px', color: '#C71F1F' } }, 'System status')
  );
  const subtitle = el(
    'p',
    { style: { color: '#6B6157', fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 } },
    'A live snapshot of the four moving parts that have to be healthy for end-to-end use. Refreshed at most once per minute.'
  );
  root.appendChild(subtitle);

  const status = el('p', {
    'aria-live': 'polite',
    style: { color: '#6B6157', fontSize: '13px', marginBottom: '16px', minHeight: '18px' },
  });
  status.textContent = 'Loading status…';
  root.appendChild(status);

  const grid = el('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
      gap: '16px',
    },
  });
  root.appendChild(grid);

  const meta = el('p', {
    style: { color: '#6B6157', fontSize: '12px', marginTop: '20px' },
  });
  root.appendChild(meta);

  function renderError(message) {
    clear(grid);
    status.textContent = 'Could not load /status.';
    grid.appendChild(
      el(
        'div',
        {
          style: {
            gridColumn: '1 / -1',
            background: COLORS.red.bg,
            border: `1px solid ${COLORS.red.border}`,
            borderRadius: '12px',
            padding: '20px',
            color: '#1A1614',
            fontSize: '14px',
          },
        },
        message ||
          'The /status command failed. The Node app may still be coming online — try refreshing in a moment.'
      )
    );
  }

  function renderHealth(health) {
    clear(grid);
    grid.append(
      tileForNode(health.node),
      tileForRunpod(health.runpod),
      tileForDb(health.db),
      tileForStripe(health.stripe)
    );
    const checkedAt = health.lastChecked ? new Date(health.lastChecked).toLocaleString() : '—';
    status.textContent = `Last checked: ${checkedAt}`;
    meta.textContent = 'Cached for up to 60 seconds — see /changelog for recent reliability work.';
  }

  (async () => {
    try {
      const health = await socket.request('system.health');
      renderHealth(health);
    } catch (err) {
      renderError(err?.message);
    }
  })();

  return { el: root };
}
