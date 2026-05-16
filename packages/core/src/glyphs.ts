/**
 * Glyph presets for ASCII art conversion
 * 
 * CRITICAL: NO DIGITS (0-9) allowed in any glyph set!
 * This is a hard requirement - only letters and symbols.
 */

import type { GlyphMap } from './types.js';

/**
 * Validate that a charset contains no digits
 * @throws Error if digits are found
 */
export function validateNoDigits(charset: string, presetName?: string): void {
  const digitMatch = charset.match(/[0-9]/);
  if (digitMatch) {
    const name = presetName ? ` in preset "${presetName}"` : '';
    throw new Error(
      `Digit "${digitMatch[0]}" found${name}. Digits are not allowed in glyph sets.`
    );
  }
}

/**
 * Standard ASCII density ramp - lightest to darkest
 * Classic 10-level ramp using only punctuation and symbols
 */
export const STANDARD_RAMP = ' .:-=+*#%@';

/**
 * Extended ASCII density ramp - more granularity
 * 16 levels, letters + symbols, NO DIGITS
 */
export const EXTENDED_RAMP = " .'`^\",:;Il!i><~+_-?][}{)(|/tfjrxnuvczXYUJCLQOZmwqpdbkhao*#MW&B@$";

/**
 * Block characters - Unicode block elements for smoother gradients
 */
export const BLOCK_RAMP = ' ░▒▓█';

/**
 * Simple ramp - minimal character set
 */
export const SIMPLE_RAMP = ' .:+*#@';

/**
 * Detailed ramp - maximum granularity with letters
 * Carefully ordered by typical monospace font density
 */
export const DETAILED_RAMP = 
  " `.-':_,^=;><+!rc*/z?sLTv)J(|Fi{C}fI[tln]u\\vxjkEZwPGAUKXYbpqd#WMQO&%B@$";

/**
 * Dots only - minimalist aesthetic
 */
export const DOTS_RAMP = ' .··•●';

/**
 * Lines and angles - geometric aesthetic
 */
export const GEOMETRIC_RAMP = ' -=≡+×÷*#';

/**
 * Preset glyph maps
 */
export const GLYPH_PRESETS = {
  standard: STANDARD_RAMP,
  extended: EXTENDED_RAMP,
  block: BLOCK_RAMP,
  simple: SIMPLE_RAMP,
  detailed: DETAILED_RAMP,
  dots: DOTS_RAMP,
  geometric: GEOMETRIC_RAMP,
} as const;

export type GlyphPresetName = keyof typeof GLYPH_PRESETS;

/**
 * Create a GlyphMap from a preset name
 */
export function createGlyphMapFromPreset(preset: GlyphPresetName): GlyphMap {
  const glyphs = GLYPH_PRESETS[preset];
  validateNoDigits(glyphs, preset);
  return { glyphs };
}

/**
 * Create a GlyphMap from a custom charset
 * @throws Error if charset contains digits
 */
export function createGlyphMap(glyphs: string): GlyphMap {
  validateNoDigits(glyphs);
  return { glyphs };
}

/**
 * Get default glyph map (extended ramp)
 */
export function getDefaultGlyphMap(): GlyphMap {
  return createGlyphMapFromPreset('extended');
}

// Validate all presets at module load time (development safety)
if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
  for (const [name, charset] of Object.entries(GLYPH_PRESETS)) {
    validateNoDigits(charset, name);
  }
}
