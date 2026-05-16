/**
 * Glyph density calibration
 * Measures actual ink coverage of glyphs in the browser
 */

import type { GlyphMap } from '@ascii/core';

interface CalibrationResult {
  char: string;
  density: number;
}

/**
 * Measure glyph densities for a charset in the browser
 * @param charset Characters to measure
 * @param fontFamily Font family to use
 * @param fontSize Font size for measurement
 */
export async function calibrateGlyphs(
  charset: string,
  fontFamily: string = 'JetBrains Mono',
  fontSize: number = 32
): Promise<GlyphMap> {
  // Ensure font is loaded
  await document.fonts.ready;
  
  const canvas = new OffscreenCanvas(fontSize * 2, fontSize * 2);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  ctx.font = `${fontSize}px "${fontFamily}", monospace`;
  ctx.textBaseline = 'top';
  
  const densities: CalibrationResult[] = [];
  const canvasSize = fontSize * 2;
  const pixelCount = canvasSize * canvasSize;
  
  for (const char of charset) {
    // Clear canvas to white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    
    // Draw glyph in black
    ctx.fillStyle = 'black';
    ctx.fillText(char, fontSize / 4, fontSize / 4);
    
    // Count dark pixels
    const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
    let inkPixels = 0;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      // Check red channel (grayscale, so all channels same)
      if (imageData.data[i] < 128) {
        inkPixels++;
      }
    }
    
    densities.push({
      char,
      density: inkPixels / pixelCount,
    });
  }
  
  // Sort by density (light -> dark)
  densities.sort((a, b) => a.density - b.density);
  
  return {
    glyphs: densities.map(d => d.char).join(''),
    densities: densities.map(d => d.density),
    calibration: {
      fontFamily,
      fontSize,
      fontWeight: 400,
    },
  };
}

/**
 * Cache for calibrated glyph maps
 */
const calibrationCache = new Map<string, GlyphMap>();

/**
 * Get or create a calibrated glyph map
 */
export async function getCalibratedGlyphMap(
  charset: string,
  fontFamily: string = 'JetBrains Mono',
  fontSize: number = 32
): Promise<GlyphMap> {
  const cacheKey = `${charset}:${fontFamily}:${fontSize}`;
  
  let cached = calibrationCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  const calibrated = await calibrateGlyphs(charset, fontFamily, fontSize);
  calibrationCache.set(cacheKey, calibrated);
  
  return calibrated;
}

/**
 * Clear the calibration cache
 */
export function clearCalibrationCache(): void {
  calibrationCache.clear();
}
