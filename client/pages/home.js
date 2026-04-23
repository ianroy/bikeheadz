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
    headScale: 0.85,
    neckLength: 50,
    headTilt: 0,
    materialType: 'chrome',
    headColor: '#c8b8a0',
    showSettings: false,
    selectedDesign: null,
    designs: [],
    events: [],
    designId: null,
    designTriangles: 0,
    checkoutPending: false,
  };

  const root = el('div.max-w-7xl.mx-auto.px-4.py-6');
  const grid = el('div', {
    class: 'grid grid-cols-1 lg:grid-cols-[220px_1fr_260px] gap-6',
  });
  root.appendChild(grid);

  const leftAside = el('aside.flex.flex-col.gap-4', { class: 'hidden lg:flex' });
  const center = el('section.flex.flex-col.gap-5');
  const rightAside = el('aside.flex.flex-col.gap-4');
  grid.append(leftAside, center, rightAside);

  // ──────────────────────────────────────────────────────────────
  // LEFT SIDEBAR — ads + events
  // ──────────────────────────────────────────────────────────────
  function renderLeft() {
    clear(leftAside);
    leftAside.appendChild(
      el('div.flex.items-center.gap-2.mb-1',
        icon('megaphone', { size: 14, color: '#b4ff45' }),
        el('span.uppercase', {
          style: { color: '#9090b0', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' },
        }, 'Ads & Events'),
      ),
    );

    for (const ev of state.events) {
      leftAside.appendChild(
        el('div', {
          class: 'rounded-xl overflow-hidden border transition-colors cursor-pointer group',
          style: { background: '#111120', borderColor: '#1e1e35' },
        },
          el('div.relative.overflow-hidden', { style: { height: '7rem' } },
            el('img', {
              src: ev.img,
              alt: ev.title,
              class: 'w-full h-full object-cover transition-transform duration-500',
            }),
            el('div.absolute.inset-0', {
              style: { background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' },
            }),
            el('div', {
              class: 'absolute flex items-center gap-1.5',
              style: { left: '8px', bottom: '8px' },
            },
              icon('calendar', { size: 12, color: '#b4ff45' }),
              el('span', { style: { color: '#fff', fontSize: '0.7rem', fontWeight: 700 } }, ev.date),
            ),
          ),
          el('div.p-3',
            el('p', { style: { color: '#e0e0f0', fontSize: '0.8rem', fontWeight: 600 } }, ev.title),
            el('p', { style: { color: '#808098', fontSize: '0.7rem' } }, ev.location),
          ),
        ),
      );
    }

    leftAside.appendChild(
      el('div', {
        class: 'rounded-xl p-4 border relative overflow-hidden',
        style: { background: 'linear-gradient(135deg, #0f1a05, #1a2a08)', borderColor: 'rgba(180,255,69,0.2)' },
      },
        el('div.absolute.inset-0', {
          style: {
            opacity: 0.1,
            backgroundImage: 'radial-gradient(circle at 70% 30%, #b4ff45 0%, transparent 60%)',
          },
        }),
        el('p.relative', {
          style: { color: '#b4ff45', fontSize: '0.75rem', fontWeight: 700, zIndex: 10 },
        }, '\u{1F6B4} Free Shipping'),
        el('p.relative.mt-1', {
          style: { color: '#9090b0', fontSize: '0.7rem', zIndex: 10 },
        }, 'On all printed stems when you order 3+'),
        el('button', {
          class: 'mt-3 relative rounded-lg px-3 py-1 transition-colors',
          style: {
            color: '#b4ff45',
            border: '1px solid rgba(180,255,69,0.4)',
            fontSize: '0.72rem',
            zIndex: 10,
            background: 'transparent',
          },
        }, 'Order Now'),
      ),
    );

    leftAside.appendChild(
      el('div', {
        class: 'rounded-xl p-4 border overflow-hidden',
        style: { background: '#111120', borderColor: '#1e1e35' },
      },
        el('img', {
          src: 'https://images.unsplash.com/photo-1697162123803-b812798e61e2?w=400&q=80',
          alt: 'Bike parts',
          class: 'w-full h-20 object-cover rounded-lg mb-3',
        }),
        el('p', { style: { color: '#e0e0f0', fontSize: '0.8rem', fontWeight: 600 } }, 'Custom Valve Caps'),
        el('p', { style: { color: '#808098', fontSize: '0.7rem' } }, 'Brass, aluminum, titanium options'),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────
  // CENTER — title / uploader / viewer / settings / actions
  // ──────────────────────────────────────────────────────────────
  center.appendChild(
    el('div',
      el('h1.text-white', {
        style: { fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em' },
      },
        'Your Head on a ',
        el('span', { style: { color: '#b4ff45' } }, 'Valve Stem'),
      ),
      el('p.mt-1', {
        style: { color: '#808098', fontSize: '0.9rem' },
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
          ? '#b4ff45'
          : state.photoUrl
          ? '#252545'
          : '#252545',
        background: state.dragging
          ? 'rgba(180,255,69,0.05)'
          : '#111120',
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

    if (state.photoUrl) {
      box.appendChild(el('div.flex.items-center.gap-4.p-4',
        el('div', {
          class: 'relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border',
          style: { borderColor: '#252545' },
        },
          el('img', { src: state.photoUrl, alt: 'Uploaded', class: 'w-full h-full object-cover' }),
        ),
        el('div.flex-1.min-w-0',
          el('p.text-white', { style: { fontWeight: 600, fontSize: '0.9rem' } }, state.photoName || 'Photo uploaded'),
          el('p', { style: { color: '#808098', fontSize: '0.78rem' } }, 'Ready to generate your valve stem'),
        ),
        el('button', {
          class: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors',
          style: { borderColor: '#252545', color: '#9090b0', fontSize: '0.78rem', background: 'transparent' },
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
          style: { background: 'linear-gradient(135deg, #1a2a08, #0f1a05)', border: '1px solid rgba(180,255,69,0.3)' },
        }, icon('upload', { size: 24, color: '#b4ff45' })),
        el('div.text-center',
          el('p.text-white', { style: { fontWeight: 600 } }, 'Upload Your Photo'),
          el('p.mt-1', { style: { color: '#808098', fontSize: '0.82rem' } }, 'Drag & drop or click to browse · JPG, PNG, HEIC'),
        ),
        el('button', {
          class: 'px-5 py-2 rounded-xl transition-all',
          style: { background: '#b4ff45', color: '#000', fontWeight: 700, fontSize: '0.88rem' },
        }, 'Choose Photo'),
      ));
    }

    uploaderSlot.appendChild(box);
  }

  // Viewer
  const viewerSlot = el('div', {
    class: 'rounded-2xl overflow-hidden border',
    style: { background: '#0d0d1e', borderColor: '#1e1e35' },
  });
  center.appendChild(viewerSlot);

  const viewerHeader = el('div.flex.items-center.justify-between.px-4.py-3.border-b', {
    style: { borderColor: '#1e1e35' },
  });
  viewerSlot.appendChild(viewerHeader);

  const viewerCanvas = el('div', { style: { height: '380px', position: 'relative' } });
  viewerSlot.appendChild(viewerCanvas);

  viewerSlot.appendChild(
    el('div.flex.items-center.gap-6.px-4.py-3.border-t', {
      style: { borderColor: '#1e1e35', fontSize: '0.75rem' },
    },
      legendSwatch('#b4ff45', '3D Scanned Head'),
      legendSwatch('#c8a032', 'Presta Valve Stem'),
      legendSwatch('#c0c0d0', 'Chrome Body'),
    ),
  );

  function renderViewerHeader() {
    clear(viewerHeader);
    const leftRow = el('div.flex.items-center.gap-2',
      icon('layers', { size: 14, color: '#b4ff45' }),
      el('span', { style: { color: '#e0e0f0', fontWeight: 600, fontSize: '0.88rem' } }, '3D Model Preview'),
    );
    if (state.processing) {
      leftRow.appendChild(el('span', {
        class: 'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        style: { background: 'rgba(180,255,69,0.12)', fontSize: '0.7rem', color: '#b4ff45' },
      },
        el('span.pulse-dot.inline-block.rounded-full', {
          style: { width: '6px', height: '6px', background: '#b4ff45' },
        }),
        'Processing',
      ));
    }
    if (state.stlReady) {
      leftRow.appendChild(el('span', {
        class: 'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        style: { background: 'rgba(180,255,69,0.12)', fontSize: '0.7rem', color: '#b4ff45' },
      }, '\u2713 STL Ready'));
    }
    viewerHeader.appendChild(leftRow);

    viewerHeader.appendChild(
      el('div.flex.items-center.gap-2', {
        style: { color: '#606080', fontSize: '0.72rem' },
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
      neckLength: state.neckLength,
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
      neckLength: state.neckLength,
      headTilt: state.headTilt,
      materialType: state.materialType,
      headColor: state.headColor,
      photoUrl: state.photoUrl,
      processing: state.processing,
    });
  }

  // Settings toggle + panel
  const settingsToggle = el('button', {
    class: 'flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-colors text-left',
    style: { background: '#111120', borderColor: '#1e1e35' },
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
        icon('settings', { size: 16, color: '#b4ff45' }),
        el('span', { style: { color: '#e0e0f0', fontWeight: 600, fontSize: '0.88rem' } }, 'Adjust 3D Settings'),
      ),
      el('div', {
        style: {
          transition: 'transform 0.2s',
          transform: state.showSettings ? 'rotate(90deg)' : 'rotate(0deg)',
          color: '#606080',
        },
      }, icon('chevronRight', { size: 16 })),
    );

    settingsPanel.classList.toggle('open', state.showSettings);
    if (!state.showSettings) return;

    clear(settingsInner);
    settingsInner.className = 'rounded-2xl border p-5 grid grid-cols-1 sm:grid-cols-2 gap-5';
    Object.assign(settingsInner.style, { background: '#111120', borderColor: '#1e1e35' });

    settingsInner.append(
      slider({
        label: 'Head Scale',
        value: state.headScale,
        min: 0.5, max: 1.5, step: 0.05,
        display: (v) => `${Math.round(v * 100)}%`,
        onInput: (v) => { state.headScale = v; pushViewer(); },
      }),
      slider({
        label: 'Neck Length',
        value: state.neckLength,
        min: 20, max: 80, step: 5,
        display: (v) => `${v}mm`,
        onInput: (v) => { state.neckLength = v; pushViewer(); },
      }),
      slider({
        label: 'Head Tilt',
        value: state.headTilt,
        min: -15, max: 15, step: 1,
        display: (v) => (v > 0 ? `+${v}°` : `${v}°`),
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
  const payBtn = el('button', {
    class: 'flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all duration-200',
    style: { color: '#fff', fontWeight: 700, fontSize: '0.9rem' },
    onClick: () => handleStartPrintCheckout('printed_stem'),
  });

  actions.append(generateBtn, downloadBtn, payBtn);

  function renderActions() {
    const canGenerate = !!state.photoUrl && !state.processing;

    clear(generateBtn);
    Object.assign(generateBtn.style, {
      background: canGenerate ? 'linear-gradient(135deg, #b4ff45, #7fc718)' : '#252545',
      color: '#000',
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
        icon('zap', { size: 16, color: '#000' }),
        state.stlReady ? 'Re-generate STL' : 'Generate 3D File',
      );
    }

    const canPurchase = state.stlReady && !!state.designId && !state.checkoutPending;

    clear(downloadBtn);
    downloadBtn.append(
      icon('creditCard', { size: 16, color: canPurchase ? '#000' : '#808098' }),
      state.checkoutPending ? 'Redirecting…' : 'Buy STL · $2',
    );
    Object.assign(downloadBtn.style, {
      background: canPurchase ? 'linear-gradient(135deg, #b4ff45, #7fc718)' : '#252545',
      color: canPurchase ? '#000' : '#808098',
      border: 'none',
      cursor: canPurchase ? 'pointer' : 'not-allowed',
      opacity: canPurchase ? 1 : 0.7,
    });
    downloadBtn.disabled = !canPurchase;

    clear(payBtn);
    payBtn.append(
      icon('creditCard', { size: 16, color: '#fff' }),
      'Pay & Print',
    );
    Object.assign(payBtn.style, {
      background: canPurchase ? 'linear-gradient(135deg, #ff6b30, #e8450a)' : '#252545',
      cursor: canPurchase ? 'pointer' : 'not-allowed',
      opacity: canPurchase ? 1 : 0.6,
    });
    payBtn.disabled = !canPurchase;

    clear(readyBanner);
    if (state.stlReady) {
      readyBanner.appendChild(el('div', {
        class: 'fade-up rounded-xl px-4 py-3 border flex items-center gap-3',
        style: { background: 'rgba(180,255,69,0.06)', borderColor: 'rgba(180,255,69,0.25)' },
      },
        el('span', { style: { fontSize: '1.5rem' } }, '\u{1F389}'),
        el('div',
          el('p', {
            style: { color: '#b4ff45', fontWeight: 700, fontSize: '0.88rem' },
          },
            `Your STL is ready — ${state.designTriangles.toLocaleString()} triangles.`,
          ),
          el('p', {
            style: { color: '#808098', fontSize: '0.78rem' },
          }, 'Checkout for $2 to download the file, or order it printed and shipped.'),
        ),
      ));
    }
  }

  // ──────────────────────────────────────────────────────────────
  // RIGHT SIDEBAR — previous designs + pricing
  // ──────────────────────────────────────────────────────────────
  function renderRight() {
    clear(rightAside);
    rightAside.appendChild(
      el('div.flex.items-center.gap-2.mb-1',
        icon('image', { size: 14, color: '#b4ff45' }),
        el('span.uppercase', {
          style: { color: '#9090b0', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' },
        }, 'Previous 3D Designs'),
      ),
    );

    rightAside.appendChild(
      el('div', {
        class: 'rounded-xl overflow-hidden border relative',
        style: { background: '#111120', borderColor: '#1e1e35' },
      },
        el('img', {
          src: 'https://images.unsplash.com/photo-1651557747176-5aa3c20b6780?w=600&q=80',
          alt: 'Valve stem',
          class: 'w-full object-cover',
          style: { height: '8rem' },
        }),
        el('div.absolute.inset-0', {
          style: { background: 'linear-gradient(to top, rgba(17,17,32,0.9), transparent 50%)' },
        }),
        el('div.absolute', { style: { left: '12px', bottom: '12px' } },
          el('p', { style: { color: '#fff', fontWeight: 700, fontSize: '0.82rem' } }, 'Presta Valve Base'),
          el('p', { style: { color: '#b4ff45', fontSize: '0.7rem' } }, 'Standard compatible'),
        ),
      ),
    );

    for (const d of state.designs) {
      const isSelected = state.selectedDesign === d.id;
      const card = el('button', {
        class: 'w-full text-left rounded-xl overflow-hidden border transition-all duration-200',
        style: {
          background: '#111120',
          borderColor: isSelected ? 'rgba(180,255,69,0.5)' : '#1e1e35',
        },
        onClick: () => { state.selectedDesign = isSelected ? null : d.id; renderRight(); },
      },
        el('div.flex.items-center.gap-3.p-3',
          el('div', {
            class: 'w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border',
            style: { borderColor: '#1e1e35' },
          },
            el('img', { src: d.thumbnail, alt: d.name, class: 'w-full h-full object-cover' }),
          ),
          el('div.flex-1.min-w-0',
            el('p.truncate', {
              style: { color: '#e0e0f0', fontWeight: 600, fontSize: '0.82rem' },
            }, d.name),
            el('p', { style: { color: '#606080', fontSize: '0.72rem' } }, d.date),
            el('div.flex.items-center.gap-1.mt-1',
              ...Array.from({ length: d.stars || 0 }, () =>
                icon('star', { size: 12, color: '#b4ff45' })
              ),
              el('span', {
                class: 'ml-1 px-1.5 py-0.5 rounded capitalize',
                style: { background: '#1e1e35', color: '#808098', fontSize: '0.65rem' },
              }, d.material),
            ),
          ),
        ),
        isSelected
          ? el('div.px-3.pb-3.flex.gap-2',
              el('button', {
                class: 'flex-1 py-1.5 rounded-lg border transition-colors',
                style: {
                  borderColor: 'rgba(180,255,69,0.3)',
                  color: '#b4ff45',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: 'transparent',
                },
                onClick: (e) => { e.stopPropagation(); window.__router?.navigate('/pricing'); },
              }, 'Download'),
              el('button', {
                class: 'flex-1 py-1.5 rounded-lg transition-colors',
                style: { background: '#ff6b30', color: '#fff', fontSize: '0.72rem', fontWeight: 600 },
                onClick: (e) => e.stopPropagation(),
              }, 'Reorder'),
            )
          : null,
      );
      rightAside.appendChild(card);
    }

    rightAside.appendChild(
      el('div', {
        class: 'rounded-xl p-4 border mt-1',
        style: { background: '#111120', borderColor: '#1e1e35' },
      },
        el('p', { style: { color: '#e0e0f0', fontWeight: 700, fontSize: '0.82rem' } }, 'Pricing'),
        el('div', { class: 'mt-2 flex flex-col gap-1.5' },
          ...[
            ['STL Download', '$2.00'],
            ['Printed Stem', '$19.99'],
            ['Pack of 4',    '$59.99'],
          ].map(([label, price]) =>
            el('div.flex.justify-between.items-center',
              el('span', { style: { color: '#808098', fontSize: '0.75rem' } }, label),
              el('span', { style: { color: '#b4ff45', fontSize: '0.78rem', fontWeight: 700 } }, price),
            )
          ),
        ),
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
    state.designId = null;
    state.designTriangles = 0;
    renderUploader();
    pushViewer();
    renderActions();
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
    state.progress = 0;
    state.processingStep = '';
    state.designId = null;
    renderActions();
    renderViewerHeader();
    pushViewer();

    try {
      const imageData = state.photoFile ? await fileToBase64(state.photoFile) : null;
      if (!imageData) throw new Error('photo_required');

      const result = await socket.request('stl.generate', {
        imageData,
        imageName: state.photoName,
        settings: {
          headScale: state.headScale,
          neckLength: state.neckLength,
          headTilt: state.headTilt,
          materialType: state.materialType,
          headColor: state.headColor,
        },
      }, {
        onMessage: (name, payload) => {
          if (name === 'stl.generate.progress') {
            state.progress = payload.pct;
            state.processingStep = payload.step;
            renderActions();
          }
        },
      });
      state.designId = result.designId;
      state.designTriangles = result.triangles || 0;
      state.stlReady = true;
      sessionStorage.setItem('bikeheadz.designId', result.designId);
    } catch (err) {
      console.error('stl.generate failed', err);
      state.processingStep = `Error: ${err.message}`;
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
        product: 'stl_download',
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

  async function handleStartPrintCheckout(product) {
    if (!state.designId || state.checkoutPending) return;
    state.checkoutPending = true;
    renderActions();
    try {
      const { url } = await socket.request('payments.createCheckoutSession', {
        product,
        designId: state.designId,
      });
      if (!url) throw new Error('no_checkout_url');
      window.location.assign(url);
    } catch (err) {
      state.checkoutPending = false;
      alert(`Could not start checkout: ${err.message}`);
      renderActions();
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Initial loads
  // ──────────────────────────────────────────────────────────────
  async function bootData() {
    try {
      const [designs, events] = await Promise.all([
        socket.request('designs.list'),
        socket.request('events.list'),
      ]);
      state.designs = designs || [];
      state.events = events || [];
    } catch (err) {
      console.warn('initial load failed', err);
    }
    renderLeft();
    renderRight();
  }

  // First paint
  renderUploader();
  renderViewerHeader();
  renderSettings();
  renderActions();
  renderLeft();
  renderRight();
  bootData();

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
    el('span', { style: { color: '#808098' } }, label),
  );
}

function slider({ label, value, min, max, step, display, onInput }) {
  const valueEl = el('span', {
    style: { color: '#b4ff45', fontSize: '0.8rem', fontWeight: 700 },
  }, display(value));
  const input = el('input', {
    type: 'range',
    min, max, step,
    value,
    class: 'w-full',
    style: { accentColor: '#b4ff45' },
    onInput: (e) => {
      const v = Number(e.target.value);
      valueEl.textContent = display(v);
      onInput(v);
    },
  });
  return el('div.flex.flex-col.gap-2',
    el('div.flex.justify-between.items-center',
      el('label', { style: { color: '#b0b0c8', fontSize: '0.8rem' } }, label),
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
    style: { borderColor: '#252545', background: 'transparent' },
    onInput: (e) => {
      onInput(e.target.value);
      swatchLabel.textContent = e.target.value;
    },
  });
  const swatchLabel = el('span', {
    style: { color: '#606080', fontSize: '0.78rem' },
  }, value);
  return el('div.flex.flex-col.gap-2',
    el('label', { style: { color: '#b0b0c8', fontSize: '0.8rem' } }, 'Head Color'),
    el('div.flex.items-center.gap-3', input, swatchLabel),
  );
}

function materialRow({ value, onChange }) {
  const buttons = ['matte', 'gloss', 'chrome'].map((m) => {
    const active = value === m;
    return el('button', {
      class: 'flex-1 py-2 rounded-xl capitalize border transition-all',
      style: {
        background: active ? 'rgba(180,255,69,0.08)' : '#0d0d1e',
        borderColor: active ? '#b4ff45' : '#252545',
        color: active ? '#b4ff45' : '#808098',
        fontSize: '0.82rem',
        fontWeight: 600,
      },
      onClick: () => onChange(m),
    }, m);
  });
  return el('div.flex.flex-col.gap-2', { class: 'sm:col-span-2' },
    el('label', { style: { color: '#b0b0c8', fontSize: '0.8rem' } }, 'Material Finish'),
    el('div.flex.gap-2', ...buttons),
  );
}
