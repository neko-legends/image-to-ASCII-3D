/**
 * Core types for ASCII art generator
 * Pure TypeScript - no DOM dependencies
 */

/** RGB color value */
export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

/** RGBA color value */
export interface RGBA extends RGB {
  a: number; // 0-255
}

/** Single cell in the ASCII frame */
export interface AsciiCell {
  /** The character to display */
  glyph: string;
  /** Foreground color */
  fg: RGB;
  /** Background color (optional) */
  bg?: RGB;
}

/**
 * Packed representation for performance
 * Each cell uses 2x Uint32: [glyphIndex << 24 | fgPacked, bgPacked]
 */
export interface PackedCells {
  data: Uint32Array;
  glyphLookup: string[];
}

/** The main output structure - represents converted ASCII art */
export interface AsciiFrame {
  /** Number of character columns */
  cols: number;
  /** Number of character rows */
  rows: number;
  /** Cell data - array of cells or packed format */
  cells: AsciiCell[] | PackedCells;
  /** The charset used for this conversion */
  charset: string;
  /** Conversion metadata */
  meta?: {
    sourceWidth: number;
    sourceHeight: number;
    options: ConvertOptions;
  };
}

/** Glyph map passed from web app - contains density-sorted glyphs */
export interface GlyphMap {
  /** Glyphs sorted by density (lightest -> darkest) */
  glyphs: string;
  /** Optional density values for each glyph (0.0 - 1.0) */
  densities?: number[];
  /** Font info used for calibration (cache key) */
  calibration?: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
  };
}

/** Dithering algorithm options */
export type DitheringMode = 'none' | 'floyd-steinberg' | 'ordered';

/** Resize interpolation mode */
export type ResizeMode = 'box-average' | 'nearest';

/** Conversion options */
export interface ConvertOptions {
  /** Number of columns (character width) */
  cols: number;
  /** Number of rows (character height) - computed from aspect if not provided */
  rows?: number;
  /** Invert luminance mapping (light glyphs on dark areas) */
  invert?: boolean;
  /** Enable edge detection enhancement */
  edgeDetection?: boolean;
  /** Edge strength multiplier (0-1, default 0.3) */
  edgeStrength?: number;
  /** Dithering mode */
  dithering?: DitheringMode;
  /** Resize interpolation */
  resizeMode?: ResizeMode;
  /** Include color information in output */
  colorMode?: 'none' | 'foreground' | 'full';
  /** Preserve source aspect ratio */
  preserveAspectRatio?: boolean;
  /** Character cell aspect ratio (width/height, typically ~0.5 for monospace) */
  cellAspectRatio?: number;
}

/** Raw RGBA image data input */
export interface RGBAImage {
  /** Raw pixel data (RGBA, 4 bytes per pixel) */
  data: Uint8ClampedArray;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
}

/** Default conversion options */
export const DEFAULT_OPTIONS: Required<ConvertOptions> = {
  cols: 80,
  rows: 24,
  invert: false,
  edgeDetection: false,
  edgeStrength: 0.3,
  dithering: 'none',
  resizeMode: 'box-average',
  colorMode: 'foreground',
  preserveAspectRatio: true,
  cellAspectRatio: 0.5,
};

/** Utility type for 2D grid data */
export type Grid<T> = T[][];

/** Internal cell data during processing */
export interface ProcessedCell {
  /** Average RGB color */
  color: RGB;
  /** Computed luminance (0-1) */
  luminance: number;
  /** Edge magnitude (0-1, if edge detection enabled) */
  edge?: number;
}
