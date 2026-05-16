/**
 * Glyph validation tests
 * CRITICAL: Ensure NO DIGITS (0-9) ever appear in glyph sets or output
 */

import { describe, it, expect } from 'vitest';
import {
  GLYPH_PRESETS,
  validateNoDigits,
  createGlyphMap,
  createGlyphMapFromPreset,
  getDefaultGlyphMap,
} from '../packages/core/src/glyphs.js';

describe('Glyph Presets', () => {
  it('should have no digits in any preset', () => {
    const digitRegex = /[0-9]/;
    
    for (const [name, charset] of Object.entries(GLYPH_PRESETS)) {
      const match = charset.match(digitRegex);
      expect(match, `Preset "${name}" contains digit "${match?.[0]}"`).toBeNull();
    }
  });

  it('should have at least 5 characters in each preset', () => {
    for (const [name, charset] of Object.entries(GLYPH_PRESETS)) {
      expect(charset.length, `Preset "${name}" too short`).toBeGreaterThanOrEqual(5);
    }
  });

  it('should start with space in density-ordered presets', () => {
    // Density-ordered presets should start with lightest char (space)
    const densityPresets = ['standard', 'extended', 'simple', 'detailed', 'block', 'dots'];
    
    for (const name of densityPresets) {
      const preset = GLYPH_PRESETS[name as keyof typeof GLYPH_PRESETS];
      expect(preset[0], `Preset "${name}" should start with space`).toBe(' ');
    }
  });
});

describe('validateNoDigits', () => {
  it('should pass for valid charset without digits', () => {
    expect(() => validateNoDigits(' .:+*#@')).not.toThrow();
    expect(() => validateNoDigits('abcdefghijklmnopqrstuvwxyz')).not.toThrow();
    expect(() => validateNoDigits('!@#$%^&*()')).not.toThrow();
  });

  it('should throw for charset with digits', () => {
    expect(() => validateNoDigits('abc123')).toThrow(/Digit "1" found/);
    expect(() => validateNoDigits('0')).toThrow(/Digit "0" found/);
    expect(() => validateNoDigits('test9test')).toThrow(/Digit "9" found/);
  });

  it('should include preset name in error message', () => {
    expect(() => validateNoDigits('abc5', 'custom')).toThrow(/in preset "custom"/);
  });
});

describe('createGlyphMap', () => {
  it('should create valid glyph map from charset', () => {
    const map = createGlyphMap(' .:-=+*#%@');
    expect(map.glyphs).toBe(' .:-=+*#%@');
    expect(map.densities).toBeUndefined();
  });

  it('should reject charset with digits', () => {
    expect(() => createGlyphMap('abc123')).toThrow(/Digit/);
  });
});

describe('createGlyphMapFromPreset', () => {
  it('should create glyph map from preset name', () => {
    const map = createGlyphMapFromPreset('standard');
    expect(map.glyphs).toBe(GLYPH_PRESETS.standard);
  });

  it('should validate preset has no digits', () => {
    // All presets should pass (tested above), but this ensures the validation runs
    for (const name of Object.keys(GLYPH_PRESETS)) {
      expect(() => createGlyphMapFromPreset(name as keyof typeof GLYPH_PRESETS)).not.toThrow();
    }
  });
});

describe('getDefaultGlyphMap', () => {
  it('should return extended preset as default', () => {
    const map = getDefaultGlyphMap();
    expect(map.glyphs).toBe(GLYPH_PRESETS.extended);
  });

  it('should have no digits in default glyph map', () => {
    const map = getDefaultGlyphMap();
    expect(map.glyphs).not.toMatch(/[0-9]/);
  });
});
