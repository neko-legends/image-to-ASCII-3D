/**
 * Color processing utilities for ASCII art
 * Handles color extraction and manipulation
 */

import type { RGB, Grid } from './types.js';

/**
 * Sample average color from a region
 */
export function averageColor(colors: RGB[]): RGB {
  if (colors.length === 0) {
    return { r: 0, g: 0, b: 0 };
  }
  
  let sumR = 0, sumG = 0, sumB = 0;
  
  for (const color of colors) {
    sumR += color.r;
    sumG += color.g;
    sumB += color.b;
  }
  
  const count = colors.length;
  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count),
  };
}

/**
 * Find dominant color using simple clustering
 */
export function dominantColor(colors: RGB[]): RGB {
  if (colors.length === 0) {
    return { r: 0, g: 0, b: 0 };
  }
  
  if (colors.length < 10) {
    return averageColor(colors);
  }
  
  // Simple k-means with k=1 (just median)
  const sorted = [...colors].sort((a, b) => {
    const lumA = a.r * 0.299 + a.g * 0.587 + a.b * 0.114;
    const lumB = b.r * 0.299 + b.g * 0.587 + b.b * 0.114;
    return lumA - lumB;
  });
  
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(color: RGB): { h: number; s: number; l: number } {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  
  if (max === min) {
    return { h: 0, s: 0, l };
  }
  
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }
  
  return { h, s, l };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }
  
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Adjust color saturation
 */
export function adjustSaturation(color: RGB, factor: number): RGB {
  const hsl = rgbToHsl(color);
  hsl.s = Math.max(0, Math.min(1, hsl.s * factor));
  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

/**
 * Quantize colors to reduce palette size
 * Uses simple rounding to nearest step
 */
export function quantizeColor(color: RGB, levels: number): RGB {
  const step = 255 / (levels - 1);
  return {
    r: Math.round(Math.round(color.r / step) * step),
    g: Math.round(Math.round(color.g / step) * step),
    b: Math.round(Math.round(color.b / step) * step),
  };
}

/**
 * Convert color grid to ANSI 256 color indices
 * Useful for terminal output
 */
export function colorGridToAnsi256(colorGrid: Grid<RGB>): Grid<number> {
  return colorGrid.map(row => row.map(rgbToAnsi256));
}

/**
 * Convert RGB to ANSI 256 color index
 */
export function rgbToAnsi256(color: RGB): number {
  const { r, g, b } = color;
  
  // Check for grayscale
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 247 * 24) + 232;
  }
  
  // Color cube (6x6x6)
  const ri = Math.round(r / 255 * 5);
  const gi = Math.round(g / 255 * 5);
  const bi = Math.round(b / 255 * 5);
  
  return 16 + 36 * ri + 6 * gi + bi;
}

/**
 * Convert ANSI 256 color index to RGB
 */
export function ansi256ToRgb(index: number): RGB {
  if (index < 16) {
    // Standard colors - approximate values
    const standard = [
      { r: 0, g: 0, b: 0 },       // 0: Black
      { r: 128, g: 0, b: 0 },     // 1: Red
      { r: 0, g: 128, b: 0 },     // 2: Green
      { r: 128, g: 128, b: 0 },   // 3: Yellow
      { r: 0, g: 0, b: 128 },     // 4: Blue
      { r: 128, g: 0, b: 128 },   // 5: Magenta
      { r: 0, g: 128, b: 128 },   // 6: Cyan
      { r: 192, g: 192, b: 192 }, // 7: White
      { r: 128, g: 128, b: 128 }, // 8: Bright Black
      { r: 255, g: 0, b: 0 },     // 9: Bright Red
      { r: 0, g: 255, b: 0 },     // 10: Bright Green
      { r: 255, g: 255, b: 0 },   // 11: Bright Yellow
      { r: 0, g: 0, b: 255 },     // 12: Bright Blue
      { r: 255, g: 0, b: 255 },   // 13: Bright Magenta
      { r: 0, g: 255, b: 255 },   // 14: Bright Cyan
      { r: 255, g: 255, b: 255 }, // 15: Bright White
    ];
    return standard[index];
  }
  
  if (index >= 232) {
    // Grayscale
    const gray = (index - 232) * 10 + 8;
    return { r: gray, g: gray, b: gray };
  }
  
  // Color cube
  const n = index - 16;
  const r = Math.floor(n / 36);
  const g = Math.floor((n % 36) / 6);
  const b = n % 6;
  
  return {
    r: r > 0 ? r * 40 + 55 : 0,
    g: g > 0 ? g * 40 + 55 : 0,
    b: b > 0 ? b * 40 + 55 : 0,
  };
}

/**
 * Pack RGB into a single 32-bit integer
 */
export function packRgb(color: RGB): number {
  return (color.r << 16) | (color.g << 8) | color.b;
}

/**
 * Unpack RGB from a 32-bit integer
 */
export function unpackRgb(packed: number): RGB {
  return {
    r: (packed >> 16) & 0xff,
    g: (packed >> 8) & 0xff,
    b: packed & 0xff,
  };
}

/**
 * Convert RGB to CSS hex string
 */
export function rgbToHex(color: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/**
 * Convert RGB to CSS rgb() string
 */
export function rgbToCss(color: RGB): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}
