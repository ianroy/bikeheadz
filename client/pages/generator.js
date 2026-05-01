import { el, clear } from '../dom.js';
import { icon } from '../icons.js';
import { createValveStemViewer } from '../components/valve-stem-viewer.js';
import { getCachedAppConfig } from '../util/app-config.js';

export function GeneratorPage({ socket }) {
  const cfg = getCachedAppConfig();
  const paymentsOff = !cfg.paymentsEnabled;
  const printingOff = !cfg.printingEnabled;
  const state = {
    photoUrl: null,
    photoFile: null,
    photoName: null,
    dragging: false,
    processing: false,
    progress: 0,
    processingStep: '',
    stlReady: false,
    lastError: null,
    // v0.1.42 dual-output. The two panels render these independently.
    // `stlData` aliases finalStlData when present, else headStlData,
    // for any back-compat code paths still reading the old single-STL
    // shape (chiefly the legacy CTA download button when payments
    // come back online).
    stlData: null,
    headStlData: null,
    finalStlData: null,
    finalFailed: false,
    finalErrorMessage: null,
    // v0.1.43 — object mode. True when the pipeline couldn't detect a
    // head and fell back to glueing the cap onto whatever TRELLIS
    // produced (a coffee mug, a sticker, a doodle). UI shows a
    // prominent "Head not detected — switching to object mode"
    // banner and relabels the panels.
    objectModeUsed: false,
    headScale: 0.85,
    headTilt: 0,              // v1: pitch about X (chin up/down), -30..+30
    cropTightness: 0.60,      // v1: shoulder_taper_fraction, 0.40..0.85
    targetHeadHeightMm: 30,   // v1: TARGET_HEAD_HEIGHT_MM override, 22..42
    capProtrusionPct: 10,     // v1: CAP_PROTRUSION_FRACTION override, 0..25 (%)
    materialType: 'chrome',
    headColor: '#D4B896',
    showSettings: false,
    designId: null,
    designTriangles: 0,
    checkoutPending: false,
    // Independent download spinners per panel.
    downloadingKind: null, // 'head' | 'final' | null
  };

  const root = el('div.max-w-6xl.mx-auto.px-4.py-6');

  // P6-007 — single aria-live region the rest of the page writes into.
  // We use `polite` for progress (don't interrupt the user) and bump
  // `assertive` for errors. Throttled to one update per stage so VoiceOver /
  // NVDA don't read every percentage tick.
  const live = el('div', {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
    style: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
    },
  });
  root.appendChild(live);
  let lastAnnounce = '';
  function announce(text, assertive = false) {
    if (text === lastAnnounce) return;
    lastAnnounce = text;
    live.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    live.textContent = text;
  }

  const grid = el('div', {
    class: 'grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6',
  });
  root.appendChild(grid);

  const center = el('section.flex.flex-col.gap-5');
  const rightAside = el('aside.flex.flex-col.gap-4');
  grid.append(center, rightAside);

  // ──────────────────────────────────────────────────────────────
  // CENTER — title / uploader / viewer / settings / actions
  // ──────────────────────────────────────────────────────────────
  center.appendChild(
    el('div', { class: 'relative' },
      el('h1', {
        class: 'sdz-display',
        style: {
          fontSize: '2.2rem',
          color: 'var(--ink)',
          textShadow: '5px 5px 0 var(--accent2)',
          marginBottom: '0.25rem',
        },
      },
        'Your face on a ',
        el('span', { style: { color: 'var(--brand)' } }, 'valve cap'),
        '.',
      ),
      el('p.mt-1', {
        style: {
          color: 'var(--ink-muted)',
          fontSize: '0.95rem',
          fontStyle: 'italic',
          fontWeight: 600,
        },
      }, 'Upload a photo → 3D-printable STL, designed for the workshop.'),
    ),
  );

  // Photo upload
  const fileInput = el('input', {
    type: 'file',
    accept: 'image/*',
    class: 'hidden',
    style: { display: 'none' },
    onChange: (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
  });

  const uploaderSlot = el('div');
  center.appendChild(uploaderSlot);
  center.appendChild(fileInput);

  function renderUploader() {
    clear(uploaderSlot);
    const box = el('div', {
      class: 'relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer sdz-memphis',
      style: {
        '--memphis-offset': '6px',
        '--memphis-color': 'var(--accent2)',
        borderColor: state.dragging ? 'var(--brand)' : 'var(--ink)',
        background: state.dragging ? 'color-mix(in srgb, var(--brand) 8%, var(--paper))' : 'var(--paper)',
        borderWidth: '3px',
        borderStyle: state.dragging ? 'solid' : 'dashed',
      },
      onClick: () => { if (!state.photoUrl) fileInput.click(); },
      onDragover: (e) => { e.preventDefault(); if (!state.dragging) { state.dragging = true; renderUploader(); } },
      onDragleave: () => { state.dragging = false; renderUploader(); },
      onDrop: (e) => {
        e.preventDefault();
        state.dragging = false;
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
        else renderUploader();
      },
    });

    // X-009 — secondary "Try with a sample" affordance shown when no
    // photo has been picked yet. Doesn't bypass rate-limit on the server,
    // just primes the UX so first-time visitors see the flow without
    // committing their face.
    if (!state.photoUrl) {
      box.appendChild(
        el(
          'div',
          { class: 'flex flex-col items-center justify-center text-center px-6 py-10 gap-3' },
          el('span', { style: { fontSize: '2rem' } }, '\u{1F4F7}'),
          el(
            'p',
            {
              style: {
                color: 'var(--ink)',
                fontSize: '1rem',
                fontWeight: 800,
                fontStyle: 'italic',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              },
            },
            'Drop a photo · paste · or click upload'
          ),
          el('p', {
            style: { color: 'var(--ink-muted)', fontSize: '0.78rem', fontWeight: 600 },
          }, 'PNG or JPEG, up to 5 MB'),
          el(
            'button',
            {
              class: 'sdz-cta sdz-cta-secondary mt-2',
              style: { fontSize: '0.78rem', padding: '0.5rem 1rem' },
              onClick: (e) => {
                e.stopPropagation();
                loadSamplePhoto();
              },
            },
            'Try a sample →'
          )
        )
      );
      uploaderSlot.appendChild(box);
      return;
    }

    if (state.photoUrl) {
      box.appendChild(el('div.flex.items-center.gap-4.p-4',
        el('div', {
          class: 'relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border',
          style: { borderColor: '#D7CFB6' },
        },
          el('img', { src: state.photoUrl, alt: 'Uploaded', class: 'w-full h-full object-cover' }),
        ),
        el('div.flex-1.min-w-0',
          el('p', { style: { fontWeight: 600, fontSize: '0.9rem' } }, state.photoName || 'Photo uploaded'),
          el('p', { style: { color: '#3D2F4A', fontSize: '0.78rem' } }, 'Ready to generate your valve stem'),
        ),
        el('button', {
          class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors',
          style: { borderColor: '#D7CFB6', color: '#3D2F4A', fontSize: '0.78rem', background: 'transparent' },
          onClick: (e) => { e.stopPropagation(); fileInput.click(); },
        },
          icon('refresh', { size: 14 }),
          'Change Photo',
        ),
      ));
    } else {
      box.appendChild(el('div.flex.flex-col.items-center.justify-center.gap-3', { style: { padding: '2.5rem 0' } },
        el('div', {
          class: 'w-14 h-14 rounded-2xl flex items-center justify-center',
          style: { background: 'linear-gradient(135deg, #E5E0CC, #F5F2E5)', border: '1px solid rgba(123,46,255,0.3)' },
        }, icon('upload', { size: 24, color: '#7B2EFF' })),
        el('div.text-center',
          el('p', { style: { fontWeight: 600 } }, 'Upload Your Photo'),
          el('p.mt-1', { style: { color: '#3D2F4A', fontSize: '0.82rem' } }, 'Drag & drop or click to browse · JPG, PNG, HEIC'),
        ),
        el('button', {
          class: 'px-5 py-2 rounded-xl transition-all',
          style: { background: '#7B2EFF', color: '#FFFFFF', fontWeight: 700, fontSize: '0.88rem' },
        }, 'Choose Photo'),
      ));
    }

    uploaderSlot.appendChild(box);
  }

  // \u2500\u2500 3D Model Preview \u2014 dual-panel layout (v0.1.42) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // The pipeline ships TWO STLs: head-only (stage 1.7) and head+cap
  // (stages 2-6). Booleans fail ~30%+ of the time on selfie geometry,
  // so we always show the head as a salvage download even when the
  // final fails. Layout:
  //   \u2022 mobile (<768px): stacked vertically, head on top
  //   \u2022 desktop (\u2265768px): side-by-side, head on the left
  //
  // Each panel is a self-contained micro-component (header + canvas +
  // download button + apology overlay if applicable). Two viewer
  // instances are kept in sync via pushViewer().
  // v0.1.43 — object-mode banner. Mounted ABOVE the viewer grid so
  // the user sees it before they see the panels. Only renders when
  // state.objectModeUsed === true. Uses brand spraypaint vocabulary
  // (magenta accent3 + ink) to feel like part of the design system,
  // not a generic alert.
  const objectModeBanner = el('div', { style: { display: 'none' } });
  center.appendChild(objectModeBanner);

  const viewerGrid = el('div', {
    class: 'grid gap-4',
    style: { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' },
  });
  center.appendChild(viewerGrid);

  function renderObjectModeBanner() {
    clear(objectModeBanner);
    if (!state.objectModeUsed || !state.stlReady) {
      objectModeBanner.style.display = 'none';
      return;
    }
    objectModeBanner.style.display = 'block';
    const card = el('div', {
      class: 'rounded-2xl border-2 px-4 py-3 flex items-start gap-3',
      style: {
        background: '#FFFFFF',
        borderColor: '#FF2EAB',
        color: '#0E0A12',
        boxShadow: '4px 4px 0 #0E0A12',
      },
    });
    card.appendChild(el('span', { style: { fontSize: '1.6rem', flexShrink: 0 } }, '🤖'));
    card.appendChild(el('div', { style: { flex: 1 } },
      el('p', {
        style: { fontWeight: 800, fontSize: '0.95rem', fontStyle: 'italic', color: '#0E0A12', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' },
      }, 'Head not detected — switching to object mode'),
      el('p', {
        style: { color: '#3D2F4A', fontSize: '0.85rem', lineHeight: 1.5 },
      }, "We couldn't find a face in your photo, so we're making a valve cap out of whatever you uploaded. Both panels still work — your scan on the left, scan + cap on the right. Print at your own risk."),
    ));
    objectModeBanner.appendChild(card);
  }

  function buildPanel(kind) {
    // kind: 'head' | 'final'
    const slot = el('div', {
      class: 'rounded-2xl overflow-hidden border flex flex-col',
      style: { background: '#FFFFFF', borderColor: '#D7CFB6' },
    });
    const header = el('div.flex.items-center.justify-between.px-4.py-3.border-b', {
      style: { borderColor: '#D7CFB6' },
    });
    slot.appendChild(header);

    const canvas = el('div', { style: { height: '320px', position: 'relative', flex: '1 1 auto' } });
    slot.appendChild(canvas);

    // Apology overlay (only shown for kind='final' when finalFailed).
    const overlay = el('div', {
      style: {
        position: 'absolute', inset: 0, display: 'none',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '20px',
        background: 'rgba(245,242,229,0.92)',
        color: '#0E0A12', fontFamily: 'ui-monospace, monospace',
      },
    });
    canvas.appendChild(overlay);

    // Footer: legend + download button.
    const footer = el('div.flex.items-center.justify-between.gap-3.px-4.py-3.border-t.flex-wrap', {
      style: { borderColor: '#D7CFB6', fontSize: '0.75rem' },
    });
    slot.appendChild(footer);

    const downloadBtn = el('button', {
      style: {
        padding: '8px 14px',
        background: '#5A1FCE', color: '#FFFFFF',
        border: '2px solid #0E0A12', boxShadow: '3px 3px 0 #0E0A12',
        fontFamily: 'ui-monospace, monospace', fontWeight: 700,
        fontSize: '0.78rem', letterSpacing: '0.04em',
        textTransform: 'uppercase', cursor: 'pointer',
      },
      onClick: () => downloadKind(kind),
    });
    footer.appendChild(downloadBtn);

    const viewer = createValveStemViewer({
      container: canvas,
      initial: {
        headScale: state.headScale,
        headTilt: state.headTilt,
        materialType: state.materialType,
        headColor: state.headColor,
        photoUrl: state.photoUrl,
        processing: state.processing,
      },
    });

    return { slot, header, canvas, overlay, footer, downloadBtn, viewer, kind };
  }

  const headPanel  = buildPanel('head');
  const finalPanel = buildPanel('final');
  viewerGrid.appendChild(headPanel.slot);
  viewerGrid.appendChild(finalPanel.slot);

  // Central CTA bar — the two big buttons that handle BOTH STLs at
  // once. Sits below the viewer grid. Per-panel download buttons were
  // removed in favor of these. Both gate on auth: anon clicks → save
  // designId + intent to sessionStorage, push to /login. After login
  // the page mount auto-resumes (re-fetches the STLs via
  // designs.getForViewer, then runs the pending intent).
  const centralActions = el('div', {
    style: { display: 'none', flexDirection: 'column', gap: '12px' },
  });
  center.appendChild(centralActions);

  function renderCentralActions() {
    clear(centralActions);
    if (!state.stlReady) {
      centralActions.style.display = 'none';
      return;
    }
    centralActions.style.display = 'flex';

    const isDownloading = state.downloadingKind === 'all';
    const isEmailing   = state.downloadingKind === 'email';
    const busy = isDownloading || isEmailing || state.processing;

    const buttonRow = el('div', {
      class: 'flex gap-3 flex-wrap',
      style: { justifyContent: 'center' },
    });

    // Download STLs — primary button. Triggers two sequential browser
    // downloads (head_stl_b64 then final_stl_b64 if available).
    const downloadBtn = el('button', {
      onClick: () => downloadAllStls(),
      disabled: busy,
      style: {
        flex: '1 1 240px',
        padding: '14px 22px',
        background: busy ? '#D7CFB6' : 'linear-gradient(135deg, #5A1FCE, #3D14AB)',
        color: busy ? '#3D2F4A' : '#FFFFFF',
        border: '2px solid #0E0A12',
        boxShadow: busy ? '2px 2px 0 #0E0A12' : '4px 4px 0 #0E0A12',
        fontFamily: 'ui-monospace, monospace',
        fontWeight: 800, fontSize: '0.92rem',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        fontStyle: 'italic',
        cursor: busy ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      },
    },
      icon('download', { size: 18, color: busy ? '#3D2F4A' : '#FFFFFF' }),
      isDownloading ? 'Downloading…' : 'Download STLs',
    );

    // Email me the STLs — secondary, same shape, fluoro accent.
    const emailBtn = el('button', {
      onClick: () => emailAllStls(),
      disabled: busy,
      style: {
        flex: '1 1 240px',
        padding: '14px 22px',
        background: busy ? '#D7CFB6' : '#FFFFFF',
        color: busy ? '#3D2F4A' : '#0E0A12',
        border: '2px solid #0E0A12',
        boxShadow: busy ? '2px 2px 0 #0E0A12' : '4px 4px 0 #2EFF8C',
        fontFamily: 'ui-monospace, monospace',
        fontWeight: 800, fontSize: '0.92rem',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        fontStyle: 'italic',
        cursor: busy ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      },
    },
      icon('mail', { size: 18, color: busy ? '#3D2F4A' : '#0E0A12' }),
      isEmailing ? 'Sending…' : 'Email me the STLs',
    );

    buttonRow.appendChild(downloadBtn);
    buttonRow.appendChild(emailBtn);
    centralActions.appendChild(buttonRow);

    // Caption row — tells the rider what they're getting + the auth
    // ask, since the CTA copy alone doesn't explain "we'll bounce
    // you to sign in if you're not already logged in."
    const caption = el('p', {
      style: {
        textAlign: 'center', color: '#3D2F4A', fontSize: '0.78rem',
        fontStyle: 'italic', lineHeight: 1.5,
      },
    });
    const stlCount = (state.headStlData ? 1 : 0) + (state.finalStlData ? 1 : 0);
    caption.textContent = stlCount === 2
      ? "Both STLs (head-only + head + cap). Free for the MVP launch — sign in if you haven't already."
      : "Your STL. Free for the MVP launch — sign in if you haven't already.";
    centralActions.appendChild(caption);
  }

  // Trigger sequential browser downloads for whichever STLs the rider
  // has on the design (head + final, or just head if the boolean
  // phase failed). On auth_required: stash designId + intent and
  // bounce to /login. Server-side claims the anon design onto the
  // user's account on first authed access via designs.getForViewer.
  async function downloadAllStls() {
    if (!state.designId || state.downloadingKind) return;
    state.downloadingKind = 'all';
    renderCentralActions();
    try {
      // Sequential calls — head first if present, then final if
      // present. We use stl.downloadFree for each; the server already
      // returns the right bytes per kind.
      const kinds = [];
      if (state.headStlData)  kinds.push('head');
      if (state.finalStlData) kinds.push('final');
      for (const kind of kinds) {
        const res = await socket.request('stl.downloadFree', {
          designId: state.designId,
          kind,
        });
        triggerStlDownload(res);
        // Tiny delay between sequential downloads so the browser
        // doesn't drop the second one as a popup (rare but happens
        // on Safari).
        await new Promise((r) => setTimeout(r, 250));
      }
      announce(kinds.length === 2 ? 'Both STLs downloaded.' : 'STL downloaded.');
    } catch (err) {
      if (err.message === 'auth_required' || err.message === 'payments_enabled') {
        // payments_enabled would only fire if someone flipped the
        // flag mid-session — same recovery: bounce to /login. The
        // /account flow lets them check out properly when payments
        // come back online.
        bounceToSignIn('download');
        return;
      }
      announce(`Download failed: ${friendlyError(err)}`, true);
      alert(`Could not download: ${friendlyError(err)}`);
    } finally {
      state.downloadingKind = null;
      renderCentralActions();
    }
  }

  // Email both STLs as attachments to the logged-in user's email.
  // Same auth gate + claim semantics. Returns count of attachments
  // sent so we can confirm in the UI.
  async function emailAllStls() {
    if (!state.designId || state.downloadingKind) return;
    state.downloadingKind = 'email';
    renderCentralActions();
    try {
      const res = await socket.request('stl.emailMe', {
        designId: state.designId,
      });
      const where = res.sent_to ? ` to ${res.sent_to}` : '';
      announce(`Sent${where}. Check your inbox.`);
      alert(`✉️  Sent${where}. Check your inbox.`);
    } catch (err) {
      if (err.message === 'auth_required') {
        bounceToSignIn('email');
        return;
      }
      announce(`Email failed: ${friendlyError(err)}`, true);
      alert(`Could not email: ${friendlyError(err)}`);
    } finally {
      state.downloadingKind = null;
      renderCentralActions();
    }
  }

  // Save designId + pending intent so /login can come back here and
  // we can auto-resume the action. We DON'T save the STL b64 itself
  // — too big for sessionStorage (~5-10 MB browser cap) and we can
  // re-fetch via designs.getForViewer after auth.
  function bounceToSignIn(intent) {
    if (state.designId) {
      sessionStorage.setItem('stemdomez.designId', state.designId);
      sessionStorage.setItem('stemdomez.pendingAction', intent);
    }
    announce('Sign in to continue. Redirecting…', true);
    const next = encodeURIComponent('/stemdome-generator');
    window.location.assign(`/login?next=${next}`);
  }

  function renderPanelHeader(panel) {
    clear(panel.header);
    const isHead = panel.kind === 'head';
    // v0.1.43 \u2014 relabel panels when object-mode kicked in. The
    // pipeline couldn't find a head, so calling panel 1 "Your head"
    // would be a lie. Use neutral wording.
    const omu = state.objectModeUsed;
    const titleText = isHead
      ? (omu ? '1 \u00b7 Your scan' : '1 \u00b7 Your head')
      : (omu ? '2 \u00b7 Scan + valve cap' : '2 \u00b7 Head + valve cap');
    const titleColor = isHead ? '#5A1FCE' : '#0E0A12';
    const leftRow = el('div.flex.items-center.gap-2',
      icon(isHead ? 'user' : 'layers', { size: 14, color: titleColor }),
      el('span', { style: { color: titleColor, fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.02em' } }, titleText),
    );
    if (state.processing) {
      leftRow.appendChild(el('span', {
        class: 'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        style: { background: 'rgba(123,46,255,0.12)', fontSize: '0.7rem', color: '#7B2EFF' },
      },
        el('span.pulse-dot.inline-block.rounded-full', {
          style: { width: '6px', height: '6px', background: '#7B2EFF' },
        }),
        'Processing',
      ));
    } else if (panel.kind === 'final' && state.finalFailed) {
      leftRow.appendChild(el('span', {
        class: 'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        style: { background: 'rgba(255,46,171,0.16)', fontSize: '0.7rem', color: '#FF2EAB', fontWeight: 700 },
      }, '\u26a0 Cap failed'));
    } else if (panel.kind === 'head' && state.headStlData) {
      leftRow.appendChild(el('span', {
        class: 'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        style: { background: 'rgba(57,255,108,0.18)', fontSize: '0.7rem', color: '#0E0A12', fontWeight: 700 },
      }, '\u2713 Ready'));
    } else if (panel.kind === 'final' && state.finalStlData) {
      leftRow.appendChild(el('span', {
        class: 'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        style: { background: 'rgba(57,255,108,0.18)', fontSize: '0.7rem', color: '#0E0A12', fontWeight: 700 },
      }, '\u2713 Ready'));
    }
    panel.header.appendChild(leftRow);

    panel.header.appendChild(
      el('div.flex.items-center.gap-2', {
        style: { color: '#3D2F4A', fontSize: '0.72rem' },
      },
        icon('rotate', { size: 14 }),
        'Drag to rotate',
      ),
    );
  }

  function renderPanelOverlay(panel) {
    panel.overlay.style.display = 'none';
    clear(panel.overlay);
    if (panel.kind !== 'final') return;
    if (state.processing || !state.stlReady) return;
    if (!state.finalFailed) return;
    panel.overlay.style.display = 'flex';
    panel.overlay.append(
      el('div', { style: { fontSize: '2.2rem', marginBottom: '8px' } }, '\u26a0\ufe0f'),
      el('p', {
        style: { fontWeight: 800, fontSize: '0.95rem', color: '#0E0A12', marginBottom: '6px' },
      }, "Couldn't seat the valve cap"),
      el('p', {
        style: { fontSize: '0.8rem', color: '#3D2F4A', maxWidth: '24em', lineHeight: 1.5, marginBottom: '6px' },
      }, state.finalErrorMessage || 'The boolean step failed on this geometry. Your head STL is still printable \u2014 download it from the panel on the left.'),
      el('p', {
        style: { fontSize: '0.7rem', color: '#3D2F4A', fontStyle: 'italic' },
      }, 'Try a different photo, or relax the Crop Tightness slider.'),
    );
  }

  function renderPanelFooter(panel) {
    clear(panel.footer);
    // Per-panel download buttons removed in favor of central
    // "Download STLs" + "Email me the STLs" buttons below the grid
    // (handles both files at once, plus auth gate + claim flow).
    // The footer just shows a brief description of what each panel is.
    const isHead = panel.kind === 'head';
    panel.footer.appendChild(
      el('span', { style: { color: '#3D2F4A', fontSize: '0.7rem' } },
        isHead ? 'Stage 1.7 watertight head \u2014 always available.'
               : 'Final mesh: head + cap (stages 2-6).')
    );
  }

  function renderViewerHeader() {
    renderPanelHeader(headPanel);
    renderPanelHeader(finalPanel);
    renderPanelOverlay(headPanel);
    renderPanelOverlay(finalPanel);
    renderPanelFooter(headPanel);
    renderPanelFooter(finalPanel);
  }

  function pushViewer() {
    headPanel.viewer.update({
      headScale: state.headScale,
      headTilt: state.headTilt,
      materialType: state.materialType,
      headColor: state.headColor,
      photoUrl: state.photoUrl,
      processing: state.processing,
      stlData: state.headStlData,
    });
    finalPanel.viewer.update({
      headScale: state.headScale,
      headTilt: state.headTilt,
      materialType: state.materialType,
      headColor: state.headColor,
      photoUrl: state.photoUrl,
      // The final viewer should NOT show the placeholder while
      // processing (head viewer does that). When finalFailed, hide the
      // mesh and let the overlay carry the message.
      processing: state.processing,
      stlData: state.finalFailed ? null : state.finalStlData,
    });
  }

  // Per-panel download handler. Calls stl.downloadFree (or stl.download
  // with kind) and triggers a browser download. Tracks state.downloadingKind
  // so the right button shows a spinner while the request is in flight.
  async function downloadKind(kind) {
    if (state.downloadingKind || !state.designId) return;
    const hasData = kind === 'head' ? !!state.headStlData : !!state.finalStlData;
    if (!hasData) return;
    state.downloadingKind = kind;
    renderViewerHeader();
    try {
      const command = paymentsOff ? 'stl.downloadFree' : 'stl.download';
      const res = await socket.request(command, {
        designId: state.designId,
        kind,
      });
      triggerStlDownload(res);
      announce(`${kind === 'head' ? 'Head' : 'Full'} STL downloaded.`);
    } catch (err) {
      if (err.message === 'auth_required') {
        sessionStorage.setItem('stemdomez.designId', state.designId);
        announce('Please sign in to download your free STL. Redirecting\u2026', true);
        const next = encodeURIComponent('/stemdome-generator');
        window.location.assign(`/login?next=${next}`);
        return;
      }
      announce(`Download failed: ${friendlyError(err)}`, true);
      alert(`Could not download: ${friendlyError(err)}`);
    } finally {
      state.downloadingKind = null;
      renderViewerHeader();
    }
  }

  // Settings toggle + panel
  const settingsToggle = el('button', {
    class: 'flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-colors text-left',
    style: { background: '#FFFFFF', borderColor: '#D7CFB6' },
    onClick: () => { state.showSettings = !state.showSettings; renderSettings(); },
  });
  center.appendChild(settingsToggle);

  const settingsPanel = el('div', { class: 'collapse-panel' });
  const settingsInner = el('div');
  settingsPanel.appendChild(settingsInner);
  center.appendChild(settingsPanel);

  function renderSettings() {
    clear(settingsToggle);
    settingsToggle.append(
      el('div.flex.items-center.gap-2',
        icon('settings', { size: 16, color: '#7B2EFF' }),
        el('span', { style: { color: '#0E0A12', fontWeight: 600, fontSize: '0.88rem' } }, 'Adjust 3D Settings'),
      ),
      el('div', {
        style: {
          transition: 'transform 0.2s',
          transform: state.showSettings ? 'rotate(90deg)' : 'rotate(0deg)',
          color: '#3D2F4A',
        },
      }, icon('chevronRight', { size: 16 })),
    );

    settingsPanel.classList.toggle('open', state.showSettings);
    if (!state.showSettings) return;

    clear(settingsInner);
    settingsInner.className = 'rounded-2xl border p-5 grid grid-cols-1 sm:grid-cols-2 gap-5';
    Object.assign(settingsInner.style, { background: '#FFFFFF', borderColor: '#D7CFB6' });

    settingsInner.append(
      // Head Height — TARGET_HEAD_HEIGHT_MM, the size the rescaled head
      // is normalized to before booleans. Drives the final part's
      // overall vertical dimension. Default 30 mm. Cap & core need
      // ~14 mm of cropped head to fit, so the practical floor is 22.
      slider({
        label: 'Head Height',
        value: state.targetHeadHeightMm,
        min: 22, max: 42, step: 1,
        display: (v) => `${v} mm`,
        onInput: (v) => { state.targetHeadHeightMm = v; pushViewer(); },
      }),
      // Cap Protrusion — fraction of cap height visible below the head's
      // bottom face. Creates the bike-valve entry opening. 0 = cap
      // entirely inside head (no opening); 25 = significant exposed
      // threading. 10% default.
      slider({
        label: 'Cap Protrusion',
        value: state.capProtrusionPct,
        min: 0, max: 25, step: 1,
        display: (v) => `${v}%`,
        onInput: (v) => { state.capProtrusionPct = v; pushViewer(); },
      }),
      slider({
        label: 'Head Scale',
        value: state.headScale,
        min: 0.5, max: 1.5, step: 0.05,
        display: (v) => `${Math.round(v * 100)}%`,
        onInput: (v) => { state.headScale = v; pushViewer(); },
      }),
      // Crop Tightness — controls Stage 2's neck-cut location.
      // 0.40 = aggressive crop (nearly all head removed below mid-face);
      // 0.85 = loose crop (may include part of the shoulders).
      // 0.60 default — calibrated across 4 reference scans.
      slider({
        label: 'Crop Tightness',
        value: state.cropTightness,
        min: 0.40, max: 0.85, step: 0.02,
        display: (v) => `${Math.round(v * 100)}%`,
        onInput: (v) => { state.cropTightness = v; pushViewer(); },
      }),
      // Head Pitch — Stage 1 rotates the head around X before Stage 2's
      // horizontal cut. Positive = chin tilts up (cut plane lands lower
      // through back-of-neck while preserving the chin).
      slider({
        label: 'Head Pitch',
        value: state.headTilt,
        min: -30, max: 30, step: 1,
        display: (v) => (v > 0 ? `chin up +${v}°` : v < 0 ? `chin down ${v}°` : 'level'),
        onInput: (v) => { state.headTilt = v; pushViewer(); },
      }),
      colorRow({
        value: state.headColor,
        onInput: (v) => { state.headColor = v; pushViewer(); },
      }),
      materialRow({
        value: state.materialType,
        onChange: (v) => { state.materialType = v; pushViewer(); renderSettings(); },
      }),
    );
  }

  // P3-011 — post-generation feedback strip. Hidden until an STL is
  // ready; once a rating is submitted we swap to a thank-you line so
  // we don't spam the same designId twice.
  const feedbackSlot = el('div');
  center.appendChild(feedbackSlot);
  const feedbackSubmitted = new Set();

  function renderFeedback() {
    clear(feedbackSlot);
    if (!state.stlReady || !state.designId) return;
    const designId = state.designId;

    // v0.1.42 — one feedback row per stage. Both stages are rated
    // independently so a rider can thumbs-up the head and thumbs-down
    // the cap, or vice versa. Each stage's row is keyed
    // `${designId}:${stage}` in feedbackSubmitted so submitting one
    // doesn't dismiss the other.
    const stages = [];
    if (state.headStlData) stages.push({ stage: 'head',  label: 'Your head (stage 1.7)' });
    if (state.finalStlData) stages.push({ stage: 'final', label: 'Head + valve cap (stages 2-6)' });

    if (stages.length === 0) return;

    const wrap = el('div', { class: 'flex flex-col gap-2' });
    for (const s of stages) {
      const submittedKey = `${designId}:${s.stage}`;
      if (feedbackSubmitted.has(submittedKey)) {
        wrap.appendChild(
          el('div', {
            class: 'rounded-xl px-4 py-2 border flex items-center justify-between gap-2',
            style: { background: '#E5E0CC', borderColor: '#D7CFB6', color: '#3D2F4A', fontSize: '0.82rem' },
          },
            el('span', {}, `Thanks for the feedback on ${s.label}`),
            el('span', { style: { fontSize: '0.7rem', fontStyle: 'italic' } }, '✓'),
          ),
        );
        continue;
      }
      const row = el('div', {
        class: 'flex items-center gap-3 rounded-xl px-4 py-2 border flex-wrap',
        style: { background: '#FFFFFF', borderColor: '#D7CFB6' },
      });
      row.appendChild(
        el('span', {
          style: { color: '#3D2F4A', fontSize: '0.78rem', fontWeight: 700, flex: '1 1 auto' },
        }, `How did we do on the ${s.label}?`),
      );
      // up | meh | down. Plain thumbs to keep the per-stage signal
      // unambiguous for the admin Feedback dashboard. (The old
      // 👍 ❤️ 🤷 mapping confused the schema and caused down-votes
      // to look like loves.)
      const buttons = [
        { rating: 'up',   label: '\u{1F44D}', tip: 'Looks great' },
        { rating: 'meh',  label: '\u{1F937}', tip: "It's fine" },
        { rating: 'down', label: '\u{1F44E}', tip: "Didn't work" },
      ];
      for (const b of buttons) {
        row.appendChild(
          el('button', {
            class: 'px-2 py-1 rounded-lg border transition-colors',
            style: { borderColor: '#D7CFB6', background: '#F5F2E5', fontSize: '1.05rem', cursor: 'pointer' },
            'aria-label': `${s.stage} feedback ${b.rating}`,
            title: b.tip,
            onClick: () => submitFeedback(designId, s.stage, b.rating),
          }, b.label),
        );
      }
      wrap.appendChild(row);
    }
    feedbackSlot.appendChild(wrap);
  }

  function submitFeedback(designId, stage, rating) {
    feedbackSubmitted.add(`${designId}:${stage}`);
    renderFeedback();
    // designs.rate is the canonical command — see server/commands/stl.js.
    // Fire-and-forget — a failure here isn't worth interrupting the
    // rider. The server logs it and we already moved the UI to the
    // thank-you state.
    socket.request('designs.rate', { designId, stage, rating }).catch(() => {});
  }

  // Action buttons
  const actions = el('div.flex.flex-col.gap-3', { class: 'sm:flex-row' });
  center.appendChild(actions);
  const readyBanner = el('div');
  center.appendChild(readyBanner);

  const generateBtn = el('button', {
    class: 'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-200',
    style: { fontWeight: 800, fontSize: '0.95rem' },
    onClick: handleGenerate,
  });
  const downloadBtn = el('button', {
    class: 'flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all duration-200',
    style: { fontWeight: 700, fontSize: '0.9rem' },
    onClick: handleCheckout,
  });

  actions.append(generateBtn, downloadBtn);

  function renderActions() {
    const canGenerate = !!state.photoUrl && !state.processing;

    clear(generateBtn);
    Object.assign(generateBtn.style, {
      background: canGenerate ? 'linear-gradient(135deg, #7B2EFF, #5A1FCE)' : '#D7CFB6',
      color: '#FFFFFF',
      cursor: canGenerate ? 'pointer' : 'not-allowed',
      opacity: canGenerate ? 1 : 0.6,
    });
    generateBtn.disabled = !canGenerate;
    if (state.processing) {
      generateBtn.append(
        el('span.spinner'),
        `${state.processingStep || 'Generating…'} ${state.progress}%`,
      );
    } else {
      generateBtn.append(
        icon('zap', { size: 16, color: '#FFFFFF' }),
        state.stlReady ? 'Re-generate STL' : 'Generate 3D File',
      );
    }

    const canPurchase = state.stlReady && !!state.designId && !state.checkoutPending;

    clear(downloadBtn);
    const buttonLabel = paymentsOff
      ? state.checkoutPending
        ? 'Downloading…'
        : 'Download STL · FREE'
      : state.checkoutPending
        ? 'Redirecting…'
        : 'Buy STL · $2';
    downloadBtn.append(
      icon(paymentsOff ? 'download' : 'creditCard', { size: 16, color: canPurchase ? '#FFFFFF' : '#3D2F4A' }),
      buttonLabel,
    );
    Object.assign(downloadBtn.style, {
      background: canPurchase ? 'linear-gradient(135deg, #7B2EFF, #5A1FCE)' : '#D7CFB6',
      color: canPurchase ? '#FFFFFF' : '#3D2F4A',
      border: 'none',
      cursor: canPurchase ? 'pointer' : 'not-allowed',
      opacity: canPurchase ? 1 : 0.7,
    });
    downloadBtn.disabled = !canPurchase;

    clear(readyBanner);
    // Visible error banner — when the last generate attempt errored,
    // surface it loudly. Previously the only error path was an
    // aria-live announcement + the button's progress text, so users
    // saw the loading bar finish and assumed success without a model.
    if (state.lastError && !state.processing) {
      readyBanner.appendChild(el('div', {
        class: 'fade-up rounded-xl px-4 py-3 border-2 flex items-start gap-3',
        style: {
          background: '#FFFFFF',
          borderColor: '#FF2EAB',
          color: '#0E0A12',
        },
      },
        el('span', { style: { fontSize: '1.4rem' } }, '⚠️'),
        el('div', { style: { flex: 1 } },
          el('p', {
            style: {
              color: '#0E0A12',
              fontWeight: 800,
              fontSize: '0.92rem',
              fontStyle: 'italic',
            },
          }, 'Generation failed.'),
          el('p', {
            style: { color: '#0E0A12', fontSize: '0.85rem', marginTop: '4px', lineHeight: 1.45 },
          }, state.lastError),
          el('p', {
            style: { color: '#3D2F4A', fontSize: '0.78rem', marginTop: '6px', fontStyle: 'italic' },
          }, 'Tap Generate again, or try a different photo. Recurring failures usually mean the GPU image needs the latest release.')
        )
      ));
    }
    if (state.stlReady) {
      readyBanner.appendChild(el('div', {
        class: 'fade-up rounded-xl px-4 py-3 border flex items-center gap-3',
        style: { background: 'rgba(123,46,255,0.06)', borderColor: 'rgba(123,46,255,0.25)' },
      },
        el('span', { style: { fontSize: '1.5rem' } }, '\u{1F389}'),
        el('div',
          el('p', {
            style: { color: '#7B2EFF', fontWeight: 700, fontSize: '0.88rem' },
          },
            `Your STL is ready — ${state.designTriangles.toLocaleString()} triangles.`,
          ),
          el('p', {
            style: { color: '#3D2F4A', fontSize: '0.78rem' },
          },
            paymentsOff
              ? (printingOff
                  ? 'MVP launch — sign in and download the STL for free.'
                  : 'MVP launch — sign in and download the STL for free. Printing options coming back soon.')
              : 'Checkout for $2 to download the file, or order it printed and shipped.'),
        ),
      ));
    }
  }

  // ──────────────────────────────────────────────────────────────
  // RIGHT SIDEBAR — pricing + how-it-works snippet
  // ──────────────────────────────────────────────────────────────
  function renderRight() {
    clear(rightAside);

    // Pricing card — was at the bottom of the sidebar previously,
    // promoted to top now that the designs gallery is gone.
    const sidebarTiers = [
      ['STL Download', '$2.00',  'instant download'],
    ];
    if (!printingOff) {
      sidebarTiers.push(['Printed Stem', '$19.99', 'shipped to you']);
      sidebarTiers.push(['Pack of 4',    '$59.99', 'one for each wheel']);
    }
    rightAside.appendChild(
      el('div', {
        class: paymentsOff ? 'rounded-xl p-4 border sdz-graffiti-x' : 'rounded-xl p-4 border',
        style: { background: '#FFFFFF', borderColor: '#D7CFB6', position: 'relative' },
      },
        el('div.flex.items-center.gap-2.mb-3',
          icon('creditCard', { size: 14, color: '#7B2EFF' }),
          el('span.uppercase', {
            style: { color: '#3D2F4A', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' },
          },
            paymentsOff
              ? el('span', { class: 'sdz-graffiti-strike' }, 'Pricing')
              : 'Pricing'
          ),
        ),
        el('div', { class: 'flex flex-col gap-2' },
          ...sidebarTiers.map(([label, price, sub]) =>
            el('div.flex.justify-between.items-start.py-1',
              el('div.flex.flex-col',
                el('span', { style: { color: '#0E0A12', fontSize: '0.85rem', fontWeight: 600 } }, label),
                el('span', { style: { color: '#3D2F4A', fontSize: '0.7rem' } }, sub),
              ),
              el('span', { style: { color: '#7B2EFF', fontSize: '0.95rem', fontWeight: 700 } }, price),
            )
          ),
        ),
        paymentsOff
          ? el(
              'div',
              {
                style: {
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-6deg)',
                  zIndex: 5,
                  pointerEvents: 'none',
                },
              },
              el(
                'span',
                { class: 'sdz-graffiti-tag', style: { fontSize: '1.4rem' } },
                'Free!'
              )
            )
          : null,
      ),
    );

    // Workshop reassurance card — fills the visual real estate the
    // gallery used to occupy and reinforces brand values.
    rightAside.appendChild(
      el('div', {
        class: 'rounded-xl p-4 border',
        style: { background: '#E5E0CC', borderColor: '#D7CFB6' },
      },
        el('div.flex.items-center.gap-2.mb-2',
          icon('settings', { size: 14, color: '#D89E2F' }),
          el('span.uppercase', {
            style: { color: '#3D2F4A', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em' },
          }, '3D Printing Tips'),
        ),
        el('p', {
          style: { color: '#0E0A12', fontSize: '0.8rem', lineHeight: 1.5 },
        }, 'Designed for FDM/PLA on a 0.4 mm nozzle at 0.12–0.16 mm layers. Threads are tuned to a real Schrader valve.'),
        el('p', {
          class: 'mt-2',
          style: { color: '#0E0A12', fontSize: '0.78rem', lineHeight: 1.5, fontWeight: 600 },
        }, 'Add a 5 mm brim with 0 mm brim-to-object gap.'),
        el('p', {
          class: 'mt-1',
          style: { color: '#3D2F4A', fontSize: '0.74rem', lineHeight: 1.5 },
        }, 'The cap is tall and narrow — without the brim it can shear off the bed mid-print. Set this in Bambu Studio / OrcaSlicer / PrusaSlicer under "Skirt and brim → Brim type: Outer + skirt, Brim width: 5 mm, Brim-object gap: 0".'),
        el('p', {
          class: 'mt-2',
          style: { color: '#3D2F4A', fontSize: '0.74rem', lineHeight: 1.5 },
        }, 'Print cap-down on the bed — no supports needed.'),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Event handlers
  // ──────────────────────────────────────────────────────────────
  function handleFile(file) {
    if (!file.type.startsWith('image/')) return;
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    state.photoUrl = URL.createObjectURL(file);
    state.photoFile = file;
    state.photoName = file.name;
    state.stlReady = false;
    state.stlData = null;
    state.headStlData = null;
    state.finalStlData = null;
    state.finalFailed = false;
    state.finalErrorMessage = null;
    state.objectModeUsed = false;
    state.designId = null;
    state.designTriangles = 0;
    renderUploader();
    pushViewer();
    renderViewerHeader();
    renderObjectModeBanner();
    renderCentralActions();
    renderActions();
    renderFeedback();
    announce(`Photo "${file.name}" ready. Tap Generate when you're set.`);
    // P3-001 — lightweight client-side face hint. The acceptance criteria
    // call for face-api.js / mediapipe but those add ~5 MB of model
    // weights. Ship a heuristic-only first cut: load the image, sample
    // skin-tone-ish pixels in the upper third, and if the count is way
    // under threshold show a soft warning chip — no hard block. The
    // server-side NSFW + face check (P3-012) is the real gate.
    sniffForFace(state.photoUrl)
      .then((hint) => {
        if (hint === 'no_face_likely') {
          announce(
            'Heads-up: we couldn’t spot a face in this photo. Try one with the head centred and well-lit.'
          );
        } else if (hint === 'face_too_small') {
          // iPhone wide-shot selfies put the head in <15% of the frame
          // and TRELLIS produces narrower meshes that fail stage 3
          // wall-thickness checks more often. Surface a soft hint up
          // front so the user re-frames before generating.
          announce(
            'Heads-up: your head looks small in the frame. A closer photo (shoulders up) gives a thicker, more printable cap.'
          );
        }
      })
      .catch(() => {});
  }

  function sniffForFace(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = 64;
          const h = Math.round((img.naturalHeight / img.naturalWidth) * 64) || 64;
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, Math.floor(h / 2)).data; // upper half
          let skin = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i],
              g = data[i + 1],
              b = data[i + 2];
            // Cheap skin-tone band: R > 95, G > 40, B > 20, R > G, R > B,
            // |R-G| > 15. Imprecise on purpose.
            if (r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15) skin++;
          }
          const ratio = skin / (data.length / 4);
          // Three buckets:
          //   < 0.05  → no_face_likely (no skin at all in upper half)
          //   < 0.12  → face_too_small (some skin but the head fills
          //             too little of the frame — TRELLIS struggles
          //             with this and stage 3 thin-walls become likely)
          //   else    → maybe_face (good enough; server-side P3-012
          //             face check is the real gate)
          if (ratio < 0.05) resolve('no_face_likely');
          else if (ratio < 0.12) resolve('face_too_small');
          else resolve('maybe_face');
        } catch {
          resolve('unknown');
        }
      };
      img.onerror = () => resolve('unknown');
      img.src = url;
    });
  }

  // X-009 — "Try a sample" affordance. Loads a tiny built-in dummy image
  // so first-time visitors can see the flow before uploading. The full
  // acceptance criteria call for a real sample photo committed to the
  // repo; this stub picks an Unsplash CC0 portrait and (when offline)
  // falls back to a 1×1 PNG so the action never throws.
  async function loadSamplePhoto() {
    const url = 'https://images.unsplash.com/photo-1684770114368-6e01b4f8741a?w=512&q=80';
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) throw new Error('fetch_failed');
      const blob = await res.blob();
      const file = new File([blob], 'sample-portrait.jpg', { type: blob.type });
      handleFile(file);
    } catch {
      const tiny = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        ),
        (c) => c.charCodeAt(0)
      );
      const file = new File([tiny], 'sample.png', { type: 'image/png' });
      handleFile(file);
    }
  }

  function friendlyError(err) {
    const code = err?.code || err?.message || '';
    const map = {
      no_face_detected: "We couldn't find a face. Try a clearer, head-on photo.",
      unsafe_image: 'That image was rejected by our safety check.',
      minor_likeness: "We don't process likenesses of minors.",
      rate_limited: 'Whoa — slow down a touch. Try again in a minute.',
      // In free-MVP mode, a payment_required error means the caller
      // wasn't authenticated — surface the actual ask.
      payment_required: paymentsOff
        ? 'Sign in to download for free.'
        : 'Buy the STL to unlock the download.',
      auth_required: 'Sign in to download for free.',
      runpod_unreachable: "Our GPU service didn't answer. Try again shortly.",
      runpod_no_result: "Generation didn't finish. Try a different photo.",
      worker_failed: 'The worker had a wobble. Try again.',
      image_too_large: 'That image is too large. Try one under 10 MB.',
      image_required: 'Pick a photo first.',
      // Pipeline gates are now warn-and-continue (handler v0.1.35),
      // but if the topology check ever does fire we want a friendlier
      // explanation than the raw code. "Try a closer photo" is the
      // single instruction that fixes >80% of these in practice.
      output_dimensions_out_of_range:
        'That photo produced a mesh too thin or too large to print. Try a closer head-on photo, or lower the Crop Tightness slider.',
      output_not_watertight:
        'The 3D mesh came out with holes. Try a different photo — head centred, plain background works best.',
      stage_timeout:
        'The GPU took too long on that photo. Try a smaller / clearer image, or hit Generate again.',
      mesh_too_large:
        'TRELLIS produced an unusually heavy mesh. Try a different photo or hit Generate again.',
    };
    return map[code] || err?.message || 'Something went wrong.';
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('file_read_failed'));
      reader.readAsDataURL(file);
    });
  }

  async function handleGenerate() {
    if (!state.photoUrl || state.processing) return;
    state.processing = true;
    state.stlReady = false;
    state.stlData = null;
    state.headStlData = null;
    state.finalStlData = null;
    state.finalFailed = false;
    state.finalErrorMessage = null;
    state.objectModeUsed = false;
    state.progress = 0;
    state.processingStep = '';
    state.designId = null;
    state.lastError = null; // clear any previous error banner
    renderActions();
    renderViewerHeader();
    renderObjectModeBanner();
    renderCentralActions();
    pushViewer();
    renderFeedback();

    try {
      const imageData = state.photoFile ? await fileToBase64(state.photoFile) : null;
      if (!imageData) throw new Error('photo_required');

      const result = await socket.request('stl.generate', {
        imageData,
        imageName: state.photoName,
        settings: {
          headScale: state.headScale,
          headTilt: state.headTilt,                           // v1: pitch (chin up)
          cropTightness: state.cropTightness,                 // v1: shoulder_taper_fraction
          targetHeadHeightMm: state.targetHeadHeightMm,       // v1: TARGET_HEAD_HEIGHT_MM
          capProtrusionPct: state.capProtrusionPct,           // v1: CAP_PROTRUSION_FRACTION (× 100)
          materialType: state.materialType,
          headColor: state.headColor,
        },
      }, {
        onMessage: (name, payload) => {
          if (name === 'stl.generate.progress') {
            state.progress = payload.pct;
            state.processingStep = payload.step;
            renderActions();
            // P6-007 — one announcement per *stage transition*, not per pct tick.
            if (payload.step) announce(`${payload.step}, ${payload.pct} percent`);
          } else if (name === 'stl.generate.warning') {
            announce(`Notice: ${payload.message}`, false);
          }
        },
      });
      state.designId = result.designId;
      state.designTriangles = result.triangles || 0;
      // v0.1.42 dual-output. New shape: head_stl_b64 + final_stl_b64
      // + final_failed. Fall back to result.stl_b64 if the server is
      // pre-v0.1.42 (the legacy single-STL field is also still set).
      state.headStlData  = result.head_stl_b64  || null;
      state.finalStlData = result.final_stl_b64 || (result.stl_b64 && !result.final_failed ? result.stl_b64 : null);
      state.finalFailed  = !!result.final_failed;
      state.finalErrorMessage = result.final_error_message || null;
      // v0.1.43 — object_mode_used: head not detected, cap glued onto
      // raw TRELLIS output. Drives the prominent banner + relabels
      // both panel headers from "Your head" → "Your scan".
      state.objectModeUsed = !!result.object_mode_used;
      state.stlData = state.finalStlData || state.headStlData; // legacy alias
      state.stlReady = !!(state.headStlData || state.finalStlData);
      // Tailored success / partial-success copy. Object-mode gets
      // the loudest treatment because the rider almost certainly
      // expected a head and got something else.
      if (state.objectModeUsed) {
        announce("We couldn't find a face in your photo, so we made a valve cap out of whatever you uploaded. Both STLs are ready — your scan and scan-plus-cap.", true);
      } else if (state.finalFailed && state.headStlData) {
        announce('Boolean step failed but your head STL is ready — download it from the head panel.', true);
      } else if (state.finalStlData) {
        announce(paymentsOff
          ? 'Both STLs ready. Sign in and tap a Download button.'
          : 'STL ready. Tap Buy STL to download.');
      } else if (state.headStlData) {
        announce('Head STL ready. Tap Download below it.');
      }
      sessionStorage.setItem('stemdomez.designId', result.designId);
      renderViewerHeader();
      renderObjectModeBanner();
      renderCentralActions();
      renderFeedback();
    } catch (err) {
      console.error('stl.generate failed', err);
      state.processingStep = `Error: ${err.message}`;
      state.lastError = friendlyError(err);
      announce(`Generation failed: ${state.lastError}`, true);
    } finally {
      state.processing = false;
      state.progress = 0;
      renderActions();
      renderViewerHeader();
      pushViewer();
    }
  }

  async function handleCheckout() {
    if (!state.designId || state.checkoutPending) return;
    state.checkoutPending = true;
    renderActions();

    if (paymentsOff) {
      // MVP free-download path. Server enforces login + that the
      // payments_enabled flag is OFF; if the user isn't signed in we
      // bounce them to /login with a return-to so they come back here.
      try {
        const res = await socket.request('stl.downloadFree', {
          designId: state.designId,
        });
        triggerStlDownload(res);
        announce('STL downloaded.');
      } catch (err) {
        if (err.message === 'auth_required') {
          // Stash the design id so /login can come back here.
          sessionStorage.setItem('stemdomez.designId', state.designId);
          announce('Please sign in to download your free STL. Redirecting…', true);
          alert('Please sign in to download your STL — it\'s free for the MVP launch.');
          const next = encodeURIComponent('/stemdome-generator');
          window.location.assign(`/login?next=${next}`);
          return;
        }
        announce(`Download failed: ${friendlyError(err)}`, true);
        alert(`Could not download: ${friendlyError(err)}`);
      } finally {
        state.checkoutPending = false;
        renderActions();
      }
      return;
    }

    try {
      const { url } = await socket.request('payments.createCheckoutSession', {
        designId: state.designId,
      });
      if (!url) throw new Error('no_checkout_url');
      window.location.assign(url);
    } catch (err) {
      state.checkoutPending = false;
      alert(err.message === 'stripe_not_configured'
        ? 'Checkout is disabled in this environment. Configure STRIPE_SECRET_KEY to enable downloads.'
        : `Could not start checkout: ${err.message}`);
      renderActions();
    }
  }

  function triggerStlDownload({ filename, stl_b64 }) {
    if (!stl_b64) return;
    const bin = atob(stl_b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'model/stl' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'StemDomeZ_ValveStem.stl';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  // First paint
  renderUploader();
  renderViewerHeader();
  renderObjectModeBanner();
  renderCentralActions();
  renderSettings();
  renderActions();
  renderFeedback();
  renderRight();

  // Post-login auto-resume.
  //
  // An anon rider hits Download or Email → we stash designId +
  // pendingAction in sessionStorage and bounce to /login. After
  // login, they land back here. This block:
  //   1. Reads sessionStorage for the stash
  //   2. Confirms they're now authed (auth.whoami)
  //   3. Re-fetches the design's STL bytes (designs.getForViewer)
  //      — this also CLAIMS the anon design onto their account
  //   4. Populates the panels so the rider sees what they generated
  //   5. Auto-runs the pending action (download or email)
  //   6. Clears the stash so a refresh doesn't re-trigger
  //
  // Failure modes are swallowed quietly — if anything goes wrong the
  // page just stays on its empty state and the rider can re-upload.
  (async () => {
    const designId = sessionStorage.getItem('stemdomez.designId');
    const intent   = sessionStorage.getItem('stemdomez.pendingAction');
    if (!designId || !intent) return;

    let user = null;
    try {
      const who = await socket.request('auth.whoami');
      user = who?.user || null;
    } catch { /* not authed or socket dead */ }
    if (!user) return; // still anon — nothing to resume yet

    try {
      announce('Welcome back. Fetching your design…');
      const res = await socket.request('designs.getForViewer', { designId });
      // Re-hydrate state from the fetched design.
      state.designId = res.designId;
      state.headStlData  = res.head_stl_b64  || null;
      state.finalStlData = res.final_stl_b64 || null;
      state.finalFailed  = !!res.final_failed;
      state.finalErrorMessage = null; // not persisted; ok to leave empty on resume
      state.objectModeUsed = !!res.object_mode_used;
      state.stlData = state.finalStlData || state.headStlData;
      state.stlReady = !!(state.headStlData || state.finalStlData);
      renderViewerHeader();
      renderObjectModeBanner();
      renderCentralActions();
      pushViewer();
      renderFeedback();

      // Clear the stash BEFORE running the action — a failure during
      // download/email shouldn't trap the rider in a re-trigger loop
      // on every refresh.
      sessionStorage.removeItem('stemdomez.pendingAction');

      if (intent === 'download') {
        announce("Signed in. Downloading your STLs now…");
        await downloadAllStls();
      } else if (intent === 'email') {
        announce("Signed in. Sending your STLs to your email now…");
        await emailAllStls();
      }
    } catch (err) {
      console.warn('post-login resume failed', err);
      // Don't kill the page — let the rider see whatever state we
      // have and proceed manually.
    }
  })();

  return {
    el: root,
    destroy() {
      headPanel.viewer.destroy?.();
      finalPanel.viewer.destroy?.();
      if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    },
  };
}

// ---- Small factories used across settings ---------------------------------

function legendSwatch(color, label) {
  return el('div', { class: 'flex items-center gap-1.5' },
    el('span', {
      class: 'inline-block rounded-full',
      style: { width: '8px', height: '8px', background: color },
    }),
    el('span', { style: { color: '#3D2F4A' } }, label),
  );
}

function slider({ label, value, min, max, step, display, onInput }) {
  const valueEl = el('span', {
    style: { color: '#7B2EFF', fontSize: '0.8rem', fontWeight: 700 },
  }, display(value));
  const input = el('input', {
    type: 'range',
    min, max, step,
    value,
    class: 'w-full',
    style: { accentColor: '#7B2EFF' },
    onInput: (e) => {
      const v = Number(e.target.value);
      valueEl.textContent = display(v);
      onInput(v);
    },
  });
  return el('div.flex.flex-col.gap-2',
    el('div.flex.justify-between.items-center',
      el('label', { style: { color: '#3D2F4A', fontSize: '0.8rem' } }, label),
      valueEl,
    ),
    input,
  );
}

function colorRow({ value, onInput }) {
  const input = el('input', {
    type: 'color',
    value,
    class: 'w-10 h-8 rounded cursor-pointer border',
    style: { borderColor: '#D7CFB6', background: 'transparent' },
    onInput: (e) => {
      onInput(e.target.value);
      swatchLabel.textContent = e.target.value;
    },
  });
  const swatchLabel = el('span', {
    style: { color: '#3D2F4A', fontSize: '0.78rem' },
  }, value);
  return el('div.flex.flex-col.gap-2',
    el('label', { style: { color: '#3D2F4A', fontSize: '0.8rem' } }, 'Head Color'),
    el('div.flex.items-center.gap-3', input, swatchLabel),
  );
}

function materialRow({ value, onChange }) {
  const buttons = ['matte', 'gloss', 'chrome'].map((m) => {
    const active = value === m;
    return el('button', {
      class: 'flex-1 py-2 rounded-xl capitalize border transition-all',
      style: {
        background: active ? 'rgba(123,46,255,0.08)' : '#FFFFFF',
        borderColor: active ? '#7B2EFF' : '#D7CFB6',
        color: active ? '#7B2EFF' : '#3D2F4A',
        fontSize: '0.82rem',
        fontWeight: 600,
      },
      onClick: () => onChange(m),
    }, m);
  });
  return el('div.flex.flex-col.gap-2', { class: 'sm:col-span-2' },
    el('label', { style: { color: '#3D2F4A', fontSize: '0.8rem' } }, 'Material Finish'),
    el('div.flex.gap-2', ...buttons),
  );
}
