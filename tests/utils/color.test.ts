import { describe, it, expect } from 'vitest';
import {
  isHex,
  normalizeHex,
  hexToRgb,
  rgbToHex,
  rgbToHsv,
  hsvToRgb,
  hexToHsv,
  hsvToHex,
  contrastInk
} from '../../src/lib/utils/color';

describe('isHex', () => {
  it('accepts 3- and 6-digit hex with leading #', () => {
    expect(isHex('#fff')).toBe(true);
    expect(isHex('#0DA882')).toBe(true);
    expect(isHex(' #abc ')).toBe(true);
  });
  it('rejects malformed input', () => {
    expect(isHex('fff')).toBe(false);
    expect(isHex('#gggggg')).toBe(false);
    expect(isHex('#12345')).toBe(false);
  });
});

describe('normalizeHex', () => {
  it('expands shorthand and lowercases', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('0DA882')).toBe('#0da882');
  });
  it('returns null for invalid input', () => {
    expect(normalizeHex('nope')).toBeNull();
    expect(normalizeHex('#12')).toBeNull();
  });
});

describe('rgb <-> hex', () => {
  it('round-trips', () => {
    expect(hexToRgb('#0da882')).toEqual({ r: 13, g: 168, b: 130 });
    expect(rgbToHex({ r: 13, g: 168, b: 130 })).toBe('#0da882');
  });
  it('clamps out-of-range channels', () => {
    expect(rgbToHex({ r: 300, g: -5, b: 128 })).toBe('#ff0080');
  });
});

describe('hsv conversions', () => {
  it('handles primary colors', () => {
    expect(hsvToHex({ h: 0, s: 100, v: 100 })).toBe('#ff0000');
    expect(hsvToHex({ h: 120, s: 100, v: 100 })).toBe('#00ff00');
    expect(hsvToHex({ h: 240, s: 100, v: 100 })).toBe('#0000ff');
  });
  it('reports zero saturation for greys', () => {
    expect(rgbToHsv({ r: 128, g: 128, b: 128 }).s).toBe(0);
  });
  it('round-trips a brand color within rounding tolerance', () => {
    const hsv = hexToHsv('#0da882');
    const rgb = hsvToRgb(hsv);
    expect(rgb.r).toBeCloseTo(13, 0);
    expect(rgb.g).toBeCloseTo(168, 0);
    expect(rgb.b).toBeCloseTo(130, 0);
  });
});

describe('contrastInk', () => {
  it('picks dark ink on light backgrounds and white on dark', () => {
    expect(contrastInk('#ffffff')).toBe('#000000');
    expect(contrastInk('#1a1d21')).toBe('#ffffff');
  });
});
