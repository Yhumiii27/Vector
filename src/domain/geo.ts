// Planisphere of the map of flows (docs/spec/02 § 6): equirectangular projection and very simplified continent outlines
// (a few dozen points each, drawn for orientation only — no external tile, no network). Pure.
export interface Pt { x: number; y: number }

export const MAP_W = 1000;
export const MAP_H = 500;

/** Longitude / latitude → SVG point (equirectangular). */
export const project = (lon: number, lat: number): Pt => ({ x: ((lon + 180) / 360) * MAP_W, y: ((90 - lat) / 180) * MAP_H });

/** Rough outlines [lon, lat] of the continents. */
export const CONTINENTS: readonly (readonly [number, number])[][] = [
  // North America
  [[-168, 66], [-140, 70], [-95, 72], [-80, 66], [-62, 60], [-55, 50], [-66, 44], [-75, 35], [-81, 25], [-88, 30], [-97, 26], [-97, 19], [-87, 21], [-83, 10], [-79, 8], [-92, 15], [-105, 20], [-112, 30], [-118, 34], [-124, 41], [-124, 48], [-133, 56], [-150, 60], [-165, 60]],
  // South America
  [[-79, 8], [-72, 12], [-62, 10], [-50, 2], [-35, -6], [-39, -15], [-48, -26], [-58, -35], [-65, -42], [-68, -55], [-74, -50], [-73, -38], [-71, -18], [-81, -5], [-77, 2]],
  // Europe
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [10, 58], [5, 62], [14, 68], [26, 71], [40, 67], [38, 60], [30, 56], [28, 46], [22, 40], [16, 38], [12, 44], [8, 44], [3, 42], [-2, 37]],
  // Africa
  [[-17, 21], [-12, 28], [-6, 35], [10, 37], [20, 32], [32, 31], [35, 25], [43, 12], [51, 11], [44, -1], [40, -15], [35, -25], [26, -34], [18, -34], [12, -17], [13, -6], [9, 4], [-8, 4], [-15, 10]],
  // Asia
  [[28, 41], [36, 36], [35, 30], [43, 13], [58, 22], [57, 26], [66, 25], [73, 20], [78, 8], [88, 22], [98, 16], [104, 1], [109, 12], [108, 21], [121, 31], [122, 40], [131, 43], [142, 47], [160, 60], [178, 66], [150, 72], [110, 77], [70, 73], [50, 68], [40, 66], [38, 60], [30, 56], [28, 46]],
  // Australia
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [151, -34], [145, -39], [138, -35], [131, -31], [115, -34]],
  // Arabian peninsula detail is in Asia; Madagascar
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
];

export const pathOf = (poly: readonly (readonly [number, number])[]) =>
  poly.map(([lon, lat], i) => { const p = project(lon, lat); return `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ') + ' Z';

/** A curved route between two points (quadratic Bézier, bulging north). */
export function arc(a: Pt, b: Pt): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - Math.min(120, Math.hypot(b.x - a.x, b.y - a.y) * 0.25);
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}
