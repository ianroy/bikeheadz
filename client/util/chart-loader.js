// Dynamically loads Chart.js from jsDelivr the first time anything
// asks for it, then resolves with the global Chart constructor on
// every subsequent call. Used by the admin dashboard tabs.
//
// CDN choice: jsDelivr's @4.4.4 UMD bundle is ~70KB gzipped and
// pinned to a specific minor so a future Chart.js breaking change
// can't silently land. SRI-style hash isn't pinned (the CSP only
// whitelists the host) — bump if a security-critical patch lands.

const CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
let inflight = null;

export function loadChart() {
  if (typeof window !== 'undefined' && window.Chart) return Promise.resolve(window.Chart);
  if (inflight) return inflight;
  inflight = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CDN;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => {
      if (window.Chart) resolve(window.Chart);
      else reject(new Error('chart_js_global_missing'));
    };
    s.onerror = () => reject(new Error('chart_js_load_failed'));
    document.head.appendChild(s);
  });
  return inflight;
}

// Brand-aligned default palette for multi-series charts. Each entry
// is { stroke, fill } so line charts stroke + bar charts fill use the
// same hue. Order is intentional: brand → magenta → fluoro-dim →
// gold → ink-soft so adjacent series are visually distinct.
export const CHART_PALETTE = [
  { stroke: '#7B2EFF', fill: 'rgba(123, 46, 255, 0.20)' }, // brand
  { stroke: '#FF2EAB', fill: 'rgba(255, 46, 171, 0.20)' }, // magenta
  { stroke: '#1FCE6E', fill: 'rgba(31, 206, 110, 0.20)' }, // fluoro dim
  { stroke: '#7C5E1F', fill: 'rgba(124, 94, 31, 0.20)' },  // gold
  { stroke: '#3D2F4A', fill: 'rgba(61, 47, 74, 0.18)' },   // ink-muted
  { stroke: '#A267FF', fill: 'rgba(162, 103, 255, 0.18)' },// brand light
];

export function chartTheme() {
  return {
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    ink: '#0E0A12',
    muted: '#3D2F4A',
    grid: '#D7CFB6',
  };
}
