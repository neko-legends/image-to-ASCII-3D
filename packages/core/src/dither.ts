/**
 * Dithering algorithms for ASCII art
 * Improves detail preservation through error diffusion
 */

import type { Grid, DitheringMode } from './types.js';

/**
 * Apply dithering to luminance grid
 * @param luminanceGrid Input luminance values (0-1)
 * @param levels Number of quantization levels (typically glyph count)
 * @param mode Dithering algorithm
 */
export function applyDithering(
  luminanceGrid: Grid<number>,
  levels: number,
  mode: DitheringMode
): Grid<number> {
  switch (mode) {
    case 'floyd-steinberg':
      return floydSteinberg(luminanceGrid, levels);
    case 'ordered':
      return orderedDither(luminanceGrid, levels);
    case 'none':
    default:
      return luminanceGrid;
  }
}

/**
 * Floyd-Steinberg error diffusion dithering
 * Best quality for most images
 */
function floydSteinberg(luminanceGrid: Grid<number>, levels: number): Grid<number> {
  const rows = luminanceGrid.length;
  const cols = luminanceGrid[0]?.length ?? 0;
  
  // Clone the grid (we'll modify in place)
  const result: Grid<number> = luminanceGrid.map(row => [...row]);
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const oldValue = result[y][x];
      const newValue = quantize(oldValue, levels);
      const error = oldValue - newValue;
      
      result[y][x] = newValue;
      
      // Distribute error to neighbors
      // Right: 7/16
      if (x + 1 < cols) {
        result[y][x + 1] += error * (7 / 16);
      }
      
      if (y + 1 < rows) {
        // Bottom-left: 3/16
        if (x > 0) {
          result[y + 1][x - 1] += error * (3 / 16);
        }
        // Bottom: 5/16
        result[y + 1][x] += error * (5 / 16);
        // Bottom-right: 1/16
        if (x + 1 < cols) {
          result[y + 1][x + 1] += error * (1 / 16);
        }
      }
    }
  }
  
  // Clamp values to valid range
  return result.map(row => 
    row.map(val => Math.max(0, Math.min(1, val)))
  );
}

/**
 * Ordered (Bayer) dithering
 * Creates a patterned effect, good for retro aesthetic
 */
function orderedDither(luminanceGrid: Grid<number>, levels: number): Grid<number> {
  // 4x4 Bayer matrix
  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const bayerSize = 4;
  const bayerScale = 16; // Maximum value in 4x4 Bayer + 1
  
  return luminanceGrid.map((row, y) =>
    row.map((lum, x) => {
      const threshold = (bayer[y % bayerSize][x % bayerSize] + 0.5) / bayerScale;
      const adjusted = lum + (threshold - 0.5) / levels;
      return quantize(Math.max(0, Math.min(1, adjusted)), levels);
    })
  );
}

/**
 * Quantize a value to one of N levels
 */
function quantize(value: number, levels: number): number {
  if (levels <= 1) return value;
  
  const step = 1 / (levels - 1);
  return Math.round(value / step) * step;
}

/**
 * Atkinson dithering (used in classic Mac)
 * Lighter effect than Floyd-Steinberg
 */
export function atkinsonDither(luminanceGrid: Grid<number>, levels: number): Grid<number> {
  const rows = luminanceGrid.length;
  const cols = luminanceGrid[0]?.length ?? 0;
  
  const result: Grid<number> = luminanceGrid.map(row => [...row]);
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const oldValue = result[y][x];
      const newValue = quantize(oldValue, levels);
      const error = (oldValue - newValue) / 8; // Atkinson divides by 8
      
      result[y][x] = newValue;
      
      // Distribute 6/8 of error (some is "lost")
      if (x + 1 < cols) result[y][x + 1] += error;
      if (x + 2 < cols) result[y][x + 2] += error;
      
      if (y + 1 < rows) {
        if (x > 0) result[y + 1][x - 1] += error;
        result[y + 1][x] += error;
        if (x + 1 < cols) result[y + 1][x + 1] += error;
      }
      
      if (y + 2 < rows) {
        result[y + 2][x] += error;
      }
    }
  }
  
  return result.map(row => 
    row.map(val => Math.max(0, Math.min(1, val)))
  );
}
