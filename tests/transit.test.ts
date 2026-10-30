import { describe, expect, it } from 'vitest';
import { buildQuery, contains, normaliseColour, padBBox, parseOverpass } from '@/lib/transit';

const sample = {
  elements: [
    {
      type: 'relation',
      id: 1,
      tags: { type: 'route', route: 'bus', ref: '1', name: 'King', colour: 'E3002B' },
      members: [
        { type: 'way', role: '', geometry: [{ lat: 43.25, lon: -79.87 }, { lat: 43.256, lon: -79.86 }] },
        { type: 'way', role: 'platform', geometry: [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }] },
        { type: 'node', role: 'stop' },
      ],
    },
    {
      type: 'relation',
      id: 2,
      tags: { type: 'route', route: 'train', name: 'Lakeshore West' },
      members: [{ type: 'way', role: '', geometry: [{ lat: 43.25, lon: -79.9 }, null, { lat: 43.26, lon: -79.8 }, { lat: 43.27, lon: -79.7 }] }],
    },
    { type: 'relation', id: 3, tags: { type: 'route', route: 'hiking' }, members: [] },
    { type: 'node', id: 10, lat: 43.2531, lon: -79.8697, tags: { railway: 'station', name: 'Hamilton GO Centre' } },
    { type: 'node', id: 11, lat: 43.2532, lon: -79.8698, tags: { public_transport: 'station', name: 'Hamilton GO Centre' } },
    { type: 'node', id: 12, lat: 43.26, lon: -79.9, tags: { highway: 'bus_stop', name: 'Main at Dundurn' } },
  ],
};

describe('transit overlay', () => {
  it('parses routes, skips platforms/non-transit, clips nulls and merges duplicate stations', () => {
    const d = parseOverpass(sample as never);
    expect(d.routes.map((r) => r.mode)).toEqual(['bus', 'train']); // bus drawn first, rail on top
    expect(d.routes[0]).toMatchObject({ ref: '1', color: '#E3002B' });
    expect(d.routes[0].lines).toHaveLength(1);
    expect(d.routes[1].lines[0]).toHaveLength(3);
    expect(d.stops).toHaveLength(2);
    expect(d.stops.find((s) => s.kind === 'bus')?.name).toBe('Main at Dundurn');
  });

  it('normalises OSM colour tags', () => {
    expect(normaliseColour('#00f', 'bus')).toBe('#00f');
    expect(normaliseColour('Red', 'bus')).toBe('red');
    expect(normaliseColour('not a colour!', 'subway')).toBe('#0a6cff');
    expect(normaliseColour(undefined, 'tram')).toBe('#e5133b');
  });

  it('builds a clipped query and only asks for bus stops when zoomed in', () => {
    const b = { south: 43.2, west: -79.95, north: 43.3, east: -79.8 };
    expect(buildQuery(b, false)).toContain('out tags geom(43.20000,-79.95000,43.30000,-79.80000)');
    expect(buildQuery(b, false)).not.toContain('bus_stop');
    expect(buildQuery(b, true)).toContain('bus_stop');
  });

  it('pads and checks bounding boxes', () => {
    const b = { south: 0, west: 0, north: 1, east: 1 };
    const p = padBBox(b);
    expect(p).toEqual({ south: -0.5, west: -0.5, north: 1.5, east: 1.5 });
    expect(contains(p, b)).toBe(true);
    expect(contains(b, p)).toBe(false);
  });
});
