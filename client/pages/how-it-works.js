import { el } from '../dom.js';
import { icon } from '../icons.js';

const STEPS = [
  {
    icon: 'camera',
    title: '1. Upload Your Photo',
    desc: 'Take a front-facing photo or upload an existing one. Best results come from good lighting and a neutral background. We support JPG, PNG, HEIC and more.',
    tip: 'Pro tip: Stand near a window for natural light',
    color: '#7B2EFF',
  },
  {
    icon: 'cpu',
    title: '2. AI Processes Your Head',
    desc: 'Our system analyzes your facial geometry, extracts the head mesh, and scales it to perfectly fit a Schrader valve stem connector. The neck is sized to twist-fit onto standard valve cores.',
    tip: 'Processing takes about 3–5 seconds',
    color: '#7B2EFF',
  },
  {
    icon: 'download',
    title: '3. Download STL File',
    desc: "A production-ready STL file is generated combining your head scan with the valve stem body. It's fully manifold and ready for FDM or resin 3D printing.",
    tip: 'Compatible with all major slicers: Cura, PrusaSlicer, Bambu',
    color: '#7C5E1F',
  },
  {
    icon: 'package',
    title: '4. Print or Order',
    desc: 'Send the file to your own printer, or use our print service. We print in chrome PLA, resin, or brass-fill filament. Ships in 3–5 days.',
    tip: 'Order packs of 4 for friends — perfect for group rides',
    color: '#D89E2F',
  },
];

const FAQ = [
  { q: 'What kind of 3D printer do I need?', a: 'Any FDM printer with at least 0.2mm resolution will work. Resin printers give finer detail on the face. The stem base is designed to be printed vertically.' },
  { q: 'How does my head attach to the valve stem?', a: 'The head/neck piece has a threaded socket that screws over the top of a Schrader valve. It replaces the standard dust cap and twists on in seconds.' },
  { q: 'What photo works best?', a: 'A front-facing selfie with even lighting and a plain background gives the best mesh extraction. Avoid hats, glasses, or hair covering the face.' },
  { q: "Can I use someone else's photo?", a: 'Only with their explicit permission. By uploading a photo you confirm you have the right to use it for this purpose.' },
  { q: 'Is the STL file editable?', a: 'Yes! The STL is a standard mesh file you can open in Meshmixer, Blender, or any CAD tool to further customize.' },
];

export function HowItWorksPage() {
  const root = el('div.max-w-4xl.mx-auto.px-4.py-10');

  // Hero
  root.appendChild(
    el('div.text-center', { class: 'mb-14' },
      el('h1.mb-3', {
        style: { fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.04em' },
      },
        'How ',
        el('span', { style: { color: '#7B2EFF' } }, 'StemDomeZ'),
        ' Works',
      ),
      el('p.max-w-xl.mx-auto', {
        style: { color: '#0E0A12', fontSize: '1rem' },
      }, 'Four simple steps to turn your face into a 3D-printable Schrader valve stem cap. No 3D design experience needed.'),
    ),
  );

  // Steps
  const stepList = el('div.flex.flex-col.gap-4', { class: 'mb-16' });
  STEPS.forEach((step, i) => {
    stepList.appendChild(
      el('div.flex.items-start.gap-5',
        el('div.flex.flex-col.items-center',
          el('div', {
            class: 'w-12 h-12 rounded-2xl flex items-center justify-center',
            style: { background: `${step.color}18`, border: `1px solid ${step.color}40` },
          }, icon(step.icon, { size: 20, color: step.color })),
          i < STEPS.length - 1
            ? el('div', {
                class: 'w-px flex-1 mt-2',
                style: { background: '#D7CFB6', minHeight: '2rem' },
              })
            : null,
        ),
        el('div.flex-1.rounded-2xl.p-5.border', {
          class: 'mb-4',
          style: { background: '#E5E0CC', borderColor: '#0E0A12', borderWidth: '2px' },
        },
          el('h3.mb-2', { style: { fontWeight: 700 } }, step.title),
          el('p', { style: { color: '#0E0A12', fontSize: '0.88rem', lineHeight: 1.7 } }, step.desc),
          el('div', {
            class: 'mt-3 px-3 py-2 rounded-lg inline-flex items-center gap-1.5',
            style: { background: `${step.color}0f`, border: `1px solid ${step.color}25` },
          },
            el('span', {
              style: { color: step.color, fontSize: '0.75rem', fontWeight: 600 },
            }, `\u{1F4A1} ${step.tip}`),
          ),
        ),
      ),
    );
  });
  root.appendChild(stepList);

  // Valve stem explanation
  root.appendChild(
    el('div', {
      class: 'rounded-2xl p-6 border mb-10',
      style: { background: '#E5E0CC', borderColor: '#0E0A12', borderWidth: '2px' },
    },
      el('h2.mb-4', { style: { fontWeight: 700 } }, 'The Valve Stem Explained'),
      el('div.flex.flex-col.gap-6.items-start', { class: 'md:flex-row' },
        el('img', {
          src: 'https://images.unsplash.com/photo-1651557747176-5aa3c20b6780?w=400&q=80',
          alt: 'Valve stem',
          class: 'rounded-xl w-full md:w-56 h-40 object-cover flex-shrink-0',
        }),
        el('div.flex.flex-col.gap-3', {
          style: { color: '#0E0A12', fontSize: '0.88rem', lineHeight: 1.7 },
        },
          el('p', {}, schraderPara()),
          el('p', {}, capPara()),
          el('p', {}, 'Because the head sits atop the valve, it\'s purely decorative and doesn\'t interfere with inflating your tire. A tire pressure gauge or pump still works normally.'),
        ),
      ),
    ),
  );

  // FAQ
  const faq = el('div',
    el('h2.mb-5', {
      style: { fontWeight: 700, fontSize: '1.25rem' },
    }, 'Frequently Asked Questions'),
    el('div.flex.flex-col.gap-3',
      ...FAQ.map((item) =>
        el('div', {
          class: 'rounded-xl p-4 border',
          style: { background: '#E5E0CC', borderColor: '#0E0A12', borderWidth: '2px' },
        },
          el('p.mb-1.5', {
            style: { color: '#0E0A12', fontWeight: 600, fontSize: '0.88rem' },
          }, item.q),
          el('p', {
            style: { color: '#0E0A12', fontSize: '0.82rem', lineHeight: 1.6 },
          }, item.a),
        )
      ),
    ),
  );
  root.appendChild(faq);

  // CTA
  root.appendChild(
    el('div', {
      class: 'mt-12 rounded-2xl p-8 text-center border relative overflow-hidden',
      style: {
        background: 'linear-gradient(135deg, #F5F2E5, #E5E0CC)',
        borderColor: 'rgba(123,46,255,0.2)',
      },
    },
      el('div', {
        class: 'absolute inset-0 pointer-events-none',
        style: { backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(123,46,255,0.15), transparent 60%)' },
      }),
      el('h2.relative.mb-2', {
        style: { fontWeight: 800, fontSize: '1.5rem', zIndex: 10 },
      }, 'Ready to make yours?'),
      el('p.relative.mb-6', {
        style: { color: '#0E0A12', fontSize: '0.9rem', zIndex: 10 },
      }, 'Takes less than a minute to generate your personalized valve stem.'),
      el('a', {
        href: '/',
        'data-link': '',
        class: 'inline-flex items-center gap-2 px-7 py-3 rounded-xl transition-all',
        style: { background: '#7B2EFF', color: '#FFFFFF', fontWeight: 800, fontSize: '0.95rem' },
      },
        'Get Started Free',
        icon('arrowRight', { size: 16, color: '#FFFFFF' }),
      ),
    ),
  );

  return { el: root };
}

function schraderPara() {
  return [
    'A ',
    el('strong', {}, 'Schrader valve stem'),
    " is the wider, sprung valve found on most mountain bikes, hybrids, and kids' bikes — the same valve type used on car tires. It threads at a standard 8 mm × 32 TPI pitch.",
  ];
}

function capPara() {
  return [
    'StemDomeZ replaces the standard plastic dust cap with a ',
    el('strong', {}, 'custom 3D-scanned head'),
    '. The neck piece has an internal thread that matches the standard Schrader valve thread — so it just screws on.',
  ];
}
