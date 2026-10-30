import { describe, expect, it } from 'vitest';
import { destination, haversine, radarAnswer, thermometerAnswer, thermometerExcludedPolygon } from '@/lib/game/geo';
import { availableQuestions, questionsFor, QUESTIONS } from '@/lib/game/questions';
import { formatDistance, formatDuration } from '@/lib/game/config';

// Hamilton, ON — McMaster University and Hamilton GO Centre
const mac = { lat: 43.2609, lng: -79.9192 };
const go = { lat: 43.2531, lng: -79.8697 };

describe('geo', () => {
  it('computes realistic distances', () => {
    const d = haversine(mac, go);
    expect(d).toBeGreaterThan(3900);
    expect(d).toBeLessThan(4300);
  });

  it('destination is consistent with haversine', () => {
    const p = destination(mac, 45, 2500);
    expect(haversine(mac, p)).toBeCloseTo(2500, 0);
  });

  it('answers radar questions', () => {
    expect(radarAnswer(mac, go, 5000)).toBe(true);
    expect(radarAnswer(mac, go, 3000)).toBe(false);
  });

  it('answers thermometer questions', () => {
    const towardGo = destination(mac, 100, 600);
    expect(thermometerAnswer(mac, towardGo, go)).toBe('hotter');
    expect(thermometerAnswer(towardGo, mac, go)).toBe('colder');
  });

  it('thermometer exclusion polygon excludes the start side when hotter', () => {
    const end = destination(mac, 90, 1000);
    const poly = thermometerExcludedPolygon(mac, end, 'hotter', 5000);
    const centroid = {
      lat: poly.reduce((s, p) => s + p.lat, 0) / 4,
      lng: poly.reduce((s, p) => s + p.lng, 0) / 4,
    };
    expect(centroid.lng).toBeLessThan(mac.lng + 0.001);
  });
});

describe('questions & formatting', () => {
  it('scales the question pool by game size', () => {
    expect(questionsFor('small').length).toBeLessThan(questionsFor('medium').length);
    expect(questionsFor('medium').length).toBeLessThan(questionsFor('large').length);
    expect(questionsFor('large')).toHaveLength(QUESTIONS.length);
  });

  it('removes asked questions except custom radar', () => {
    const avail = availableQuestions('small', ['radar:1km', 'radar:custom']);
    expect(avail.find((q) => q.id === 'radar:1km')).toBeUndefined();
    expect(avail.find((q) => q.id === 'radar:custom')).toBeDefined();
  });

  it('formats distances and durations', () => {
    expect(formatDistance(450, 'metric')).toBe('450 m');
    expect(formatDistance(2500, 'metric')).toBe('2.5 km');
    expect(formatDistance(1609.344, 'imperial')).toBe('1 mi');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});
