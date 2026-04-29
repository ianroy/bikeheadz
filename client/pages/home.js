import { el, clear } from '../dom.js';
import { icon } from '../icons.js';
import { createValveStemViewer } from '../components/valve-stem-viewer.js';

export function HomePage({ socket }) {
  const state = {
    photoUrl: null,
    photoFile: null,
    photoName: null,
    dragging: false,
    processing: false,
    progress: 0,
    processingStep: '',
    stlReady: false,
    stlData: null,
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
    el('div',
      el('h1', {
        style: { fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em' },
      },
        'Your Head on a ',
        el('span', { style: { color: '#C71F1F' } }, 'Valve Stem'),
      ),
      el('p.mt-1', {
        style: { color: '#6B6157', fontSize: '0.9rem' },
      }, 'Upload a photo → get a 3D-printable STL file personalized to you'),
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
      class: 'relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer',
      style: {
        borderColor: state.dragging
          ? '#C71F1F'
          : state.photoUrl
          ? '#E5DFD3'
          : '#E5DFD3',
        background: state.dragging
          ? 'rgba(199,31,31,0.05)'
          : '#FFFFFF',
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
            { style: { color: '#1A1614', fontSize: '0.95rem', fontWeight: 600 } },
            'Drop a photo, paste from clipboard, or click to upload'
          ),
          el('p', { style: { color: '#6B6157', fontSize: '0.78rem' } }, 'PNG or JPEG, up to 5 MB'),
          el(
            'button',
            {
              class: 'mt-2 px-3 py-1.5 rounded-lg border',
              style: {
                borderColor: '#C71F1F',
                background: 'rgba(199,31,31,0.06)',
                color: '#C71F1F',
                fontSize: '0.8rem',
                fontWeight: 600,
              },
              onClick: (e) => {
                e.stopPropagation();
                loadSamplePhoto();
              },
            },
            'Try with a sample photo'
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
          style: { borderColor: '#E5DFD3' },
        },
          el('img', { src: state.photoUrl, alt: 'Uploaded', class: 'w-full h-full object-cover' }),
        ),
        el('div.flex-1.min-w-0',
          el('p', { style: { fontWeight: 600, fontSize: '0.9rem' } }, state.photoName || 'Photo uploaded'),
          el('p', { style: { color: '#6B6157', fontSize: '0.78rem' } }, 'Ready to generate your valve stem'),
        ),
        el('button', {
          class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors',
          style: { borderColor: '#E5DFD3', color: '#6B6157', fontSize: '0.78rem', background: 'transparent' },
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
          style: { background: 'linear-gradient(135deg, #F5F1E8, #FAF7F2)', border: '1px solid rgba(199,31,31,0.3)' },
        }, icon('upload', { size: 24, color: '#C71F1F' })),
        el('div.text-center',
          el('p', { style: { fontWeight: 600 } }, 'Upload Your Photo'),
          el('p.mt-1', { style: { color: '#6B6157', fontSize: '0.82rem' } }, 'Drag & drop or click to browse · JPG, PNG, HEIC'),
        ),
        el('button', {
          class: 'px-5 py-2 rounded-xl transition-all',
          style: { background: '#C71F1F', color: '#FFFFFF', fontWeight: 700, fontSize: '0.88rem' },
        }, 'Choose Photo'),
      ));
    }

    uploaderSlot.appendChild(box);
  }

  // Viewer
  const viewerSlot = el('div', {
    class: 'rounded-2xl overflow-hidden border',
    style: { background: '#FFFFFF', borderColor: '#E5DFD3' },
  });
  center.appendChild(viewerSlot);

  const viewerHeader = el('div.flex.items-center.justify-between.px-4.py-3.border-b', {
    style: { borderColor: '#E5DFD3' },
  });
  viewerSlot.appendChild(viewerHeader);

  const viewerCanvas = el('div', { style: { height: '380px', position: 'relative' } });
  viewerSlot.appendChild(viewerCanvas);

  viewerSlot.appendChild(
    el('div.flex.items-center.gap-6.px-4.py-3.border-t', {
      style: { borderColor: '#E5DFD3', fontSize: '0.75rem' },
    },
      legendSwatch('#C71F1F', '3D Scanned Head'),
      legendSwatch('#A88735', 'Schrader Valve Stem'),
      legendSwatch('#9CA3AF', 'Chrome Body'),
    ),
  );

  function renderViewerHeader() {
    clear(viewerHeader);
    const leftRow = el('div.flex.items-center.gap-2',
      icon('layers', { size: 14, color: '#C71F1F' }),
      el('span', { style: { color: '#1A1614', fontWeight: 600, fontSize: '0.88rem' } }, '3D Model Preview'),
    );
    if (state.processing) {
      leftRow.appendChild(el('span', {
        class: 'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        style: { background: 'rgba(199,31,31,0.12)', fontSize: '0.7rem', color: '#C71F1F' },
      },
        el('span.pulse-dot.inline-block.rounded-full', {
          style: { width: '6px', height: '6px', background: '#C71F1F' },
        }),
        'Processing',
      ));
    }
    if (state.stlReady) {
      leftRow.appendChild(el('span', {
        class: 'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        style: { background: 'rgba(199,31,31,0.12)', fontSize: '0.7rem', color: '#C71F1F' },
      }, '\u2713 STL Ready'));
    }
    viewerHeader.appendChild(leftRow);

    viewerHeader.appendChild(
      el('div.flex.items-center.gap-2', {
        style: { color: '#6B6157', fontSize: '0.72rem' },
      },
        icon('rotate', { size: 14 }),
        'Drag to rotate',
      ),
    );
  }

  const viewer = createValveStemViewer({
    container: viewerCanvas,
    initial: {
      headScale: state.headScale,
      headTilt: state.headTilt,
      materialType: state.materialType,
      headColor: state.headColor,
      photoUrl: state.photoUrl,
      processing: state.processing,
    },
  });

  function pushViewer() {
    viewer.update({
      headScale: state.headScale,
      headTilt: state.headTilt,
      materialType: state.materialType,
      headColor: state.headColor,
      photoUrl: state.photoUrl,
      processing: state.processing,
      stlData: state.stlData,
    });
  }

  // Settings toggle + panel
  const settingsToggle = el('button', {
    class: 'flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-colors text-left',
    style: { background: '#FFFFFF', borderColor: '#E5DFD3' },
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
        icon('settings', { size: 16, color: '#C71F1F' }),
        el('span', { style: { color: '#1A1614', fontWeight: 600, fontSize: '0.88rem' } }, 'Adjust 3D Settings'),
      ),
      el('div', {
        style: {
          transition: 'transform 0.2s',
          transform: state.showSettings ? 'rotate(90deg)' : 'rotate(0deg)',
          color: '#6B6157',
        },
      }, icon('chevronRight', { size: 16 })),
    );

    settingsPanel.classList.toggle('open', state.showSettings);
    if (!state.showSettings) return;

    clear(settingsInner);
    settingsInner.className = 'rounded-2xl border p-5 grid grid-cols-1 sm:grid-cols-2 gap-5';
    Object.assign(settingsInner.style, { background: '#FFFFFF', borderColor: '#E5DFD3' });

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
    if (feedbackSubmitted.has(designId)) {
      feedbackSlot.appendChild(
        el('div', {
          class: 'rounded-xl px-4 py-2 border',
          style: { background: '#F5F1E8', borderColor: '#E5DFD3', color: '#3D3A36', fontSize: '0.82rem' },
        }, 'Thanks for the feedback'),
      );
      return;
    }
    const row = el('div', {
      class: 'flex items-center gap-3 rounded-xl px-4 py-2 border',
      style: { background: '#FFFFFF', borderColor: '#E5DFD3' },
    });
    row.appendChild(
      el('span', {
        style: { color: '#6B6157', fontSize: '0.78rem', fontWeight: 600 },
      }, 'How did we do?'),
    );
    // Spec lists 👍 ❤️ 🤷 against the up/down/meh schema. The middle
    // emoji is heart-shaped and isn't a "down"-vote in casual usage,
    // but the schema only permits up|down|meh and the spec is explicit
    // about ordering — we map by position so the column-three button
    // is always 'meh' (the genuine indifference signal).
    const buttons = [
      { rating: 'up',   label: '\u{1F44D}' },
      { rating: 'down', label: '❤️' },
      { rating: 'meh',  label: '\u{1F937}' },
    ];
    for (const b of buttons) {
      row.appendChild(
        el('button', {
          class: 'px-2 py-1 rounded-lg border transition-colors',
          style: { borderColor: '#E5DFD3', background: '#FAF7F2', fontSize: '1.05rem', cursor: 'pointer' },
          'aria-label': `feedback ${b.rating}`,
          onClick: () => submitFeedback(designId, b.rating),
        }, b.label),
      );
    }
    feedbackSlot.appendChild(row);
  }

  function submitFeedback(designId, rating) {
    feedbackSubmitted.add(designId);
    renderFeedback();
    // Fire-and-forget — failures here aren't worth interrupting the
    // user. The server logs the error and the client simply doesn't
    // re-prompt because we already moved to the thank-you state.
    socket.send('feedback.submit', { designId, rating });
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
      background: canGenerate ? 'linear-gradient(135deg, #C71F1F, #B91C1C)' : '#E5DFD3',
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
    downloadBtn.append(
      icon('creditCard', { size: 16, color: canPurchase ? '#FFFFFF' : '#6B6157' }),
      state.checkoutPending ? 'Redirecting…' : 'Buy STL · $2',
    );
    Object.assign(downloadBtn.style, {
      background: canPurchase ? 'linear-gradient(135deg, #C71F1F, #B91C1C)' : '#E5DFD3',
      color: canPurchase ? '#FFFFFF' : '#6B6157',
      border: 'none',
      cursor: canPurchase ? 'pointer' : 'not-allowed',
      opacity: canPurchase ? 1 : 0.7,
    });
    downloadBtn.disabled = !canPurchase;

    clear(readyBanner);
    if (state.stlReady) {
      readyBanner.appendChild(el('div', {
        class: 'fade-up rounded-xl px-4 py-3 border flex items-center gap-3',
        style: { background: 'rgba(199,31,31,0.06)', borderColor: 'rgba(199,31,31,0.25)' },
      },
        el('span', { style: { fontSize: '1.5rem' } }, '\u{1F389}'),
        el('div',
          el('p', {
            style: { color: '#C71F1F', fontWeight: 700, fontSize: '0.88rem' },
          },
            `Your STL is ready — ${state.designTriangles.toLocaleString()} triangles.`,
          ),
          el('p', {
            style: { color: '#6B6157', fontSize: '0.78rem' },
          }, 'Checkout for $2 to download the file, or order it printed and shipped.'),
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
    rightAside.appendChild(
      el('div', {
        class: 'rounded-xl p-4 border',
        style: { background: '#FFFFFF', borderColor: '#E5DFD3' },
      },
        el('div.flex.items-center.gap-2.mb-3',
          icon('creditCard', { size: 14, color: '#C71F1F' }),
          el('span.uppercase', {
            style: { color: '#6B6157', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' },
          }, 'Pricing'),
        ),
        el('div', { class: 'flex flex-col gap-2' },
          ...[
            ['STL Download', '$2.00',  'instant download'],
            ['Printed Stem', '$19.99', 'shipped to you'],
            ['Pack of 4',    '$59.99', 'one for each wheel'],
          ].map(([label, price, sub]) =>
            el('div.flex.justify-between.items-start.py-1',
              el('div.flex.flex-col',
                el('span', { style: { color: '#1A1614', fontSize: '0.85rem', fontWeight: 600 } }, label),
                el('span', { style: { color: '#6B6157', fontSize: '0.7rem' } }, sub),
              ),
              el('span', { style: { color: '#C71F1F', fontSize: '0.95rem', fontWeight: 700 } }, price),
            )
          ),
        ),
      ),
    );

    // Workshop reassurance card — fills the visual real estate the
    // gallery used to occupy and reinforces brand values.
    rightAside.appendChild(
      el('div', {
        class: 'rounded-xl p-4 border',
        style: { background: '#F5F1E8', borderColor: '#E5DFD3' },
      },
        el('div.flex.items-center.gap-2.mb-2',
          icon('settings', { size: 14, color: '#7C5E1F' }),
          el('span.uppercase', {
            style: { color: '#3D3A36', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em' },
          }, '3D Printing Tips'),
        ),
        el('p', {
          style: { color: '#1A1614', fontSize: '0.8rem', lineHeight: 1.5 },
        }, 'Designed for FDM/PLA on a 0.4 mm nozzle at 0.12–0.16 mm layers. Threads are tuned to a real Schrader valve.'),
        el('p', {
          class: 'mt-2',
          style: { color: '#1A1614', fontSize: '0.78rem', lineHeight: 1.5, fontWeight: 600 },
        }, 'Add a 5 mm brim with 0 mm brim-to-object gap.'),
        el('p', {
          class: 'mt-1',
          style: { color: '#3D3A36', fontSize: '0.74rem', lineHeight: 1.5 },
        }, 'The cap is tall and narrow — without the brim it can shear off the bed mid-print. Set this in Bambu Studio / OrcaSlicer / PrusaSlicer under "Skirt and brim → Brim type: Outer + skirt, Brim width: 5 mm, Brim-object gap: 0".'),
        el('p', {
          class: 'mt-2',
          style: { color: '#3D3A36', fontSize: '0.74rem', lineHeight: 1.5 },
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
    state.designId = null;
    state.designTriangles = 0;
    renderUploader();
    pushViewer();
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
          resolve(ratio < 0.05 ? 'no_face_likely' : 'maybe_face');
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
      payment_required: 'Buy the STL to unlock the download.',
      runpod_unreachable: "Our GPU service didn't answer. Try again shortly.",
      runpod_no_result: "Generation didn't finish. Try a different photo.",
      worker_failed: 'The worker had a wobble. Try again.',
      image_too_large: 'That image is too large. Try one under 5 MB.',
      image_required: 'Pick a photo first.',
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
    state.progress = 0;
    state.processingStep = '';
    state.designId = null;
    renderActions();
    renderViewerHeader();
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
      announce('STL ready. Tap Buy STL to download.');
      state.designId = result.designId;
      state.designTriangles = result.triangles || 0;
      state.stlData = result.stl_b64 || null;
      state.stlReady = true;
      sessionStorage.setItem('valveheadz.designId', result.designId);
      renderFeedback();
    } catch (err) {
      console.error('stl.generate failed', err);
      state.processingStep = `Error: ${err.message}`;
      announce(`Generation failed: ${friendlyError(err)}`, true);
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

  // First paint
  renderUploader();
  renderViewerHeader();
  renderSettings();
  renderActions();
  renderFeedback();
  renderRight();

  return {
    el: root,
    destroy() {
      viewer.destroy();
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
    el('span', { style: { color: '#6B6157' } }, label),
  );
}

function slider({ label, value, min, max, step, display, onInput }) {
  const valueEl = el('span', {
    style: { color: '#C71F1F', fontSize: '0.8rem', fontWeight: 700 },
  }, display(value));
  const input = el('input', {
    type: 'range',
    min, max, step,
    value,
    class: 'w-full',
    style: { accentColor: '#C71F1F' },
    onInput: (e) => {
      const v = Number(e.target.value);
      valueEl.textContent = display(v);
      onInput(v);
    },
  });
  return el('div.flex.flex-col.gap-2',
    el('div.flex.justify-between.items-center',
      el('label', { style: { color: '#3D3A36', fontSize: '0.8rem' } }, label),
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
    style: { borderColor: '#E5DFD3', background: 'transparent' },
    onInput: (e) => {
      onInput(e.target.value);
      swatchLabel.textContent = e.target.value;
    },
  });
  const swatchLabel = el('span', {
    style: { color: '#6B6157', fontSize: '0.78rem' },
  }, value);
  return el('div.flex.flex-col.gap-2',
    el('label', { style: { color: '#3D3A36', fontSize: '0.8rem' } }, 'Head Color'),
    el('div.flex.items-center.gap-3', input, swatchLabel),
  );
}

function materialRow({ value, onChange }) {
  const buttons = ['matte', 'gloss', 'chrome'].map((m) => {
    const active = value === m;
    return el('button', {
      class: 'flex-1 py-2 rounded-xl capitalize border transition-all',
      style: {
        background: active ? 'rgba(199,31,31,0.08)' : '#FFFFFF',
        borderColor: active ? '#C71F1F' : '#E5DFD3',
        color: active ? '#C71F1F' : '#6B6157',
        fontSize: '0.82rem',
        fontWeight: 600,
      },
      onClick: () => onChange(m),
    }, m);
  });
  return el('div.flex.flex-col.gap-2', { class: 'sm:col-span-2' },
    el('label', { style: { color: '#3D3A36', fontSize: '0.8rem' } }, 'Material Finish'),
    el('div.flex.gap-2', ...buttons),
  );
}
