// P1-001 — magic-link login + first-time signup (same flow). The page
// works with or without a real email provider: in dev the server returns
// `devUrl` and we render a clickable button so QA can finish the loop
// without a Resend account.

import { el } from '../dom.js';

export function LoginPage({ socket, query }) {
  const root = el('main', {
    style: {
      maxWidth: '480px',
      margin: '64px auto',
      padding: '0 24px',
      color: 'var(--ink, #1A1614)',
    },
  });

  const card = el(
    'div',
    {
      style: {
        background: '#FFFDF8',
        border: '1px solid #E5DFD3',
        borderRadius: '14px',
        padding: '32px 28px',
        boxShadow: '0 6px 18px rgba(34, 24, 12, 0.06)',
      },
    }
  );

  const heading = el(
    'h1',
    { style: { fontSize: '24px', marginBottom: '8px', color: '#C71F1F' } },
    'Sign in to BikeHeadz'
  );
  const sub = el(
    'p',
    { style: { color: '#6B6157', marginBottom: '24px', lineHeight: 1.5 } },
    'We’ll email you a one-time link. No password to remember.'
  );

  const status = el('p', { 'aria-live': 'polite', style: { minHeight: '20px', marginBottom: '12px', color: '#1A1614' } });

  const input = el('input', {
    type: 'email',
    name: 'email',
    autocomplete: 'email',
    required: true,
    placeholder: 'rider@example.com',
    style: {
      width: '100%',
      padding: '12px 14px',
      fontSize: '16px',
      border: '1px solid #C9C0B0',
      borderRadius: '10px',
      marginBottom: '12px',
      background: '#FAF7F2',
      color: '#1A1614',
    },
  });

  const submit = el(
    'button',
    {
      type: 'submit',
      style: {
        width: '100%',
        padding: '12px',
        fontSize: '16px',
        background: '#C71F1F',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '10px',
        fontWeight: '600',
        cursor: 'pointer',
      },
    },
    'Email me a sign-in link'
  );

  const devLinkContainer = el('div', { style: { marginTop: '16px' } });

  const form = el(
    'form',
    {
      onSubmit: async (e) => {
        e.preventDefault();
        const email = input.value.trim();
        if (!email) return;
        status.textContent = 'Sending…';
        submit.disabled = true;
        try {
          const result = await socket.request('auth.requestMagicLink', {
            email,
            redirectTo: query?.next || '/account',
          });
          status.textContent = 'Check your inbox — link expires in 15 minutes.';
          if (result.devUrl) {
            const link = el(
              'a',
              {
                href: result.devUrl,
                style: {
                  display: 'inline-block',
                  padding: '8px 12px',
                  background: '#FAF7F2',
                  border: '1px dashed #C9C0B0',
                  color: '#7C5E1F',
                  borderRadius: '8px',
                  fontSize: '13px',
                  textDecoration: 'none',
                },
              },
              'Dev mode: open magic-link directly'
            );
            devLinkContainer.replaceChildren(link);
          }
        } catch (err) {
          status.textContent = `Error: ${err?.message || 'something went wrong'}`;
        } finally {
          submit.disabled = false;
        }
      },
    },
    el('label', { for: 'email', style: { display: 'block', marginBottom: '8px', fontSize: '14px' } }, 'Email'),
    input,
    submit
  );

  if (query?.auth === 'expired') {
    status.textContent = 'That sign-in link expired. Request a fresh one.';
  }

  card.append(heading, sub, status, form, devLinkContainer);
  root.appendChild(card);
  return { el: root };
}
