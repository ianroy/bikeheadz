import { SVG } from '@svgdotjs/svg.js';

// Replaces the THREE.js <ValveStem3DViewer>. All graphical objects are
// controlled through SVG.js primitives (gradients, ellipses, paths, groups,
// clip-paths, filters). The viewer exposes:
//
//   createValveStemViewer({ container, initial })
//       → { update(patch), destroy() }
//
// Accepted state keys (same surface as before):
//   headScale    — 0.5..1.5  scale applied to the head sphere/neck stub
//   neckLength   — 20..80    mm, visually scaled
//   headTilt     — -15..15   degrees
//   materialType — 'matte' | 'gloss' | 'chrome'
//   headColor    — CSS hex   fallback color when no photo is loaded
//   photoUrl     — string|null  clipped into the head circle
//   processing   — boolean   toggles a scanning ring animation
//
// Drag-to-rotate is implemented with a yaw angle that slightly squishes the
// horizontal ellipses (caps, threads) and shifts gradient stops, giving a
// legible sense of 3D without leaving the 2D SVG surface.

const VB_X = -160;
const VB_Y = -240;
const VB_W = 320;
const VB_H = 480;

export function createValveStemViewer({ container, initial = {} }) {
  const state = {
    headScale: 0.85,
    neckLength: 50,
    headTilt: 0,
    materialType: 'chrome',
    headColor: '#c8b8a0',
    photoUrl: null,
    processing: false,
    ...initial,
  };

  const draw = SVG().addTo(container).size('100%', '100%').viewbox(VB_X, VB_Y, VB_W, VB_H);
  const node = draw.node;
  node.style.background = '#0d0d1e';
  node.style.cursor = 'grab';
  node.style.touchAction = 'none';
  node.style.display = 'block';

  // Persistent defs — gradients whose stops we mutate per-frame.
  const defs = draw.defs();

  const metalGrad = mkLinearGradient(defs, 'metal', [
    [0, '#e4e8f0'], [0.45, '#8e95a5'], [1, '#2c3040'],
  ]);
  const brassGrad = mkLinearGradient(defs, 'brass', [
    [0, '#eddc8b'], [0.5, '#c8a032'], [1, '#5e4710'],
  ]);
  const darkMetalGrad = mkLinearGradient(defs, 'darkmetal', [
    [0, '#b6bdcd'], [0.5, '#606674'], [1, '#1d2130'],
  ]);
  const headGrad = mkLinearGradient(defs, 'head', [
    [0, '#ffffff'], [0.4, state.headColor], [1, '#1d1d22'],
  ]);
  const floorGrad = mkRadialGradient(defs, 'floor', [
    [0, 'rgba(180,255,69,0.12)'], [1, 'rgba(180,255,69,0)'],
  ]);

  // Scene groups.
  const scene = draw.group();
  const floor = scene.group();
  floor.ellipse(260, 34).center(0, 180).fill('url(#floor)');

  const stemGroup = scene.group();
  const headGroup = scene.group();
  const scanGroup = scene.group();

  // Interaction — yaw rotates the stem "around" the vertical axis.
  let yaw = 0.35;
  let dragging = false;
  let prev = { x: 0, y: 0 };

  const onDown = (e) => {
    dragging = true;
    prev = { x: e.clientX, y: e.clientY };
    node.style.cursor = 'grabbing';
    node.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - prev.x;
    yaw += dx * 0.01;
    prev = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e) => {
    dragging = false;
    node.style.cursor = 'grab';
    node.releasePointerCapture?.(e.pointerId);
  };
  node.addEventListener('pointerdown', onDown);
  node.addEventListener('pointermove', onMove);
  node.addEventListener('pointerup', onUp);
  node.addEventListener('pointercancel', onUp);
  node.addEventListener('pointerleave', onUp);

  // Animation loop.
  let scanPhase = 0;
  let rafId = 0;
  let lastT = performance.now();
  function tick(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (!dragging && !state.processing) yaw += dt * 0.35;
    if (state.processing) scanPhase = (scanPhase + dt * 0.9) % 1;
    render();
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  // Render all dynamic bits every frame. The cost is cheap — only a few dozen
  // SVG nodes total — and lets us re-apply yaw/tilt without diffing.
  function render() {
    const ySquish = Math.abs(Math.sin(yaw)) * 0.65 + 0.35;   // 0.35..1
    const lightShift = (Math.cos(yaw) + 1) / 2;               // 0..1
    const { headScale, neckLength, headTilt, materialType, headColor, photoUrl, processing } = state;

    // Rotate gradients slightly so highlights seem to follow the light as we rotate.
    metalGrad.attr({ x1: `${lightShift * 100}%`, x2: `${(1 - lightShift) * 100}%` });
    darkMetalGrad.attr({ x1: `${lightShift * 100}%`, x2: `${(1 - lightShift) * 100}%` });
    brassGrad.attr({ x1: `${lightShift * 100}%`, x2: `${(1 - lightShift) * 100}%` });

    drawStem(ySquish);
    drawHead(ySquish, headScale, neckLength, headTilt, materialType, headColor, photoUrl);
    drawScan(processing, headScale, neckLength);
  }

  function drawStem(sq) {
    stemGroup.clear();
    // Base flange
    cylinder(stemGroup, { y: 175, h: 18, rTop: 38, rBot: 46, fill: 'url(#metal)', capFill: '#d6d9e2', sq });
    // Lower locknut
    cylinder(stemGroup, { y: 150, h: 22, rTop: 28, rBot: 28, fill: 'url(#brass)', capFill: '#e7ca74', sq, facets: 8 });
    // Main shaft
    cylinder(stemGroup, { y: 55,  h: 160, rTop: 20, rBot: 24, fill: 'url(#metal)', capFill: '#c7ccd8', sq });
    // Threads
    for (const y of [-26, -14, -2, 10, 22]) {
      ellipseRing(stemGroup, 0, y, 20, sq);
    }
    // Upper locknut
    cylinder(stemGroup, { y: -44, h: 22, rTop: 26, rBot: 26, fill: 'url(#brass)', capFill: '#e7ca74', sq, facets: 8 });
    // Valve core
    cylinder(stemGroup, { y: -80, h: 44, rTop: 13, rBot: 18, fill: 'url(#darkmetal)', capFill: '#b0b5c2', sq });
  }

  function drawHead(sq, scale, neck, tilt, material, color, photo) {
    headGroup.clear();
    const neckPx = (neck - 20) / 60 * 70 + 30;       // 30..100 px
    const neckBaseY = -102;
    const neckTopY = neckBaseY - neckPx;
    const headR = 62 * scale;
    const headY = neckTopY - headR + 6;

    // Neck piece
    cylinder(headGroup, {
      y: (neckBaseY + neckTopY) / 2,
      h: neckPx,
      rTop: 14,
      rBot: 17,
      fill: 'url(#darkmetal)',
      capFill: '#b0b5c2',
      sq,
    });

    // Head sub-group (tilted).
    const sub = headGroup.group().transform({ rotate: tilt, origin: [0, headY] });

    // Head material gradient — rewritten each frame to follow color+material.
    const light = shade(color, 0.55);
    const base = color;
    const dark = shade(color, -0.55);
    const stops = (() => {
      if (material === 'chrome') return [
        [0, '#ffffff'], [0.18, base], [0.6, dark], [1, '#06070c'],
      ];
      if (material === 'gloss') return [
        [0, light], [0.35, base], [1, dark],
      ];
      return [ // matte
        [0, light], [0.55, base], [1, shade(color, -0.35)],
      ];
    })();
    replaceStops(headGrad, stops);

    // Sphere silhouette
    sub.circle(headR * 2).center(0, headY).fill('url(#head)');

    // Optional photo inside the sphere.
    if (photo) {
      const clipId = `head-clip-${Math.abs(hash(photo))}`;
      let clip = defs.findOne(`#${clipId}`);
      if (!clip) {
        clip = defs.clip().id(clipId);
        clip.circle(headR * 2).center(0, headY);
      } else {
        clip.clear();
        clip.circle(headR * 2).center(0, headY);
      }
      const img = sub.image(photo).size(headR * 2, headR * 2).move(-headR, headY - headR);
      img.attr('preserveAspectRatio', 'xMidYMid slice');
      img.attr('clip-path', `url(#${clipId})`);

      // Material tint over the photo (chrome heavy, matte almost none).
      const tintOpacity = material === 'chrome' ? 0.45 : material === 'gloss' ? 0.25 : 0.1;
      sub.circle(headR * 2).center(0, headY).fill('url(#head)').opacity(tintOpacity);
    }

    // Specular highlight — small bright ellipse top-left of sphere, shifts with yaw.
    const hx = -headR * 0.35 + Math.sin(yaw) * headR * 0.4;
    const hy = headY - headR * 0.4;
    sub.ellipse(headR * 0.9, headR * 0.55)
      .center(hx, hy)
      .fill('#ffffff')
      .opacity(material === 'chrome' ? 0.55 : material === 'gloss' ? 0.35 : 0.15);

    // Neck stub under sphere (blends head into neck).
    sub.path(
      `M ${-headR * 0.38} ${headY + headR * 0.88}
       Q 0 ${headY + headR * 1.1} ${headR * 0.38} ${headY + headR * 0.88}
       L 18 ${neckTopY + 4}
       L -18 ${neckTopY + 4} Z`
    ).fill('url(#head)').opacity(0.85);

    // Store the head metrics for the scan ring.
    headGroup.data('metrics', { headR, headY });
  }

  function drawScan(active, scale, neck) {
    scanGroup.clear();
    if (!active) return;
    const m = headGroup.data('metrics');
    if (!m) return;
    const ringY = m.headY - m.headR + (scanPhase * m.headR * 2);
    const sx = Math.max(0.15, Math.sin(Math.PI * scanPhase));
    const ring = scanGroup.ellipse(m.headR * 2 * sx, m.headR * 0.35)
      .center(0, ringY)
      .fill('none')
      .stroke({ color: '#b4ff45', width: 2.4, opacity: 0.95 });
    ring.filterWith((add) => add.gaussianBlur(1.5));
    scanGroup.ellipse(m.headR * 2 * sx * 1.2, m.headR * 0.12)
      .center(0, ringY)
      .fill('#b4ff45')
      .opacity(0.3);
  }

  return {
    update(patch) {
      Object.assign(state, patch);
    },
    setYaw(value) {
      yaw = value;
    },
    destroy() {
      cancelAnimationFrame(rafId);
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
      node.removeEventListener('pointerleave', onUp);
      draw.remove();
    },
  };
}

// ---- Helpers ---------------------------------------------------------------

function cylinder(group, { y, h, rTop, rBot, fill, capFill, sq, facets = 0 }) {
  const topY = y - h / 2;
  const botY = y + h / 2;
  const ryTop = rTop * sq;
  const ryBot = rBot * sq;
  // Side path: cap-top arc → right side → cap-bot arc (front) → left side
  const body = group.path(
    `M ${-rTop} ${topY}
     A ${rTop} ${ryTop} 0 0 0 ${rTop} ${topY}
     L ${rBot} ${botY}
     A ${rBot} ${ryBot} 0 0 1 ${-rBot} ${botY}
     Z`
  ).fill(fill);
  if (facets > 0) body.stroke({ color: '#0008', width: 0.6, opacity: 0.4 });

  // Top cap (visible ellipse on top)
  group.ellipse(rTop * 2, ryTop * 2).center(0, topY).fill(capFill);
}

function ellipseRing(group, x, y, r, sq) {
  const ry = Math.max(1.4, r * sq * 0.18);
  group.ellipse(r * 2, ry * 2).center(x, y - 1).fill('#c9cedd');
  group.ellipse(r * 2 - 3, ry * 2 - 1).center(x, y + 1).fill('#606776').opacity(0.9);
}

function mkLinearGradient(defs, id, stops) {
  const g = defs.gradient('linear', (add) => {
    for (const [o, c] of stops) add.stop(o, c);
  });
  g.id(id);
  g.from(0, 0).to(1, 0);
  return g;
}

function mkRadialGradient(defs, id, stops) {
  const g = defs.gradient('radial', (add) => {
    for (const [o, c] of stops) add.stop(o, c);
  });
  g.id(id);
  return g;
}

function replaceStops(gradient, stops) {
  gradient.clear();
  for (const [o, c] of stops) gradient.stop(o, c);
}

// Hex color lighten/darken. amount in [-1, 1].
function shade(hex, amount) {
  const { r, g, b } = parseHex(hex);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const rr = Math.round((t - r) * p + r);
  const gg = Math.round((t - g) * p + g);
  const bb = Math.round((t - b) * p + b);
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(v) {
  return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}
