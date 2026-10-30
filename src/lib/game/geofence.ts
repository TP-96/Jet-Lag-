import { destination, type LatLng } from './geo';

/** The play area: everyone must stay inside, and the hiding zone must be inside it. */
export interface Boundary {
  name: string;
  /** Polygon ring as [lat, lng] pairs (not closed: the last point connects back to the first). */
  points: [number, number][];
}

const R = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Local flat projection (metres) around a reference latitude — accurate to well under 1% at city scale. */
function project(p: LatLng, refLat: number): [number, number] {
  return [toRad(p.lng) * R * Math.cos(toRad(refLat)), toRad(p.lat) * R];
}

export function pointInBoundary(p: LatLng, b: Boundary): boolean {
  const pts = b.points;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i];
    const [yj, xj] = pts[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Shortest distance in metres from `p` to the boundary's edge. */
export function distanceToEdge(p: LatLng, b: Boundary): number {
  const ref = p.lat;
  const [px, py] = project(p, ref);
  let best = Infinity;
  for (let i = 0; i < b.points.length; i++) {
    const a = b.points[i];
    const c = b.points[(i + 1) % b.points.length];
    const [ax, ay] = project({ lat: a[0], lng: a[1] }, ref);
    const [cx, cy] = project({ lat: c[0], lng: c[1] }, ref);
    const dx = cx - ax;
    const dy = cy - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

/** Area in square metres. */
export function boundaryArea(b: Boundary): number {
  if (b.points.length < 3) return 0;
  const ref = b.points.reduce((s, p) => s + p[0], 0) / b.points.length;
  const xy = b.points.map(([lat, lng]) => project({ lat, lng }, ref));
  let sum = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function circleBoundary(center: LatLng, radiusM: number, name: string, sides = 48): Boundary {
  return {
    name,
    points: Array.from({ length: sides }, (_, i) => {
      const p = destination(center, (360 / sides) * i, radiusM);
      return [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))] as [number, number];
    }),
  };
}

export function isValidBoundary(b: unknown): b is Boundary {
  const x = b as Boundary;
  return !!x && Array.isArray(x.points) && x.points.length >= 3 && x.points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
}

// ── Presets ──
// Hand-traced approximations (±~500 m). Hosts can drag the corners to fine-tune.

/** City of Toronto limits: Etobicoke Creek, Steeles Ave, the Rouge River and the lakeshore (incl. the Islands). */
const TORONTO_CITY: [number, number][] = [
  [43.5853, -79.542], [43.6005, -79.5487], [43.6215, -79.565], [43.6335, -79.5805], [43.644, -79.588],
  [43.662, -79.598], [43.676, -79.6045], [43.69, -79.613], [43.7055, -79.6205], [43.721, -79.628],
  [43.7365, -79.6335], [43.7505, -79.6395], [43.7612, -79.5978], [43.7725, -79.558], [43.786, -79.524],
  [43.7905, -79.4875], [43.795, -79.443], [43.7985, -79.42], [43.803, -79.38], [43.8075, -79.338],
  [43.8155, -79.3], [43.8235, -79.27], [43.838, -79.247], [43.8455, -79.2205], [43.853, -79.194],
  [43.8555, -79.17], [43.84, -79.1578], [43.82, -79.145], [43.8075, -79.13], [43.7945, -79.116],
  [43.7735, -79.1495], [43.7575, -79.1785], [43.7425, -79.2045], [43.725, -79.2365], [43.705, -79.2605],
  [43.68, -79.28], [43.6655, -79.3065], [43.6515, -79.3315], [43.633, -79.344], [43.6155, -79.364],
  [43.612, -79.386], [43.6205, -79.4085], [43.6305, -79.4405], [43.6305, -79.47], [43.6125, -79.4875],
  [43.595, -79.505], [43.5875, -79.5245],
];

/** Downtown core: roughly Bloor St to the lake, Bathurst St to the Don Valley. */
const TORONTO_DOWNTOWN: [number, number][] = [
  [43.6655, -79.411], [43.6705, -79.3865], [43.6725, -79.3785], [43.6765, -79.358], [43.6625, -79.3555],
  [43.651, -79.356], [43.6405, -79.3665], [43.6375, -79.3825], [43.6345, -79.398], [43.6345, -79.405],
];

/** Old City of Toronto + East York: Humber River to Victoria Park, roughly Eglinton to the lake. */
const TORONTO_CORE: [number, number][] = [
  [43.6305, -79.4705], [43.6505, -79.4835], [43.6765, -79.4985], [43.6925, -79.4945], [43.7045, -79.4485],
  [43.7095, -79.4255], [43.7135, -79.399], [43.7175, -79.3735], [43.7095, -79.3355], [43.7035, -79.3035],
  [43.6935, -79.2845], [43.68, -79.28], [43.6655, -79.3065], [43.6515, -79.3315], [43.633, -79.344],
  [43.6155, -79.364], [43.612, -79.386], [43.6205, -79.4085], [43.6305, -79.4405],
];

export interface BoundaryPreset {
  id: string;
  label: string;
  description: string;
  boundary: Boundary;
}

export const BOUNDARY_PRESETS: BoundaryPreset[] = [
  {
    id: 'toronto-city',
    label: 'Toronto — whole city',
    description: 'City limits: Etobicoke Creek to the Rouge River, the lake to Steeles. All TTC subway, streetcar and most bus routes. Best with Medium size.',
    boundary: { name: 'City of Toronto', points: TORONTO_CITY },
  },
  {
    id: 'toronto-core',
    label: 'Toronto — old city + East York',
    description: 'Humber River to Victoria Park, lake to about Eglinton. Line 1 & 2 core, all streetcars. Great for a Small game.',
    boundary: { name: 'Old Toronto + East York', points: TORONTO_CORE },
  },
  {
    id: 'toronto-downtown',
    label: 'Toronto — downtown',
    description: 'Bloor St to the lake, Bathurst to the Don. Dense streetcar grid; quick, intense rounds.',
    boundary: { name: 'Downtown Toronto', points: TORONTO_DOWNTOWN },
  },
];
