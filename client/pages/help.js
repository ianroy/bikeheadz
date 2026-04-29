// X-006 — /help page. A static FAQ rendered from the FAQ array below
// with a substring filter on the controlled input. No data dependencies,
// no socket calls — this page should render even with the backend
// down. The result count is announced via aria-live=polite so screen
// readers hear "12 of 12 questions" → "3 of 12 questions" as the user
// types.

import { el, clear } from '../dom.js';

const FAQ = [
  {
    q: 'Which 3D printers are compatible?',
    a: 'Any FDM printer running OrcaSlicer or a fork (Bambu Studio, PrusaSlicer) with a 0.4 mm nozzle prints these caps cleanly. We tested Bambu A1, Bambu A1 Mini, Prusa MK4, Prusa MINI+, and Elegoo Centauri Carbon — all printed the reference files at 0.12–0.16 mm layer height with stock PLA profiles. Resin printers also work and give finer surface detail on the face.',
  },
  {
    q: 'What filament should I use?',
    a: 'PLA on a 0.4 mm nozzle is what we tune the pipeline for: walls are 1.2 mm (3× nozzle width) and the threaded section relies on PLA\'s low shrinkage. PETG, ABS, and ASA work but you may need to tighten clearances by 0.05–0.10 mm to keep the threads tight against a Schrader valve.',
  },
  {
    q: 'How do I install my BikeHeadz cap on a real valve?',
    a: 'Print cap-down (the flat circular face goes on the bed). Once printed, just twist it onto a standard Schrader valve like a regular dust cap — the threads are sized to bite against the inside walls of the cap and form a snug press-fit. No glue or tools required.',
  },
  {
    q: 'How long does shipping take if I order from BikeHeadz?',
    a: 'Print-to-door is 3–5 business days for US/EU addresses, 7–10 days elsewhere. We print on demand — there is no "in stock" inventory — so a delay between order and ship is normal. You\'ll get a tracking link by email when the package leaves our shop.',
  },
  {
    q: 'What is your refund policy?',
    a: 'Refunds are available within 14 days of purchase, less any costs already incurred for printing or shipping. Email help@bikeheadz.app with your order id and we\'ll process the refund through Stripe within two business days.',
  },
  {
    q: 'What kind of photo gives the best result?',
    a: 'A front-facing portrait with even lighting, plain background, and no hat or glasses. Stand near a window so daylight hits both sides of the face — harsh side-lighting causes the model to misread shadows as facial features. Hair pulled back is optional but helps the silhouette around the ears.',
  },
  {
    q: 'My print failed (warped, didn\'t adhere, looked off). What do I do?',
    a: 'Send us the failed print + a photo of the slicer settings to help@bikeheadz.app and we\'ll either send a corrected STL free of charge or refund the order. The most common causes we\'ve seen: print orientation other than cap-down, layer height >0.2 mm, or non-PLA filament without clearance compensation. See the printing guide on `/how-it-works` for the recommended profile.',
  },
  {
    q: 'What 3D file formats do you support?',
    a: 'We deliver binary STL files only. STL is universally supported by every slicer, prints fine for this geometry, and stays under 4 MB for the typical 50–80K-triangle output. If you need OBJ or 3MF for a custom workflow, drop us a line — we can convert manually.',
  },
  {
    q: 'Why is there no Stripe webhook in development?',
    a: 'Webhooks need a public URL, which would force every developer to run an `stripe listen` tunnel just to test the checkout flow. In dev we poll the Checkout Session after the redirect (`STRIPE_WEBHOOK_ENABLED=false`) and treat the polled response as the source of truth. In production the webhook is required and the polled redirect handler becomes the safety net.',
  },
  {
    q: 'Do you store my photo? For how long?',
    a: 'Photos are stored encrypted in your photo library for 90 days from last use, then auto-deleted. They are used only to (re-)generate STL files for you and never shared with third parties. We do not run face recognition against any external database, and we do not use your photos to train AI models. Full details: `/privacy`.',
  },
  {
    q: 'Can I edit the STL after I download it?',
    a: 'Absolutely. The STL is a standard mesh file — open it in MeshMixer, Blender, Fusion 360, or any CAD tool you like. The cap section (the threaded bottom ring) is the only part you should leave alone; everything above the cap is fair game for tweaks.',
  },
  {
    q: 'I have a question that isn\'t answered here. How do I reach support?',
    a: 'Email help@bikeheadz.app — we read every message and respond within one business day. For abuse reports use abuse@bikeheadz.app, and for security issues use security@bikeheadz.app (PGP key on request, see /security).',
  },
];

export function HelpPage() {
  const root = el('main', {
    style: {
      maxWidth: '760px',
      margin: '48px auto',
      padding: '0 24px',
      color: 'var(--ink, #1A1614)',
    },
  });

  root.appendChild(
    el('h1', { style: { fontSize: '32px', marginBottom: '8px', color: '#C71F1F' } }, 'Help & FAQ')
  );
  root.appendChild(
    el(
      'p',
      { style: { color: '#6B6157', fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 } },
      'Common questions about printing, ordering, and the pipeline. Search by keyword — partial matches work.'
    )
  );

  const search = el('input', {
    type: 'search',
    name: 'help-search',
    autocomplete: 'off',
    placeholder: 'Search the FAQ…',
    'aria-label': 'Search frequently asked questions',
    style: {
      width: '100%',
      padding: '12px 14px',
      fontSize: '16px',
      border: '1px solid #C9C0B0',
      borderRadius: '10px',
      background: '#FAF7F2',
      color: '#1A1614',
      marginBottom: '8px',
    },
  });
  root.appendChild(search);

  const status = el(
    'p',
    {
      'aria-live': 'polite',
      style: {
        color: '#6B6157',
        fontSize: '13px',
        marginBottom: '20px',
        minHeight: '18px',
      },
    },
    `${FAQ.length} of ${FAQ.length} questions`
  );
  root.appendChild(status);

  const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } });
  root.appendChild(list);

  function render(filter) {
    const needle = (filter || '').trim().toLowerCase();
    const matches = needle
      ? FAQ.filter(
          (item) =>
            item.q.toLowerCase().includes(needle) || item.a.toLowerCase().includes(needle)
        )
      : FAQ;

    status.textContent = needle
      ? `${matches.length} of ${FAQ.length} questions match "${filter}"`
      : `${FAQ.length} of ${FAQ.length} questions`;

    clear(list);
    if (matches.length === 0) {
      list.appendChild(
        el(
          'p',
          {
            style: {
              padding: '24px',
              background: '#FFFDF8',
              border: '1px dashed #C9C0B0',
              borderRadius: '10px',
              color: '#6B6157',
              textAlign: 'center',
            },
          },
          'No questions match. Try a different keyword, or email help@bikeheadz.app.'
        )
      );
      return;
    }

    for (const item of matches) {
      list.appendChild(
        el(
          'details',
          {
            style: {
              background: '#FFFDF8',
              border: '1px solid #E5DFD3',
              borderRadius: '10px',
              padding: '14px 18px',
              boxShadow: '0 2px 6px rgba(34, 24, 12, 0.04)',
            },
          },
          el(
            'summary',
            {
              style: {
                fontWeight: 600,
                fontSize: '15px',
                color: '#1A1614',
                cursor: 'pointer',
                listStyle: 'revert',
              },
            },
            item.q
          ),
          el(
            'p',
            {
              style: {
                marginTop: '10px',
                lineHeight: 1.6,
                color: '#1A1614',
                fontSize: '14px',
              },
            },
            item.a
          )
        )
      );
    }
  }

  search.addEventListener('input', (e) => render(e.target.value));
  render('');

  return { el: root };
}
