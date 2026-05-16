/**
 * Image processing module tests
 */

import { describe, it, expect } from 'vitest';
import { resize, calculateDimensions } from '../packages/core/src/resize.js';
import {
  rgbToLuminance,
  srgbToLinear,
  linearToSrgb,
  normalizeLuminance,
} from '../packages/core/src/luminance.js';
import { detectEdges, blendEdges } from '../packages/core/src/edge.js';
import { applyDithering } from '../packages/core/src/dither.js';
import {
  rgbToHsl,
  hslToRgb,
  rgbToHex,
  packRgb,
  unpackRgb,
} from '../packages/core/src/color.js';
import type { RGBAImage, Grid } from '../packages/core/src/types.js';

describe('resize', () => {
  it('should resize image to target grid size', () => {
    const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
    const image: RGBAImage = { data, width: 100, height: 100 };
    
    const grid = resize(image, 10, 10);
    
    expect(grid.length).toBe(10); // rows
    expect(grid[0].length).toBe(10); // cols
  });

  it('should use box average by default', () => {
    // Create image with known pattern
    const data = new Uint8ClampedArray(4 * 4 * 4);
    // Top-left quadrant white, rest black
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const idx = (y * 4 + x) * 4;
        const isTopLeft = x < 2 && y < 2;
        const value = isTopLeft ? 255 : 0;
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
        data[idx + 3] = 255;
      }
    }
    const image: RGBAImage = { data, width: 4, height: 4 };
    
    const grid = resize(image, 2, 2);
    
    // Top-left cell should be white (255), others black (0)
    expect(grid[0][0].r).toBe(255);
    expect(grid[0][1].r).toBe(0);
    expect(grid[1][0].r).toBe(0);
    expect(grid[1][1].r).toBe(0);
  });

  it('should support nearest neighbor mode', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    // Fill with RGBA (128, 128, 128, 255)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;     // R
      data[i + 1] = 128; // G
      data[i + 2] = 128; // B
      data[i + 3] = 255; // A (full opacity)
    }
    const image: RGBAImage = { data, width: 4, height: 4 };
    
    const grid = resize(image, 2, 2, 'nearest');
    
    expect(grid.length).toBe(2);
    expect(grid[0][0].r).toBe(128);
  });
});

describe('calculateDimensions', () => {
  it('should calculate rows from cols and aspect ratio', () => {
    const dims = calculateDimensions(200, 100, 80); // 2:1 source
    
    expect(dims.cols).toBe(80);
    expect(dims.rows).toBeGreaterThan(0);
  });

  it('should respect explicit rows', () => {
    const dims = calculateDimensions(200, 100, 80, 24);
    
    expect(dims.cols).toBe(80);
    expect(dims.rows).toBe(24);
  });

  it('should account for cell aspect ratio', () => {
    const dims1 = calculateDimensions(100, 100, 50, undefined, 0.5);
    const dims2 = calculateDimensions(100, 100, 50, undefined, 1.0);
    
    // With cellAspect 0.5, we need more rows to maintain aspect
    expect(dims1.rows).toBeGreaterThan(dims2.rows);
  });
});

describe('luminance', () => {
  it('should convert pure white to 1', () => {
    expect(rgbToLuminance(255, 255, 255)).toBeCloseTo(1, 2);
  });

  it('should convert pure black to 0', () => {
    expect(rgbToLuminance(0, 0, 0)).toBe(0);
  });

  it('should weight green more than red and blue', () => {
    const greenLum = rgbToLuminance(0, 128, 0);
    const redLum = rgbToLuminance(128, 0, 0);
    const blueLum = rgbToLuminance(0, 0, 128);
    
    expect(greenLum).toBeGreaterThan(redLum);
    expect(greenLum).toBeGreaterThan(blueLum);
  });

  it('should be reversible with srgb conversion', () => {
    for (const value of [0, 64, 128, 192, 255]) {
      const linear = srgbToLinear(value);
      const back = linearToSrgb(linear);
      expect(back).toBeCloseTo(value, 0);
    }
  });
});

describe('normalizeLuminance', () => {
  it('should stretch values to 0-1 range', () => {
    const grid: Grid<number> = [
      [0.2, 0.4],
      [0.6, 0.8],
    ];
    
    const normalized = normalizeLuminance(grid);
    
    expect(normalized[0][0]).toBeCloseTo(0, 2); // Min becomes 0
    expect(normalized[1][1]).toBeCloseTo(1, 2); // Max becomes 1
  });

  it('should handle constant values', () => {
    const grid: Grid<number> = [
      [0.5, 0.5],
      [0.5, 0.5],
    ];
    
    const normalized = normalizeLuminance(grid);
    
    // Should return as-is when range is tiny
    expect(normalized[0][0]).toBeCloseTo(0.5, 2);
  });
});

describe('edge detection', () => {
  it('should detect edges in gradient', () => {
    // Create horizontal gradient
    const grid: Grid<number> = [
      [0, 0.5, 1],
      [0, 0.5, 1],
      [0, 0.5, 1],
    ];
    
    const edges = detectEdges(grid);
    
    // Center should have edge detected
    expect(edges[1][1]).toBeGreaterThan(0);
  });

  it('should have zero edges on uniform surface', () => {
    const grid: Grid<number> = [
      [0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
    ];
    
    const edges = detectEdges(grid);
    
    // Should be all zeros (or very close)
    expect(edges[1][1]).toBeCloseTo(0, 5);
  });
});

describe('blendEdges', () => {
  it('should darken areas with edges', () => {
    const luminance: Grid<number> = [[0.5]];
    const edges: Grid<number> = [[0.5]];
    
    const blended = blendEdges(luminance, edges, 0.5);
    
    expect(blended[0][0]).toBeLessThan(0.5);
  });

  it('should respect strength parameter', () => {
    const luminance: Grid<number> = [[0.5]];
    const edges: Grid<number> = [[1]];
    
    const weak = blendEdges(luminance, edges, 0.1);
    const strong = blendEdges(luminance, edges, 0.9);
    
    expect(weak[0][0]).toBeGreaterThan(strong[0][0]);
  });
});

describe('dithering', () => {
  it('should not modify with mode none', () => {
    const grid: Grid<number> = [[0.5, 0.5], [0.5, 0.5]];
    
    const result = applyDithering(grid, 4, 'none');
    
    expect(result[0][0]).toBe(0.5);
  });

  it('should apply floyd-steinberg dithering', () => {
    const grid: Grid<number> = [[0.5, 0.5], [0.5, 0.5]];
    
    const result = applyDithering(grid, 2, 'floyd-steinberg');
    
    // Values should be quantized to 0 or 1
    for (const row of result) {
      for (const val of row) {
        expect(val === 0 || val === 1).toBe(true);
      }
    }
  });

  it('should apply ordered dithering', () => {
    const grid: Grid<number> = [[0.5, 0.5], [0.5, 0.5]];
    
    const result = applyDithering(grid, 2, 'ordered');
    
    // Values should be quantized
    for (const row of result) {
      for (const val of row) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('color utilities', () => {
  it('should convert RGB to HSL and back', () => {
    const original = { r: 200, g: 100, b: 50 };
    const hsl = rgbToHsl(original);
    const back = hslToRgb(hsl.h, hsl.s, hsl.l);
    
    expect(back.r).toBeCloseTo(original.r, 0);
    expect(back.g).toBeCloseTo(original.g, 0);
    expect(back.b).toBeCloseTo(original.b, 0);
  });

  it('should format RGB as hex', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 128 })).toBe('#ff0080');
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
  });

  it('should pack and unpack RGB correctly', () => {
    const original = { r: 200, g: 100, b: 50 };
    const packed = packRgb(original);
    const unpacked = unpackRgb(packed);
    
    expect(unpacked).toEqual(original);
  });
});
