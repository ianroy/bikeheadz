import { useRef, useEffect } from "react";
import * as THREE from "three";

interface Props {
  headScale: number;
  neckLength: number;
  headTilt: number;
  materialType: "matte" | "gloss" | "chrome";
  headColor: string;
  photoUrl: string | null;
  processing: boolean;
}

export function ValveStem3DViewer({
  headScale,
  neckLength,
  headTilt,
  materialType,
  headColor,
  photoUrl,
  processing,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Store scene objects we need to update
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    group: THREE.Group;
    headMeshes: THREE.Mesh[];
    scanRing: THREE.Mesh | null;
    animId: number;
    scanY: number;
    isDragging: boolean;
    prevMouse: { x: number; y: number };
    spherical: { theta: number; phi: number; radius: number };
  } | null>(null);

  // Update head color / texture / material when props change
  const propsRef = useRef({ headScale, neckLength, headTilt, materialType, headColor, photoUrl, processing });
  propsRef.current = { headScale, neckLength, headTilt, materialType, headColor, photoUrl, processing };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x0d0d1e);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);

    // ── Camera ────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    const spherical = { theta: 0.3, phi: Math.PI / 2.5, radius: 8 };
    const updateCamera = () => {
      camera.position.set(
        spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
        spherical.radius * Math.cos(spherical.phi),
        spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)
      );
      camera.lookAt(0, 0.5, 0);
    };
    updateCamera();

    // ── Scene ─────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d0d1e, 15, 35);

    // ── Lights ────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xb4ff45, 0.6);
    rimLight.position.set(-5, 3, -5);
    scene.add(rimLight);

    const blueLight = new THREE.PointLight(0x4d88ff, 1.2, 20);
    blueLight.position.set(0, 6, 0);
    scene.add(blueLight);

    // ── Materials ─────────────────────────────────────────────────────
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0xb0b8c8, metalness: 0.95, roughness: 0.08,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc8a032, metalness: 0.8, roughness: 0.25,
    });
    const threadMat = new THREE.MeshStandardMaterial({
      color: 0x909aac, metalness: 0.9, roughness: 0.15,
    });
    const neckConnMat = new THREE.MeshStandardMaterial({
      color: 0x909aac, metalness: 0.9, roughness: 0.1,
    });

    // ── Group ─────────────────────────────────────────────────────────
    const group = new THREE.Group();
    scene.add(group);

    const addMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      return m;
    };

    // Base flange
    addMesh(new THREE.CylinderGeometry(0.38, 0.45, 0.18, 32), stemMat, -2.2);
    // Lower locknut
    addMesh(new THREE.CylinderGeometry(0.28, 0.28, 0.25, 8), brassMat, -1.9);
    // Main shaft
    addMesh(new THREE.CylinderGeometry(0.18, 0.22, 2.0, 32), stemMat, -0.8);
    // Thread rings
    for (const y of [-0.05, 0.05, 0.15, 0.25, 0.35]) {
      addMesh(new THREE.TorusGeometry(0.19, 0.012, 8, 32), threadMat, y);
    }
    // Upper locknut
    addMesh(new THREE.CylinderGeometry(0.26, 0.26, 0.22, 8), brassMat, 0.62);
    // Valve core top
    addMesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 24), stemMat, 0.75);

    // Floor shadow catcher
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.2 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.6;
    floor.receiveShadow = true;
    scene.add(floor);

    // ── Dynamic head group (rebuilt on prop changes) ──────────────────
    const headGroup = new THREE.Group();
    group.add(headGroup);

    const headMeshes: THREE.Mesh[] = [];

    let scanRing: THREE.Mesh | null = null;

    const buildHead = () => {
      // Clear old meshes
      while (headGroup.children.length) headGroup.remove(headGroup.children[0]);
      headMeshes.length = 0;

      const { headScale: hs, neckLength: nl, headTilt: ht, materialType: mt, headColor: hc, photoUrl: pu } = propsRef.current;

      const scaledNeck = nl * 0.08;
      const neckBaseY = 0.9;
      const headY = neckBaseY + scaledNeck + hs * 0.5;

      // Neck connector
      const neckConn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, scaledNeck + 0.1, 24),
        neckConnMat
      );
      neckConn.position.y = neckBaseY + scaledNeck / 2;
      headGroup.add(neckConn);

      // Material props
      let metalness = 0.05, roughness = 0.75;
      if (mt === "gloss") { metalness = 0.1; roughness = 0.05; }
      else if (mt === "chrome") { metalness = 0.98; roughness = 0.02; }

      const headMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hc),
        metalness,
        roughness,
      });

      if (pu) {
        const loader = new THREE.TextureLoader();
        loader.load(pu, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          headMat.map = tex;
          headMat.color.set(0xffffff);
          headMat.needsUpdate = true;
        });
      }

      // Head subgroup for tilt
      const sub = new THREE.Group();
      sub.position.y = headY;
      sub.rotation.x = ht * 0.02;
      headGroup.add(sub);

      // Neck stub
      const neckStub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, hs * 0.4, 24),
        headMat
      );
      neckStub.position.y = -hs * 0.35;
      sub.add(neckStub);
      headMeshes.push(neckStub);

      // Head sphere
      const headSphere = new THREE.Mesh(
        new THREE.SphereGeometry(hs * 0.52, 48, 48),
        headMat
      );
      headSphere.position.y = hs * 0.05;
      headSphere.castShadow = true;
      sub.add(headSphere);
      headMeshes.push(headSphere);

      // Scan ring
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xb4ff45,
        emissive: new THREE.Color(0xb4ff45),
        emissiveIntensity: 3,
        transparent: true,
        opacity: 0.85,
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(hs * 0.53, 0.025, 8, 64),
        ringMat
      );
      ring.visible = false;
      sub.add(ring);
      scanRing = ring;
      sceneRef.current && (sceneRef.current.scanRing = ring);
    };

    buildHead();

    // ── Resize observer ───────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(mount);
    onResize();

    // ── Mouse orbit controls ──────────────────────────────────────────
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      spherical.theta -= dx * 0.008;
      spherical.phi = Math.max(0.3, Math.min(Math.PI - 0.3, spherical.phi + dy * 0.008));
      prevMouse = { x: e.clientX, y: e.clientY };
      updateCamera();
    };
    const onPointerUp = () => { isDragging = false; };
    const onWheel = (e: WheelEvent) => {
      spherical.radius = Math.max(3, Math.min(14, spherical.radius + e.deltaY * 0.01));
      updateCamera();
    };

    mount.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    mount.addEventListener("wheel", onWheel, { passive: true });

    // ── Animate ───────────────────────────────────────────────────────
    let scanY = -1.5;
    let animId = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const { processing: proc, headScale: hs } = propsRef.current;

      if (!isDragging && !proc) {
        spherical.theta += 0.004;
        updateCamera();
      }

      if (proc && scanRing) {
        scanRing.visible = true;
        scanY += 0.018;
        if (scanY > 1.5) scanY = -1.5;
        scanRing.position.y = scanY * hs * 0.6;
      } else if (scanRing) {
        scanRing.visible = false;
      }

      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = {
      renderer, scene, camera, group, headMeshes, scanRing,
      animId, scanY, isDragging, prevMouse, spherical,
    };

    // Store rebuild function so prop-change effect can call it
    (sceneRef.current as any).buildHead = buildHead;

    return () => {
      cancelAnimationFrame(animId);
      resizeObs.disconnect();
      mount.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      mount.removeEventListener("wheel", onWheel);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []); // Only run once on mount

  // Rebuild head whenever relevant props change
  useEffect(() => {
    if (sceneRef.current && (sceneRef.current as any).buildHead) {
      (sceneRef.current as any).buildHead();
    }
  }, [headScale, neckLength, headTilt, materialType, headColor, photoUrl]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full"
      style={{ background: "#0d0d1e", cursor: "grab", touchAction: "none" }}
    />
  );
}
