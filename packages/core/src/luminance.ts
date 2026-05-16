/**
 * Luminance calculation with proper gamma correction
 * Converts RGB to perceptual luminance values
 */

import type { RGB, Grid } from './types.js';

/**
 * Convert sRGB component to linear
 * Applies inverse gamma correction
 */
export function srgbToLinear(c: number): number {
  const normalized = c / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Convert linear component back to sRGB
 */
export function linearToSrgb(c: number): number {
  const value = c <= 0.0031308
    ? c * 12.92
    : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(value * 255);
}

/**
 * Calculate perceptual luminance from RGB
 * Uses Rec. 709 coefficients with proper gamma handling
 * @returns Luminance value 0-1
 */
export function rgbToLuminance(r: number, g: number, b: number): number {
  // Convert to linear space
  const linearR = srgbToLinear(r);
  const linearG = srgbToLinear(g);
  const linearB = srgbToLinear(b);
  
  // Rec. 709 luminance coefficients
  return 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB;
}

/**
 * Calculate luminance for an RGB color object
 */
export function colorToLuminance(color: RGB): number {
  return rgbToLuminance(color.r, color.g, color.b);
}

/**
 * Convert a grid of RGB colors to luminance values
 */
export function colorGridToLuminance(colorGrid: Grid<RGB>): Grid<number> {
  return colorGrid.map(row => 
    row.map(color => colorToLuminance(color))
  );
}

/**
 * Apply contrast adjustment to luminance grid
 * @param contrast Contrast multiplier (1.0 = no change)
 */
export function adjustContrast(
  luminanceGrid: Grid<number>,
  contrast: number
): Grid<number> {
  return luminanceGrid.map(row =>
    row.map(lum => {
      // Adjust around midpoint
      const adjusted = (lum - 0.5) * contrast + 0.5;
      return Math.max(0, Math.min(1, adjusted));
    })
  );
}

/**
 * Apply brightness adjustment to luminance grid
 * @param brightness Brightness offset (-1 to 1)
 */
export function adjustBrightness(
  luminanceGrid: Grid<number>,
  brightness: number
): Grid<number> {
  return luminanceGrid.map(row =>
    row.map(lum => Math.max(0, Math.min(1, lum + brightness)))
  );
}

/**
 * Normalize luminance values to full 0-1 range
 * Useful when source image doesn't use full dynamic range
 */
export function normalizeLuminance(luminanceGrid: Grid<number>): Grid<number> {
  let min = 1, max = 0;
  
  // Find range
  for (const row of luminanceGrid) {
    for (const lum of row) {
      min = Math.min(min, lum);
      max = Math.max(max, lum);
    }
  }
  
  const range = max - min;
  if (range < 0.001) {
    // Nearly constant - return as-is
    return luminanceGrid;
  }
  
  // Stretch to 0-1
  return luminanceGrid.map(row =>
    row.map(lum => (lum - min) / range)
  );
}
