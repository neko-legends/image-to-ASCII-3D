/**
 * Image resizing for ASCII conversion
 * Downscales source image to target grid size
 */

import type { RGBAImage, RGB, ResizeMode, Grid } from './types.js';

/**
 * Resize an RGBA image to a grid of RGB cells
 * @param image Source image data
 * @param cols Target number of columns
 * @param rows Target number of rows
 * @param mode Interpolation mode
 */
export function resize(
  image: RGBAImage,
  cols: number,
  rows: number,
  mode: ResizeMode = 'box-average'
): Grid<RGB> {
  if (mode === 'nearest') {
    return resizeNearest(image, cols, rows);
  }
  return resizeBoxAverage(image, cols, rows);
}

/**
 * Box average resize - averages all pixels in each cell region
 * Best quality for downscaling
 */
function resizeBoxAverage(image: RGBAImage, cols: number, rows: number): Grid<RGB> {
  const { data, width, height } = image;
  const result: Grid<RGB> = [];

  for (let cy = 0; cy < rows; cy++) {
    const row: RGB[] = [];
    
    for (let cx = 0; cx < cols; cx++) {
      // Calculate source region for this cell
      const x0 = Math.floor((cx * width) / cols);
      const x1 = Math.floor(((cx + 1) * width) / cols);
      const y0 = Math.floor((cy * height) / rows);
      const y1 = Math.floor(((cy + 1) * height) / rows);

      // Average all pixels in region
      let sumR = 0, sumG = 0, sumB = 0;
      let count = 0;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 4;
          const alpha = data[idx + 3] / 255;
          
          // Premultiply alpha for proper blending
          sumR += data[idx] * alpha;
          sumG += data[idx + 1] * alpha;
          sumB += data[idx + 2] * alpha;
          count++;
        }
      }

      if (count > 0) {
        row.push({
          r: Math.round(sumR / count),
          g: Math.round(sumG / count),
          b: Math.round(sumB / count),
        });
      } else {
        row.push({ r: 0, g: 0, b: 0 });
      }
    }
    
    result.push(row);
  }

  return result;
}

/**
 * Nearest neighbor resize - picks center pixel of each cell
 * Fast but pixelated - good for retro aesthetic
 */
function resizeNearest(image: RGBAImage, cols: number, rows: number): Grid<RGB> {
  const { data, width, height } = image;
  const result: Grid<RGB> = [];

  for (let cy = 0; cy < rows; cy++) {
    const row: RGB[] = [];
    
    for (let cx = 0; cx < cols; cx++) {
      // Pick center pixel of this cell
      const x = Math.floor((cx + 0.5) * width / cols);
      const y = Math.floor((cy + 0.5) * height / rows);
      
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3] / 255;
      
      row.push({
        r: Math.round(data[idx] * alpha),
        g: Math.round(data[idx + 1] * alpha),
        b: Math.round(data[idx + 2] * alpha),
      });
    }
    
    result.push(row);
  }

  return result;
}

/**
 * Calculate target dimensions preserving aspect ratio
 */
export function calculateDimensions(
  sourceWidth: number,
  sourceHeight: number,
  targetCols: number,
  targetRows?: number,
  cellAspectRatio: number = 0.5
): { cols: number; rows: number } {
  const sourceAspect = sourceWidth / sourceHeight;
  
  if (targetRows !== undefined) {
    return { cols: targetCols, rows: targetRows };
  }
  
  // Calculate rows to preserve source aspect ratio
  // Account for cell aspect ratio (chars are typically taller than wide)
  const rows = Math.round(targetCols / sourceAspect / cellAspectRatio);
  
  return { cols: targetCols, rows: Math.max(1, rows) };
}
