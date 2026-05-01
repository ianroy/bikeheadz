// Inline SVG icon set — the only icons the UI actually uses. Each entry is an
// array of <path>/<circle>/<line>/<polyline>/<polygon>/<rect> definitions,
// matching Lucide's 24×24 outline style (stroke="currentColor", stroke-width=2).
//
// Returns a freshly-built <svg> so the same icon can be inserted multiple times.
const SVG_NS = 'http://www.w3.org/2000/svg';

const I = {
  upload: [
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['polyline', { points: '17 8 12 3 7 8' }],
    ['line', { x1: 12, y1: 3, x2: 12, y2: 15 }],
  ],
  refresh: [
    ['polyline', { points: '23 4 23 10 17 10' }],
    ['polyline', { points: '1 20 1 14 7 14' }],
    ['path', { d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10' }],
    ['path', { d: 'M20.49 15a9 9 0 0 1-14.85 3.36L1 14' }],
  ],
  download: [
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['polyline', { points: '7 10 12 15 17 10' }],
    ['line', { x1: 12, y1: 15, x2: 12, y2: 3 }],
  ],
  settings: [
    ['path', { d: 'M20 7h-9' }],
    ['path', { d: 'M14 17H5' }],
    ['circle', { cx: 17, cy: 17, r: 3 }],
    ['circle', { cx: 7,  cy: 7,  r: 3 }],
  ],
  zap: [
    ['polygon', { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' }],
  ],
  chevronRight: [
    ['polyline', { points: '9 18 15 12 9 6' }],
  ],
  star: [
    ['polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' }],
  ],
  calendar: [
    ['rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }],
    ['line', { x1: 16, y1: 2, x2: 16, y2: 6 }],
    ['line', { x1: 8,  y1: 2, x2: 8,  y2: 6 }],
    ['line', { x1: 3,  y1: 10, x2: 21, y2: 10 }],
  ],
  megaphone: [
    ['path', { d: 'M3 11l18-5v12L3 14v-3z' }],
    ['path', { d: 'M11.6 16.8a3 3 0 1 1-5.8-1.6' }],
  ],
  image: [
    ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 }],
    ['circle', { cx: 8.5, cy: 8.5, r: 1.5 }],
    ['polyline', { points: '21 15 16 10 5 21' }],
  ],
  rotate: [
    ['polyline', { points: '1 4 1 10 7 10' }],
    ['path', { d: 'M3.51 15a9 9 0 1 0 2.13-9.36L1 10' }],
  ],
  layers: [
    ['polygon', { points: '12 2 2 7 12 12 22 7 12 2' }],
    ['polyline', { points: '2 17 12 22 22 17' }],
    ['polyline', { points: '2 12 12 17 22 12' }],
  ],
  creditCard: [
    ['rect', { x: 2, y: 5, width: 20, height: 14, rx: 2, ry: 2 }],
    ['line', { x1: 2, y1: 10, x2: 22, y2: 10 }],
  ],
  camera: [
    ['path', { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' }],
    ['circle', { cx: 12, cy: 13, r: 4 }],
  ],
  cpu: [
    ['rect', { x: 4, y: 4, width: 16, height: 16, rx: 2, ry: 2 }],
    ['rect', { x: 9, y: 9, width: 6, height: 6 }],
    ['line', { x1: 9, y1: 1, x2: 9, y2: 4 }],  ['line', { x1: 15, y1: 1, x2: 15, y2: 4 }],
    ['line', { x1: 9, y1: 20, x2: 9, y2: 23 }], ['line', { x1: 15, y1: 20, x2: 15, y2: 23 }],
    ['line', { x1: 20, y1: 9, x2: 23, y2: 9 }], ['line', { x1: 20, y1: 14, x2: 23, y2: 14 }],
    ['line', { x1: 1, y1: 9, x2: 4, y2: 9 }],  ['line', { x1: 1, y1: 14, x2: 4, y2: 14 }],
  ],
  package: [
    ['path', { d: 'M16.5 9.4 7.55 4.24' }],
    ['path', { d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' }],
    ['polyline', { points: '3.27 6.96 12 12.01 20.73 6.96' }],
    ['line', { x1: 12, y1: 22.08, x2: 12, y2: 12 }],
  ],
  arrowRight: [
    ['line', { x1: 5, y1: 12, x2: 19, y2: 12 }],
    ['polyline', { points: '12 5 19 12 12 19' }],
  ],
  user: [
    ['path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: 12, cy: 7, r: 4 }],
  ],
  bike: [
    ['circle', { cx: 5.5, cy: 17.5, r: 3.5 }],
    ['circle', { cx: 18.5, cy: 17.5, r: 3.5 }],
    ['path', { d: 'M15 6l-3 7-4-5-2 5' }],
    ['circle', { cx: 15, cy: 5, r: 1 }],
  ],
  menu: [
    ['line', { x1: 3, y1: 6,  x2: 21, y2: 6 }],
    ['line', { x1: 3, y1: 12, x2: 21, y2: 12 }],
    ['line', { x1: 3, y1: 18, x2: 21, y2: 18 }],
  ],
  x: [
    ['line', { x1: 18, y1: 6, x2: 6, y2: 18 }],
    ['line', { x1: 6,  y1: 6, x2: 18, y2: 18 }],
  ],
  logOut: [
    ['path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }],
    ['polyline', { points: '16 17 21 12 16 7' }],
    ['line', { x1: 21, y1: 12, x2: 9, y2: 12 }],
  ],
  settingsGear: [
    ['path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' }],
    ['circle', { cx: 12, cy: 12, r: 3 }],
  ],
  // Lucide-style envelope. Used by the "Email me the STLs" CTA on
  // the generator page and any future email-confirmation surfaces.
  mail: [
    ['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }],
    ['path', { d: 'M22 7 12 13 2 7' }],
  ],
};

export function icon(name, opts = {}) {
  const { size = 16, class: cls = '', color = 'currentColor', fill = 'none', strokeWidth = 2 } = opts;
  const defs = I[name];
  if (!defs) {
    const fallback = document.createElementNS(SVG_NS, 'svg');
    fallback.setAttribute('width', size);
    fallback.setAttribute('height', size);
    return fallback;
  }
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', fill);
  svg.setAttribute('stroke', color);
  svg.setAttribute('stroke-width', strokeWidth);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) cls.split(/\s+/).filter(Boolean).forEach((c) => svg.classList.add(c));
  for (const [tag, attrs] of defs) {
    const child = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) child.setAttribute(k, v);
    if (name === 'star' && tag === 'polygon') child.setAttribute('fill', color);
    svg.appendChild(child);
  }
  return svg;
}
