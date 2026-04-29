// P5-001 / P5-005 — public gallery (showcase).

import { el } from '../dom.js';

export function GalleryPage({ socket }) {
  const root = el('main', { style: { maxWidth: '1100px', margin: '32px auto', padding: '0 24px' } });
  const heading = el(
    'h1',
    { style: { fontSize: '28px', marginBottom: '8px', color: '#7B2EFF' } },
    'Showcase'
  );
  const sub = el(
    'p',
    { style: { color: '#3D2F4A', marginBottom: '24px', lineHeight: 1.5 } },
    'Designs riders chose to share. Hit Remix on any tile to start a new design from those settings.'
  );
  const status = el('p', { 'aria-live': 'polite' });
  const grid = el('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '16px',
    },
  });

  root.append(heading, sub, status, grid);

  socket
    .request('designs.listPublic', { page: 1, pageSize: 24 })
    .then((res) => {
      if (!res.rows.length) {
        status.textContent = 'No public designs yet — yours could be the first.';
        return;
      }
      for (const design of res.rows) {
        grid.appendChild(tile(design));
      }
    })
    .catch((err) => {
      status.textContent = `Couldn't load gallery: ${err.message}`;
    });

  function tile(d) {
    return el(
      'a',
      {
        href: `/d/${d.id}`,
        'data-link': true,
        style: {
          display: 'block',
          background: '#FFFDF8',
          border: '1px solid #D7CFB6',
          borderRadius: '12px',
          padding: '12px',
          textDecoration: 'none',
          color: 'var(--ink, #0E0A12)',
        },
      },
      el('div', {
        style: {
          aspectRatio: '1 / 1',
          background: '#2A1F3D',
          borderRadius: '8px',
          marginBottom: '10px',
        },
      }),
      el(
        'div',
        { style: { fontSize: '14px', fontWeight: 600 } },
        d.display_name || 'A rider'
      ),
      el(
        'div',
        { style: { fontSize: '12px', color: '#3D2F4A' } },
        new Date(d.created_at).toLocaleDateString()
      )
    );
  }

  return { el: root };
}

export function ShareDesignPage({ socket, designId }) {
  const root = el('main', {
    style: { maxWidth: '760px', margin: '32px auto', padding: '0 24px' },
  });
  const heading = el('h1', { style: { fontSize: '26px', color: '#7B2EFF', marginBottom: '8px' } }, '');
  const sub = el('p', { style: { color: '#3D2F4A', marginBottom: '20px' } }, '');
  const ctaRow = el('div', { style: { display: 'flex', gap: '8px', marginTop: '16px' } });
  const placeholder = el('div', {
    style: {
      aspectRatio: '4/3',
      background: '#2A1F3D',
      borderRadius: '12px',
      marginBottom: '12px',
    },
  });
  const status = el('p', { 'aria-live': 'polite' });
  root.append(heading, sub, placeholder, status, ctaRow);

  socket
    .request('designs.openShareLink', { token: designId })
    .then((res) => {
      heading.textContent = res.displayName ? `${res.displayName}'s head` : 'Shared design';
      sub.textContent = 'Tap Remix to make your own with the same settings.';
      ctaRow.append(
        el(
          'a',
          {
            href: `/?remix=${encodeURIComponent(res.designId)}`,
            'data-link': true,
            style: {
              padding: '10px 16px',
              background: '#7B2EFF',
              color: '#FFFFFF',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: 600,
            },
          },
          'Remix'
        ),
        res.username
          ? el(
              'a',
              {
                href: `/u/${res.username}`,
                'data-link': true,
                style: {
                  padding: '10px 16px',
                  background: '#F5F2E5',
                  border: '1px solid #C9C0B0',
                  color: '#0E0A12',
                  borderRadius: '10px',
                  textDecoration: 'none',
                },
              },
              `More from @${res.username}`
            )
          : null
      );
    })
    .catch((err) => {
      heading.textContent = 'This share link no longer works';
      sub.textContent = err.message || 'It may have expired or been revoked.';
    });

  return { el: root };
}
