import { describe, expect, it } from 'vitest';
import { BOUNDARY_PRESETS, boundaryArea, circleBoundary, distanceToEdge, isValidBoundary, pointInBoundary } from '@/lib/game/geofence';

const city = BOUNDARY_PRESETS.find((p) => p.id === 'toronto-city')!.boundary;
const downtown = BOUNDARY_PRESETS.find((p) => p.id === 'toronto-downtown')!.boundary;
const core = BOUNDARY_PRESETS.find((p) => p.id === 'toronto-core')!.boundary;

// Known Toronto locations
const unionStation = { lat: 43.6453, lng: -79.3806 };
const finchStation = { lat: 43.7804, lng: -79.4153 };
const scarboroughTC = { lat: 43.7754, lng: -79.2577 };
const kiplingStation = { lat: 43.6372, lng: -79.5361 };
const pearsonAirport = { lat: 43.6777, lng: -79.6248 }; // Mississauga
const vaughanMetroCentre = { lat: 43.7943, lng: -79.5273 }; // Vaughan
const pickering = { lat: 43.8384, lng: -79.0868 };
const lakeOntario = { lat: 43.55, lng: -79.4 };

describe('geofence', () => {
  it('Toronto city preset contains TTC stations and excludes neighbouring cities and the lake', () => {
    for (const p of [unionStation, finchStation, scarboroughTC, kiplingStation]) expect(pointInBoundary(p, city)).toBe(true);
    for (const p of [pearsonAirport, vaughanMetroCentre, pickering, lakeOntario]) expect(pointInBoundary(p, city)).toBe(false);
  });

  it('city area is close to the real 630 km²', () => {
    const km2 = boundaryArea(city) / 1e6;
    expect(km2).toBeGreaterThan(560);
    expect(km2).toBeLessThan(700);
  });

  it('downtown and core presets nest sensibly', () => {
    expect(pointInBoundary(unionStation, downtown)).toBe(true);
    expect(pointInBoundary(finchStation, downtown)).toBe(false);
    expect(pointInBoundary(unionStation, core)).toBe(true);
    expect(pointInBoundary({ lat: 43.6655, lng: -79.4115 }, core)).toBe(true); // Bathurst station
    expect(pointInBoundary(kiplingStation, core)).toBe(false);
    expect(boundaryArea(downtown)).toBeLessThan(boundaryArea(core));
    expect(boundaryArea(core)).toBeLessThan(boundaryArea(city));
  });

  it('circle boundaries have the right size and edge distance', () => {
    const c = circleBoundary(unionStation, 2000, 'test');
    expect(isValidBoundary(c)).toBe(true);
    expect(boundaryArea(c) / 1e6).toBeCloseTo(Math.PI * 4, 0);
    expect(pointInBoundary(unionStation, c)).toBe(true);
    expect(distanceToEdge(unionStation, c)).toBeGreaterThan(1980);
    expect(distanceToEdge(unionStation, c)).toBeLessThan(2001);
  });

  it('reports how far outside a player is', () => {
    const d = distanceToEdge(pearsonAirport, city);
    expect(d).toBeGreaterThan(500);
    expect(d).toBeLessThan(3000);
  });

  it('rejects malformed boundaries', () => {
    expect(isValidBoundary(null)).toBe(false);
    expect(isValidBoundary({ name: 'x', points: [[1, 2], [3, 4]] })).toBe(false);
    expect(isValidBoundary({ name: 'x', points: [[1, 2], [3, 4], [5, NaN]] })).toBe(false);
  });
});
