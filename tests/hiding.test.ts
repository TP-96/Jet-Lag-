import { describe, expect, it } from 'vitest';
import { SIZES, formatMinutes, hidingMinutesFor, MAX_HIDING_MINUTES } from '../src/lib/game/config';

describe('hidingMinutesFor', () => {
  it('uses the size default when no custom time is set', () => {
    expect(hidingMinutesFor({ size: 'small', settings: {} })).toBe(SIZES.small.hidingMinutes);
    expect(hidingMinutesFor({ size: 'large', settings: { hidingMinutes: null } })).toBe(SIZES.large.hidingMinutes);
  });
  it('uses a custom time when set', () => {
    expect(hidingMinutesFor({ size: 'small', settings: { hidingMinutes: 45 } })).toBe(45);
  });
  it('ignores invalid values and clamps huge ones', () => {
    expect(hidingMinutesFor({ size: 'medium', settings: { hidingMinutes: 0 } })).toBe(SIZES.medium.hidingMinutes);
    expect(hidingMinutesFor({ size: 'medium', settings: { hidingMinutes: Number.NaN } })).toBe(SIZES.medium.hidingMinutes);
    expect(hidingMinutesFor({ size: 'medium', settings: { hidingMinutes: 99999 } })).toBe(MAX_HIDING_MINUTES);
  });
});

describe('formatMinutes', () => {
  it('formats minutes and hours', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(150)).toBe('2 h 30 min');
  });
});
