/**
 * Main ASCII conversion pipeline
 * Orchestrates all processing steps to convert images to ASCII art
 */

import type {
  RGBAImage,
  AsciiFrame,
  AsciiCell,
  GlyphMap,
  ConvertOptions,
  RGB,
  Grid,
} from './types.js';
import { DEFAULT_OPTIONS } from './types.js';
import { resize, calculateDimensions } from './resize.js';
import { colorGridToLuminance, normalizeLuminance } from './luminance.js';
import { detectEdges, blendEdges } from './edge.js';
import { applyDithering } from './dither.js';
import { getDefaultGlyphMap, validateNoDigits } from './glyphs.js';

/**
 * Convert RGBA image data to ASCII art
 * Main entry point for the core library
 */
export function convert(
  image: RGBAImage,
  glyphMap: GlyphMap,
  options: Partial<ConvertOptions> = {}
): AsciiFrame {
  // Merge with defaults
  const opts: Required<ConvertOptions> = { ...DEFAULT_OPTIONS, ...options };
  
  // Validate glyph map
  validateNoDigits(glyphMap.glyphs);
  
  // Calculate dimensions
  const { cols, rows } = opts.preserveAspectRatio
    ? calculateDimensions(
        image.width,
        image.height,
        opts.cols,
        opts.rows,
        opts.cellAspectRatio
      )
    : { cols: opts.cols, rows: opts.rows };
  
  // Step 1: Resize image to grid
  const colorGrid = resize(image, cols, rows, opts.resizeMode);
  
  // Step 2: Calculate luminance
  let luminanceGrid = colorGridToLuminance(colorGrid);
  
  // Normalize for better contrast
  luminanceGrid = normalizeLuminance(luminanceGrid);
  
  // Step 3: Edge detection (optional)
  if (opts.edgeDetection) {
    const edgeGrid = detectEdges(luminanceGrid);
    luminanceGrid = blendEdges(luminanceGrid, edgeGrid, opts.edgeStrength);
  }
  
  // Step 4: Dithering (optional)
  if (opts.dithering !== 'none') {
    luminanceGrid = applyDithering(
      luminanceGrid,
      glyphMap.glyphs.length,
      opts.dithering
    );
  }
  
  // Step 5: Map to glyphs and build output
  const cells = buildCells(
    luminanceGrid,
    colorGrid,
    glyphMap,
    opts.invert,
    opts.colorMode
  );
  
  return {
    cols,
    rows,
    cells,
    charset: glyphMap.glyphs,
    meta: {
      sourceWidth: image.width,
      sourceHeight: image.height,
      options: opts,
    },
  };
}

/**
 * Convert with default glyph map
 * Convenience function for quick conversion
 */
export function convertWithDefaults(
  image: RGBAImage,
  options: Partial<ConvertOptions> = {}
): AsciiFrame {
  return convert(image, getDefaultGlyphMap(), options);
}

/**
 * Build ASCII cells from processed data
 */
function buildCells(
  luminanceGrid: Grid<number>,
  colorGrid: Grid<RGB>,
  glyphMap: GlyphMap,
  invert: boolean,
  colorMode: 'none' | 'foreground' | 'full'
): AsciiCell[] {
  const rows = luminanceGrid.length;
  const cols = luminanceGrid[0]?.length ?? 0;
  const cells: AsciiCell[] = [];
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const luminance = luminanceGrid[y][x];
      const color = colorGrid[y][x];
      
      const glyph = mapToGlyph(luminance, glyphMap, invert);
      
      const cell: AsciiCell = {
        glyph,
        fg: colorMode !== 'none' ? color : { r: 255, g: 255, b: 255 },
      };
      
      cells.push(cell);
    }
  }
  
  return cells;
}

/**
 * Map luminance value to glyph
 */
function mapToGlyph(luminance: number, glyphMap: GlyphMap, invert: boolean): string {
  const glyphs = glyphMap.glyphs;
  const len = glyphs.length;
  
  if (len === 0) {
    return ' ';
  }
  
  // Clamp luminance
  const lum = Math.max(0, Math.min(1, luminance));
  
  // Map to index
  let index = Math.floor(lum * (len - 1));
  
  if (invert) {
    index = len - 1 - index;
  }
  
  return glyphs[Math.max(0, Math.min(index, len - 1))];
}

/**
 * Convert ASCII frame to plain text (no color)
 */
export function frameToText(frame: AsciiFrame): string {
  const lines: string[] = [];
  const cells = frame.cells as AsciiCell[];
  
  for (let y = 0; y < frame.rows; y++) {
    let line = '';
    for (let x = 0; x < frame.cols; x++) {
      const idx = y * frame.cols + x;
      line += cells[idx]?.glyph ?? ' ';
    }
    lines.push(line);
  }
  
  return lines.join('\n');
}

/**
 * Convert ASCII frame to ANSI colored text (for terminal)
 */
export function frameToAnsi(frame: AsciiFrame): string {
  const lines: string[] = [];
  const cells = frame.cells as AsciiCell[];
  
  for (let y = 0; y < frame.rows; y++) {
    let line = '';
    for (let x = 0; x < frame.cols; x++) {
      const idx = y * frame.cols + x;
      const cell = cells[idx];
      
      if (cell) {
        // ANSI truecolor escape sequence
        const { r, g, b } = cell.fg;
        line += `\x1b[38;2;${r};${g};${b}m${cell.glyph}\x1b[0m`;
      } else {
        line += ' ';
      }
    }
    lines.push(line);
  }
  
  return lines.join('\n');
}

/**
 * Get cell at position
 */
export function getCellAt(frame: AsciiFrame, x: number, y: number): AsciiCell | undefined {
  if (x < 0 || x >= frame.cols || y < 0 || y >= frame.rows) {
    return undefined;
  }
  
  const cells = frame.cells as AsciiCell[];
  return cells[y * frame.cols + x];
}

/**
 * Iterate over all cells with position
 */
export function* iterateCells(
  frame: AsciiFrame
): Generator<{ cell: AsciiCell; x: number; y: number }> {
  const cells = frame.cells as AsciiCell[];
  
  for (let y = 0; y < frame.rows; y++) {
    for (let x = 0; x < frame.cols; x++) {
      const idx = y * frame.cols + x;
      const cell = cells[idx];
      if (cell) {
        yield { cell, x, y };
      }
    }
  }
}
