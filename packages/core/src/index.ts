/**
 * @ascii/core - Pure TypeScript ASCII art conversion engine
 * 
 * No DOM dependencies - works in Node.js, browsers, workers, etc.
 * 
 * @example
 * ```typescript
 * import { convert, getDefaultGlyphMap } from '@ascii/core';
 * 
 * const frame = convert(imageData, getDefaultGlyphMap(), { cols: 80 });
 * console.log(frameToText(frame));
 * ```
 */

// Main conversion API
export {
  convert,
  convertWithDefaults,
  frameToText,
  frameToAnsi,
  getCellAt,
  iterateCells,
} from './convert.js';

// Types
export type {
  RGB,
  RGBA,
  AsciiCell,
  AsciiFrame,
  GlyphMap,
  ConvertOptions,
  RGBAImage,
  DitheringMode,
  ResizeMode,
  Grid,
  ProcessedCell,
  PackedCells,
} from './types.js';

export { DEFAULT_OPTIONS } from './types.js';

// Glyph presets
export {
  GLYPH_PRESETS,
  STANDARD_RAMP,
  EXTENDED_RAMP,
  BLOCK_RAMP,
  SIMPLE_RAMP,
  DETAILED_RAMP,
  DOTS_RAMP,
  GEOMETRIC_RAMP,
  createGlyphMap,
  createGlyphMapFromPreset,
  getDefaultGlyphMap,
  validateNoDigits,
} from './glyphs.js';

export type { GlyphPresetName } from './glyphs.js';

// Processing utilities (for advanced use)
export { resize, calculateDimensions } from './resize.js';
export {
  rgbToLuminance,
  colorToLuminance,
  colorGridToLuminance,
  srgbToLinear,
  linearToSrgb,
  adjustContrast,
  adjustBrightness,
  normalizeLuminance,
} from './luminance.js';
export { detectEdges, blendEdges, getEdgeDirection } from './edge.js';
export { applyDithering, atkinsonDither } from './dither.js';
export {
  averageColor,
  dominantColor,
  rgbToHsl,
  hslToRgb,
  adjustSaturation,
  quantizeColor,
  rgbToAnsi256,
  ansi256ToRgb,
  packRgb,
  unpackRgb,
  rgbToHex,
  rgbToCss,
} from './color.js';
