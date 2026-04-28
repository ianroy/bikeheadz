import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// Real WebGL viewer for the BikeHeadz preview/output mesh.
//
// API (unchanged from the previous SVG viewer so home.js doesn't need to
// re-learn it):
//
//   createValveStemViewer({ container, initial })
//       → { update(patch), destroy() }
//
// State keys:
//   headScale    — 0.5..1.5  scales the placeholder head sphere
//   neckLength   — 20..80    mm; scales the placeholder stem cylinder
//   headTilt     — -30..30   degrees; pitches the placeholder head
//                  (positive = chin up). Matches the v1 pipeline's
//                  Stage-1 X-axis pitch, used to position the Stage 2 cut.
//   materialType — 'matte' | 'gloss' | 'chrome'
//   headColor    — CSS hex; tints the model
//   processing   — boolean; pauses auto-rotate and pulses the placeholder head
//   stlData      — base64 string | ArrayBuffer | Uint8Array | null
//                   When set, the placeholder is removed and the real STL
//                   mesh is rendered in its place.
//   photoUrl     — accepted for API compat with the old SVG viewer but
//                   ignored (a photo doesn't compose with a 3D mesh).
//
// Behavior:
//   • OrbitControls drives the camera. Drag to rotate, scroll/pinch to zoom.
//   • Idle auto-rotate kicks in when the user isn't interacting and we're
//     not actively processing.
//   • While `stlData` is null, a parametric stem+sphere placeholder reflects
//     the current slider settings so the controls feel live before
//     generation completes.

const BG_COLOR = 0x0d0d1e;

export function createValveStemViewer({ container, initial = {} }) {
  const state = {
    headScale: 0.85,
    neckLength: 50,
    headTilt: 0,
    materialType: 'chrome',
    headColor: '#c8b8a0',
    processing: false,
    stlData: null,
    photoUrl: null,
    ...initial,
  };

  // ── Renderer ───────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, {
    width: '100%', height: '100%', display: 'block', touchAction: 'none',
  });
  container.appendChild(canvas);

  // ── Scene + camera + lights ────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.4, 6);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  scene.add(new THREE.HemisphereLight(0xb8c8ff, 0x202028, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 6, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffd9b8, 0.45);
  fill.position.set(-5, 2, -3);
  scene.add(fill);

  // Brand-color floor disc (faint).
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 64),
    new THREE.MeshBasicMaterial({
      color: 0xb4ff45, transparent: true, opacity: 0.06, side: THREE.DoubleSide,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.6;
  scene.add(floor);

  // ── Controls ───────────────────────────────────────────────
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 3.5;
  controls.maxDistance = 12;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.autoRotate = !state.processing;
  controls.autoRotateSpeed = 0.7;

  let userInteracting = false;
  controls.addEventListener('start', () => {
    userInteracting = true;
    controls.autoRotate = false;
  });
  controls.addEventListener('end', () => {
    userInteracting = false;
    controls.autoRotate = !state.processing;
  });

  // ── Model + material ───────────────────────────────────────
  const modelRoot = new THREE.Group();
  scene.add(modelRoot);

  const material = new THREE.MeshStandardMaterial();
  applyMaterialPreset(material, state.materialType, state.headColor);

  let placeholderGroup = null;
  let stlMesh = null;
  let lastStlKey = null;

  rebuildPlaceholder();

  // ── Sizing ─────────────────────────────────────────────────
  function fitToContainer() {
    const w = container.clientWidth || 320;
    const h = container.clientHeight || 380;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(fitToContainer);
  ro.observe(container);
  fitToContainer();

  // ── Render loop ────────────────────────────────────────────
  const clock = new THREE.Clock();
  let rafId = 0;
  let materialBaseEmissive = material.emissiveIntensity;
  function tick() {
    rafId = requestAnimationFrame(tick);
    if (state.processing && !stlMesh && placeholderGroup) {
      const t = clock.getElapsedTime();
      material.emissiveIntensity = materialBaseEmissive + 0.25 + Math.sin(t * 2.6) * 0.18;
    } else if (material.emissiveIntensity !== materialBaseEmissive) {
      material.emissiveIntensity = materialBaseEmissive;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  tick();

  // ── Internals ──────────────────────────────────────────────
  function applyMaterialPreset(mat, preset, hex) {
    mat.color.set(hex);
    if (preset === 'chrome') {
      mat.metalness = 1.0;
      mat.roughness = 0.06;
      mat.emissive.set(0x101018);
      mat.emissiveIntensity = 0.55;
    } else if (preset === 'gloss') {
      mat.metalness = 0.55;
      mat.roughness = 0.2;
      mat.emissive.set(0x000000);
      mat.emissiveIntensity = 0;
    } else {
      mat.metalness = 0.06;
      mat.roughness = 0.8;
      mat.emissive.set(0x000000);
      mat.emissiveIntensity = 0;
    }
    mat.needsUpdate = true;
  }

  function rebuildPlaceholder() {
    disposeGroup(placeholderGroup);
    placeholderGroup = null;
    if (stlMesh) return;

    const group = new THREE.Group();

    // Stem cylinder — neckLength 20..80 → 0.8..2.4 units tall.
    const stemH = 0.8 + ((state.neckLength - 20) / 60) * 1.6;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, stemH, 32),
      material,
    );
    stem.position.y = -0.2;
    group.add(stem);

    // Base flange under the stem.
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.18, 32),
      material,
    );
    flange.position.y = -0.2 - stemH / 2 - 0.09;
    group.add(flange);

    // Thread rings.
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.012, 8, 32),
        material,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.2 - stemH / 2 + 0.18 + i * 0.16;
      group.add(ring);
    }

    // Head sphere — tilt-able sub-group.
    const headR = 0.62 * state.headScale;
    const headSub = new THREE.Group();
    headSub.position.y = -0.2 + stemH / 2 + headR * 0.95;
    // Pitch around X (chin up positive) — matches the v1 pipeline's
    // Stage-1 head_tilt_deg semantics so the placeholder previews the
    // user's slider. Three.js scene is Y-up; X-axis rotation tilts
    // the head forward/back from the camera's perspective.
    headSub.rotation.x = THREE.MathUtils.degToRad(state.headTilt);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(headR, 48, 32),
      material,
    );
    head.name = 'head';
    headSub.add(head);
    group.add(headSub);

    // Recenter group around y=0.
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.y -= center.y;

    placeholderGroup = group;
    modelRoot.add(group);
  }

  function loadStl(data) {
    const key = stlKey(data);
    if (!key || key === lastStlKey) return;
    lastStlKey = key;

    const arrayBuffer = toArrayBuffer(data);
    if (!arrayBuffer) {
      console.warn('valve-stem-viewer: unsupported stlData type');
      return;
    }

    let geo;
    try {
      geo = new STLLoader().parse(arrayBuffer);
    } catch (err) {
      console.error('STL parse failed', err);
      return;
    }
    geo.computeVertexNormals();
    geo.center();
    geo.computeBoundingSphere();
    const r = geo.boundingSphere?.radius || 1;
    const scale = 1.5 / r;

    disposeGroup(placeholderGroup);
    placeholderGroup = null;
    if (stlMesh) {
      modelRoot.remove(stlMesh);
      stlMesh.geometry.dispose();
    }

    const mesh = new THREE.Mesh(geo, material);
    mesh.scale.setScalar(scale);
    // STLs from TRELLIS are Z-up; Three.js convention is Y-up.
    mesh.rotation.x = -Math.PI / 2;
    modelRoot.add(mesh);
    stlMesh = mesh;

    // Reset framing on a fresh mesh.
    controls.target.set(0, 0, 0);
    camera.position.set(0, 1.4, 6);
    controls.update();
  }

  function clearStl() {
    lastStlKey = null;
    if (stlMesh) {
      modelRoot.remove(stlMesh);
      stlMesh.geometry.dispose();
      stlMesh = null;
    }
    rebuildPlaceholder();
  }

  return {
    update(patch) {
      const prev = { ...state };
      Object.assign(state, patch);

      if (prev.materialType !== state.materialType
          || prev.headColor !== state.headColor) {
        applyMaterialPreset(material, state.materialType, state.headColor);
        materialBaseEmissive = material.emissiveIntensity;
      }

      const placeholderParamsChanged =
        prev.headScale !== state.headScale
        || prev.neckLength !== state.neckLength
        || prev.headTilt !== state.headTilt;
      if (!stlMesh && placeholderParamsChanged) rebuildPlaceholder();

      if (state.stlData && state.stlData !== prev.stlData) {
        loadStl(state.stlData);
      } else if (!state.stlData && prev.stlData) {
        clearStl();
      }

      controls.autoRotate = !state.processing && !userInteracting;
    },
    destroy() {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      disposeGroup(placeholderGroup);
      if (stlMesh) stlMesh.geometry.dispose();
      material.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function disposeGroup(group) {
  if (!group) return;
  // Geometries are unique per-mesh; materials are shared and owned by
  // createValveStemViewer (disposed in destroy()).
  group.traverse((o) => {
    if (o.geometry?.dispose) o.geometry.dispose();
  });
  if (group.parent) group.parent.remove(group);
}

function stlKey(data) {
  if (!data) return null;
  if (data instanceof ArrayBuffer) return `ab:${data.byteLength}`;
  if (data instanceof Uint8Array)  return `u8:${data.byteLength}`;
  if (typeof data === 'string')    return `s:${data.length}:${data.slice(0, 32)}`;
  return null;
}

function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  if (data instanceof Uint8Array) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  if (typeof data === 'string') {
    const b64 = data.indexOf(',') >= 0 ? data.slice(data.indexOf(',') + 1) : data;
    // Try base64 first; fall back to treating the string as ASCII STL text.
    if (looksLikeBase64(b64)) {
      try {
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return buf.buffer;
      } catch {
        // fall through
      }
    }
    return new TextEncoder().encode(data).buffer;
  }
  return null;
}

function looksLikeBase64(s) {
  // Cheap test — base64 STL is large and consists of [A-Za-z0-9+/=]. ASCII
  // STL begins with the literal "solid" keyword, so it'll fail this test.
  if (s.length < 32) return false;
  const head = s.slice(0, 64);
  return /^[A-Za-z0-9+/=\s]+$/.test(head) && !head.trimStart().startsWith('solid');
}
