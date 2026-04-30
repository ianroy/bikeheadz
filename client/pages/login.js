// P1-001 — magic-link login + first-time signup (same flow), now also
// supporting dual-mode auth: opt-in password login alongside the
// magic-link default, plus invite-code consume when the page is
// loaded with ?invite=<code>.
//
// Modes (keyed off `state.mode`):
//   - magic    : email-only field → email me a sign-in link (default)
//   - password : email + password → POST auth.loginWithPassword
//   - reset    : email-only field → email me a password-reset link
//
// `?invite=<code>` short-circuits all of the above: we call
// auth.consumeInvite immediately on mount, set the session cookie,
// and redirect to /account.

import { el, clear } from '../dom.js';

export function LoginPage({ socket, query }) {
  const root = el('main', {
    style: {
      maxWidth: '480px',
      margin: '64px auto',
      padding: '0 24px',
      color: '#0E0A12',
    },
  });

  // Invite consume — happens before the form even mounts. Single-use
  // link from admin.invites.send. On success drop the session cookie
  // (set by the server) and redirect to /account.
  if (query?.invite) {
    return acceptInviteFlow(root, query.invite, socket);
  }

  const card = el('div', {
    style: {
      background: '#FFFFFF',
      border: '3px solid #0E0A12',
      borderRadius: '14px',
      padding: '32px 28px',
      boxShadow: '0 6px 18px rgba(34, 24, 12, 0.06)',
    },
  });

  const heading = el('h1', {
    class: 'sdz-display',
    style: {
      fontSize: '24px',
      marginBottom: '8px',
      color: '#0E0A12',
      textShadow: '3px 3px 0 #2EFF8C',
    },
  }, 'Sign in to StemDome', el('span', { style: { color: '#7B2EFF' } }, 'Z'));

  const sub = el('p', {
    style: { color: '#0E0A12', marginBottom: '20px', lineHeight: 1.5, fontSize: '0.95rem' },
  }, 'One-time email link, or use a password if you’ve set one.');

  const tabBar = el('div', {
    style: {
      display: 'flex', gap: '4px',
      background: '#F5F2E5', border: '2px solid #0E0A12',
      borderRadius: '10px', padding: '3px', marginBottom: '16px',
    },
  });

  const status = el('p', {
    'aria-live': 'polite',
    style: { minHeight: '20px', marginBottom: '12px', color: '#0E0A12', fontWeight: 600, fontSize: '0.9rem' },
  });

  const formSlot = el('div');
  const devLinkContainer = el('div', { style: { marginTop: '16px' } });
  const footer = el('div', {
    style: { marginTop: '16px', textAlign: 'center', fontSize: '0.82rem', color: '#3D2F4A' },
  });

  card.append(heading, sub, tabBar, status, formSlot, devLinkContainer, footer);
  root.appendChild(card);

  const state = { mode: 'magic' };

  function tabBtn(id, label) {
    const active = state.mode === id;
    return el('button', {
      style: {
        flex: 1, padding: '8px 12px', cursor: 'pointer', border: 'none',
        background: active ? '#0E0A12' : 'transparent',
        color: active ? '#2EFF8C' : '#0E0A12',
        fontWeight: 800, fontStyle: 'italic',
        fontSize: '0.85rem', letterSpacing: '0.06em',
        textTransform: 'uppercase', borderRadius: '7px',
      },
      onClick: () => { state.mode = id; status.textContent = ''; renderTabs(); renderForm(); },
    }, label);
  }

  function renderTabs() {
    clear(tabBar);
    tabBar.append(
      tabBtn('magic',    'Email link'),
      tabBtn('password', 'Password'),
      tabBtn('reset',    'Forgot?')
    );
  }

  function fieldStyle() {
    return {
      width: '100%', padding: '12px 14px', fontSize: '16px',
      border: '2px solid #0E0A12', borderRadius: '10px',
      marginBottom: '12px', background: '#F5F2E5', color: '#0E0A12',
      fontWeight: 600,
    };
  }

  function ctaStyle(busy) {
    return {
      width: '100%', padding: '12px',
      fontSize: '16px', fontStyle: 'italic', fontWeight: 900,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      background: busy ? '#5A1FCE' : '#7B2EFF',
      color: '#FFFFFF', border: '3px solid #0E0A12',
      borderRadius: '12px', cursor: busy ? 'wait' : 'pointer',
    };
  }

  function renderForm() {
    clear(formSlot);
    clear(devLinkContainer);
    clear(footer);

    if (state.mode === 'password') {
      const emailInput = el('input', { type: 'email', name: 'email', autocomplete: 'email', required: true, placeholder: 'rider@example.com', style: fieldStyle() });
      const passInput  = el('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true, placeholder: 'password', style: fieldStyle() });
      const submit = el('button', { type: 'submit', style: ctaStyle(false) }, 'SIGN IN  →');
      const form = el('form', {
        onSubmit: async (e) => {
          e.preventDefault();
          const email = emailInput.value.trim();
          const password = passInput.value;
          if (!email || password.length < 10) {
            status.textContent = 'Email + password (10+ chars) required.';
            return;
          }
          submit.disabled = true; submit.style = Object.entries(ctaStyle(true)).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`).join(';');
          status.textContent = 'Signing in…';
          try {
            const res = await socket.request('auth.loginWithPassword', { email, password });
            if (res?.cookie) document.cookie = `sd_session=${encodeURIComponent(res.cookie)}; path=/; max-age=2592000; samesite=lax`;
            status.textContent = 'Signed in. Redirecting…';
            window.location.assign(query?.next || '/account');
          } catch (err) {
            status.textContent = err.message === 'invalid_credentials'
              ? 'Email or password is wrong.'
              : `Error: ${err?.message || 'something went wrong'}`;
            submit.disabled = false; submit.style = Object.entries(ctaStyle(false)).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`).join(';');
          }
        },
      },
        el('label', { for: 'email', style: { display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#3D2F4A' } }, 'Email'),
        emailInput,
        el('label', { for: 'password', style: { display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#3D2F4A' } }, 'Password'),
        passInput,
        submit
      );
      formSlot.appendChild(form);
      footer.appendChild(el('p', {}, 'No password set? ', el('a', { href: '#', onClick: (e) => { e.preventDefault(); state.mode = 'magic'; renderTabs(); renderForm(); }, style: { color: '#5A1FCE', fontWeight: 700 } }, 'Use email link →')));
      return;
    }

    if (state.mode === 'reset') {
      const emailInput = el('input', { type: 'email', name: 'email', autocomplete: 'email', required: true, placeholder: 'rider@example.com', style: fieldStyle() });
      const submit = el('button', { type: 'submit', style: ctaStyle(false) }, 'EMAIL RESET LINK  →');
      const form = el('form', {
        onSubmit: async (e) => {
          e.preventDefault();
          const email = emailInput.value.trim();
          if (!email) return;
          submit.disabled = true;
          status.textContent = 'Sending…';
          try {
            const r = await socket.request('auth.requestPasswordReset', { email });
            status.textContent = 'Check your inbox — link expires in 15 minutes.';
            if (r?.devUrl) {
              clear(devLinkContainer);
              devLinkContainer.appendChild(el('a', {
                href: r.devUrl,
                style: { display: 'inline-block', padding: '8px 12px', background: '#F5F2E5', border: '1px dashed #D7CFB6', color: '#5A1FCE', borderRadius: '8px', fontSize: '13px', textDecoration: 'none' },
              }, 'Dev mode: open reset link directly'));
            }
          } catch (err) {
            status.textContent = `Error: ${err?.message || 'something went wrong'}`;
          } finally {
            submit.disabled = false;
          }
        },
      },
        el('label', { for: 'email', style: { display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#3D2F4A' } }, 'Email'),
        emailInput,
        submit
      );
      formSlot.appendChild(form);
      return;
    }

    // Default: magic-link mode (the existing flow).
    const emailInput = el('input', { type: 'email', name: 'email', autocomplete: 'email', required: true, placeholder: 'rider@example.com', style: fieldStyle() });
    const submit = el('button', { type: 'submit', style: ctaStyle(false) }, 'EMAIL ME A LINK  →');
    const form = el('form', {
      onSubmit: async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email) return;
        submit.disabled = true;
        status.textContent = 'Sending…';
        try {
          const result = await socket.request('auth.requestMagicLink', {
            email, redirectTo: query?.next || '/account',
          });
          status.textContent = 'Check your inbox — link expires in 15 minutes.';
          if (result?.devUrl) {
            clear(devLinkContainer);
            devLinkContainer.appendChild(el('a', {
              href: result.devUrl,
              style: { display: 'inline-block', padding: '8px 12px', background: '#F5F2E5', border: '1px dashed #D7CFB6', color: '#5A1FCE', borderRadius: '8px', fontSize: '13px', textDecoration: 'none' },
            }, 'Dev mode: open magic-link directly'));
          }
        } catch (err) {
          status.textContent = `Error: ${err?.message || 'something went wrong'}`;
        } finally {
          submit.disabled = false;
        }
      },
    },
      el('label', { for: 'email', style: { display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#3D2F4A' } }, 'Email'),
      emailInput,
      submit
    );
    formSlot.appendChild(form);
  }

  if (query?.auth === 'expired') {
    status.textContent = 'That sign-in link expired. Request a fresh one.';
  }

  renderTabs();
  renderForm();

  return { el: root };
}

function acceptInviteFlow(root, code, socket) {
  const card = el('div', {
    style: {
      background: '#FFFFFF', border: '3px solid #0E0A12',
      borderRadius: '14px', padding: '32px 28px', textAlign: 'center',
    },
  });
  card.appendChild(el('h1', {
    class: 'sdz-display',
    style: { fontSize: '24px', color: '#0E0A12', textShadow: '3px 3px 0 #2EFF8C', marginBottom: '12px' },
  }, 'Accepting your invite…'));
  const status = el('p', { style: { color: '#0E0A12', fontSize: '0.95rem' } }, 'One moment.');
  card.appendChild(status);
  root.appendChild(card);

  socket.request('auth.consumeInvite', { code }).then((res) => {
    if (res?.cookie) document.cookie = `sd_session=${encodeURIComponent(res.cookie)}; path=/; max-age=2592000; samesite=lax`;
    status.textContent = 'Signed in. Welcome to StemDomeZ — redirecting…';
    window.location.assign('/account');
  }).catch((err) => {
    status.textContent = err?.message === 'invalid_or_expired_invite'
      ? 'That invite link has already been used or expired.'
      : `Could not accept invite: ${err?.message || 'unknown error'}`;
    card.appendChild(el('div', { style: { marginTop: '14px' } },
      el('a', {
        href: '/login', 'data-link': '',
        class: 'sdz-cta sdz-cta-secondary',
        style: { fontSize: '0.85rem' },
      }, 'Sign in normally  →')
    ));
  });

  return { el: root };
}
