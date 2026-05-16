/**
 * Edge detection using Sobel operator
 * Enhances edges in the luminance data for better ASCII art
 */

import type { Grid } from './types.js';

// Sobel kernels for edge detection
const SOBEL_X = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];

const SOBEL_Y = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
];

/**
 * Apply Sobel edge detection to luminance grid
 * @returns Grid of edge magnitudes (0-1)
 */
export function detectEdges(luminanceGrid: Grid<number>): Grid<number> {
  const rows = luminanceGrid.length;
  const cols = luminanceGrid[0]?.length ?? 0;
  
  if (rows < 3 || cols < 3) {
    // Too small for edge detection
    return luminanceGrid.map(row => row.map(() => 0));
  }
  
  const edges: Grid<number> = [];
  
  for (let y = 0; y < rows; y++) {
    const row: number[] = [];
    
    for (let x = 0; x < cols; x++) {
      // Border pixels get 0 edge
      if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1) {
        row.push(0);
        continue;
      }
      
      let gx = 0, gy = 0;
      
      // Convolve with Sobel kernels
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const lum = luminanceGrid[y + ky][x + kx];
          gx += lum * SOBEL_X[ky + 1][kx + 1];
          gy += lum * SOBEL_Y[ky + 1][kx + 1];
        }
      }
      
      // Edge magnitude
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      row.push(magnitude);
    }
    
    edges.push(row);
  }
  
  return normalizeEdges(edges);
}

/**
 * Normalize edge values to 0-1 range
 */
function normalizeEdges(edges: Grid<number>): Grid<number> {
  let max = 0;
  
  for (const row of edges) {
    for (const val of row) {
      max = Math.max(max, val);
    }
  }
  
  if (max < 0.001) {
    return edges;
  }
  
  return edges.map(row => row.map(val => val / max));
}

/**
 * Blend edge data into luminance
 * @param luminanceGrid Original luminance values
 * @param edgeGrid Edge magnitudes
 * @param strength Blend strength (0-1)
 */
export function blendEdges(
  luminanceGrid: Grid<number>,
  edgeGrid: Grid<number>,
  strength: number
): Grid<number> {
  const rows = luminanceGrid.length;
  const cols = luminanceGrid[0]?.length ?? 0;
  
  const result: Grid<number> = [];
  
  for (let y = 0; y < rows; y++) {
    const row: number[] = [];
    
    for (let x = 0; x < cols; x++) {
      const lum = luminanceGrid[y][x];
      const edge = edgeGrid[y]?.[x] ?? 0;
      
      // Edges make the area darker (more "ink")
      const blended = lum - edge * strength;
      row.push(Math.max(0, Math.min(1, blended)));
    }
    
    result.push(row);
  }
  
  return result;
}

/**
 * Get edge direction at a point (for directional characters)
 * @returns Angle in radians
 */
export function getEdgeDirection(
  luminanceGrid: Grid<number>,
  x: number,
  y: number
): number {
  const rows = luminanceGrid.length;
  const cols = luminanceGrid[0]?.length ?? 0;
  
  if (y <= 0 || y >= rows - 1 || x <= 0 || x >= cols - 1) {
    return 0;
  }
  
  let gx = 0, gy = 0;
  
  for (let ky = -1; ky <= 1; ky++) {
    for (let kx = -1; kx <= 1; kx++) {
      const lum = luminanceGrid[y + ky][x + kx];
      gx += lum * SOBEL_X[ky + 1][kx + 1];
      gy += lum * SOBEL_Y[ky + 1][kx + 1];
    }
  }
  
  return Math.atan2(gy, gx);
}
