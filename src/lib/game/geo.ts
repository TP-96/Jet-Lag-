export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371008.8; // mean Earth radius, metres
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in metres. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point reached by travelling `dist` metres from `p` on initial bearing `bearingDeg`. */
export function destination(p: LatLng, bearingDeg: number, dist: number): LatLng {
  const δ = dist / R;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(p.lat);
  const λ1 = toRad(p.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 };
}

export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/** Radar: is the hider within `radius` metres of the seeker? */
export function radarAnswer(seeker: LatLng, hider: LatLng, radius: number): boolean {
  return haversine(seeker, hider) <= radius;
}

/** Thermometer: after moving from `start` to `end`, is the seeker closer ("hotter") to the hider? */
export function thermometerAnswer(start: LatLng, end: LatLng, hider: LatLng): 'hotter' | 'colder' {
  return haversine(end, hider) < haversine(start, hider) ? 'hotter' : 'colder';
}

/**
 * Polygon covering the half of the map that a thermometer answer rules OUT.
 * The dividing line is the perpendicular bisector of start→end (locally flat approximation,
 * accurate at city scale). `extent` is how far the shaded region stretches.
 */
export function thermometerExcludedPolygon(
  start: LatLng,
  end: LatLng,
  answer: 'hotter' | 'colder',
  extent = 60000,
): LatLng[] {
  const mid = midpoint(start, end);
  const b = bearing(start, end);
  // Hotter ⇒ hider is on the `end` side, so exclude the `start` side.
  const away = answer === 'hotter' ? (b + 180) % 360 : b;
  const left = destination(mid, (b + 90) % 360, extent);
  const right = destination(mid, (b + 270) % 360, extent);
  return [left, destination(left, away, extent), destination(right, away, extent), right];
}
