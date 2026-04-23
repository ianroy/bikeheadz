// STL generation runs server-side and streams progress over the same socket
// using the two-way command pattern. While a request is in flight, the server
// emits `stl.generate.progress` messages; the final `stl.generate.result` carries
// the STL body.

const STEPS = [
  'Analyzing facial geometry...',
  'Extracting head mesh...',
  'Scaling to valve dimensions...',
  'Merging with stem base...',
  'Generating STL manifold...',
  'Finalizing print file...',
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildSTL() {
  const triangles = [];
  const r = 8;
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const t1 = (i / steps) * Math.PI;
      const t2 = ((i + 1) / steps) * Math.PI;
      const p1 = (j / steps) * 2 * Math.PI;
      const p2 = ((j + 1) / steps) * 2 * Math.PI;
      const v = (t, p) => ({
        x: +(r * Math.sin(t) * Math.cos(p)).toFixed(6),
        y: +(r * Math.cos(t)).toFixed(6),
        z: +(r * Math.sin(t) * Math.sin(p)).toFixed(6),
      });
      const nml = (t, p) => ({
        x: +(Math.sin(t) * Math.cos(p)).toFixed(6),
        y: +(Math.cos(t)).toFixed(6),
        z: +(Math.sin(t) * Math.sin(p)).toFixed(6),
      });
      const a = v(t1, p1);
      const b = v(t1, p2);
      const c = v(t2, p1);
      const d = v(t2, p2);
      const n = nml((t1 + t2) / 2, (p1 + p2) / 2);
      triangles.push(
        `facet normal ${n.x} ${n.y} ${n.z}\n  outer loop\n    vertex ${a.x} ${a.y} ${a.z}\n    vertex ${b.x} ${b.y} ${b.z}\n    vertex ${c.x} ${c.y} ${c.z}\n  endloop\nendfacet`,
        `facet normal ${n.x} ${n.y} ${n.z}\n  outer loop\n    vertex ${b.x} ${b.y} ${b.z}\n    vertex ${d.x} ${d.y} ${d.z}\n    vertex ${c.x} ${c.y} ${c.z}\n  endloop\nendfacet`
      );
    }
  }
  return `solid BikeHeadz_ValveStem\n${triangles.join('\n')}\nendsolid BikeHeadz_ValveStem`;
}

export const stlCommands = {
  'stl.generate': async ({ socket, id }) => {
    for (let i = 0; i < STEPS.length; i++) {
      await sleep(500 + Math.random() * 300);
      socket.emit('command', {
        id,
        name: 'stl.generate.progress',
        payload: {
          step: STEPS[i],
          pct: Math.round(((i + 1) / STEPS.length) * 100),
        },
      });
    }
    return {
      filename: 'BikeHeadz_ValveStem.stl',
      mime: 'model/stl',
      stl: buildSTL(),
    };
  },
};
