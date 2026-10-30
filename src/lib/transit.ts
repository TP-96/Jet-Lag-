// Transit overlay built from live OpenStreetMap data via the Overpass API:
// route relations (bus, tram, subway, rail, ferry) and stations/stops inside the visible map area.

export type TransitMode = 'bus' | 'trolleybus' | 'tram' | 'light_rail' | 'subway' | 'train' | 'monorail' | 'ferry';

export interface TransitRoute {
  id: number;
  mode: TransitMode;
  ref?: string;
  name?: string;
  color: string;
  lines: [number, number][][];
}

export interface TransitStop {
  id: number;
  lat: number;
  lng: number;
  name?: string;
  kind: 'station' | 'tram' | 'bus';
}

export interface TransitData {
  routes: TransitRoute[];
  stops: TransitStop[];
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export const MODE_COLORS: Record<TransitMode, string> = {
  subway: '#0a6cff',
  train: '#9b4dca',
  monorail: '#9b4dca',
  light_rail: '#e5133b',
  tram: '#e5133b',
  trolleybus: '#ff9f1a',
  bus: '#ffb31a',
  ferry: '#00b3c6',
};

/** Heavier lines for rapid transit so they read above bus routes. */
export const MODE_WEIGHT: Record<TransitMode, number> = {
  subway: 5,
  train: 5,
  monorail: 5,
  light_rail: 4,
  tram: 4,
  ferry: 3,
  trolleybus: 3,
  bus: 2.5,
};

const MODES = Object.keys(MODE_COLORS) as TransitMode[];

/** Accept OSM `colour` tags like "#E3002B", "e3002b" or "red"; anything else falls back to the mode colour. */
export function normaliseColour(tag: string | undefined, mode: TransitMode): string {
  const t = tag?.trim();
  if (t && /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(t)) return t.startsWith('#') ? t : `#${t}`;
  if (t && /^[a-zA-Z]{3,20}$/.test(t)) return t.toLowerCase();
  return MODE_COLORS[mode];
}

export function buildQuery(b: BBox, includeBusStops: boolean): string {
  const bbox = `${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)}`;
  return `[out:json][timeout:25];
relation["type"="route"]["route"~"^(${MODES.join('|')})$"](${bbox});
out tags geom(${bbox});
(
  node["railway"~"^(station|halt|tram_stop)$"](${bbox});
  node["public_transport"="station"](${bbox});${includeBusStops ? `\n  node["highway"="bus_stop"](${bbox});` : ''}
);
out body;`;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  members?: { type: string; role?: string; geometry?: { lat: number; lon: number }[] }[];
}

export function parseOverpass(json: { elements?: OverpassElement[] }): TransitData {
  const routes: TransitRoute[] = [];
  const stops: TransitStop[] = [];
  const seenStops = new Set<string>();
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    if (el.type === 'relation') {
      const mode = tags.route as TransitMode;
      if (!MODES.includes(mode)) continue;
      const lines = (el.members ?? [])
        .filter((m) => m.type === 'way' && m.geometry && m.geometry.length > 1 && !/platform|stop/.test(m.role ?? ''))
        // Clipped geometry (`out geom(bbox)`) may contain null placeholders outside the box.
        .map((m) => m.geometry!.filter((g) => g && typeof g.lat === 'number').map((g) => [g.lat, g.lon] as [number, number]))
        .filter((l) => l.length > 1);
      if (lines.length === 0) continue;
      routes.push({ id: el.id, mode, ref: tags.ref, name: tags.name, color: normaliseColour(tags.colour, mode), lines });
    } else if (el.type === 'node' && el.lat != null && el.lon != null) {
      const kind: TransitStop['kind'] =
        tags.highway === 'bus_stop' ? 'bus' : tags.railway === 'tram_stop' ? 'tram' : 'station';
      // Stations are often mapped twice (railway=station + public_transport=station) — merge by name & place.
      const key = `${tags.name ?? el.id}|${el.lat.toFixed(3)}|${el.lon.toFixed(3)}`;
      if (seenStops.has(key)) continue;
      seenStops.add(key);
      stops.push({ id: el.id, lat: el.lat, lng: el.lon, name: tags.name, kind });
    }
  }
  // Draw buses first so rail sits on top.
  routes.sort((a, b) => MODE_WEIGHT[a.mode] - MODE_WEIGHT[b.mode]);
  return { routes, stops };
}

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const cache = new Map<string, TransitData>();

export async function fetchTransit(b: BBox, includeBusStops: boolean, signal?: AbortSignal): Promise<TransitData> {
  const query = buildQuery(b, includeBusStops);
  const hit = cache.get(query);
  if (hit) return hit;
  let lastErr: unknown;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), signal });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = parseOverpass(await res.json());
      cache.set(query, data);
      return data;
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Transit data unavailable');
}

/** Grow a bbox by `factor` on each side so small pans don't trigger a refetch. */
export function padBBox(b: BBox, factor = 0.5): BBox {
  const dLat = (b.north - b.south) * factor;
  const dLng = (b.east - b.west) * factor;
  return { south: b.south - dLat, west: b.west - dLng, north: b.north + dLat, east: b.east + dLng };
}

export function contains(outer: BBox, inner: BBox): boolean {
  return inner.south >= outer.south && inner.west >= outer.west && inner.north <= outer.north && inner.east <= outer.east;
}
