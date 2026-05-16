/**
 * Conversion pipeline tests
 */

import { describe, it, expect } from 'vitest';
import {
  convert,
  convertWithDefaults,
  frameToText,
  frameToAnsi,
  getCellAt,
  iterateCells,
} from '../packages/core/src/convert.js';
import { createGlyphMap } from '../packages/core/src/glyphs.js';
import type { RGBAImage, AsciiCell } from '../packages/core/src/types.js';

// Helper to create test images
function createTestImage(width: number, height: number, fill: number = 128): RGBAImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill;     // R
    data[i + 1] = fill; // G
    data[i + 2] = fill; // B
    data[i + 3] = 255;  // A
  }
  return { data, width, height };
}

// Create gradient image (left dark, right bright)
function createGradientImage(width: number, height: number): RGBAImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const value = Math.floor((x / (width - 1)) * 255);
      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('convert', () => {
  it('should convert a solid color image', () => {
    const image = createTestImage(100, 100, 128);
    const glyphMap = createGlyphMap(' .+#');
    
    const frame = convert(image, glyphMap, { cols: 10 });
    
    expect(frame.cols).toBe(10);
    expect(frame.rows).toBeGreaterThan(0);
    expect(frame.charset).toBe(' .+#');
    expect((frame.cells as AsciiCell[]).length).toBe(frame.cols * frame.rows);
  });

  it('should produce NO DIGITS in output', () => {
    const image = createGradientImage(200, 100);
    const frame = convertWithDefaults(image, { cols: 80 });
    
    const text = frameToText(frame);
    expect(text).not.toMatch(/[0-9]/);
  });

  it('should respect cols option', () => {
    const image = createTestImage(100, 100);
    const frame = convertWithDefaults(image, { cols: 40 });
    
    expect(frame.cols).toBe(40);
  });

  it('should preserve aspect ratio by default', () => {
    const image = createTestImage(200, 100); // 2:1 aspect
    const frame = convertWithDefaults(image, { cols: 80 });
    
    // With cell aspect ~0.5, rows should be roughly cols / 2 / cellAspect = cols
    // But actual calculation depends on source aspect
    expect(frame.rows).toBeGreaterThan(0);
    expect(frame.meta?.options.preserveAspectRatio).toBe(true);
  });

  it('should support invert option', () => {
    const image = createTestImage(50, 50, 0); // Black image
    const glyphMap = createGlyphMap(' @');
    
    const normalFrame = convert(image, glyphMap, { cols: 10, invert: false });
    const invertedFrame = convert(image, glyphMap, { cols: 10, invert: true });
    
    const normalCells = normalFrame.cells as AsciiCell[];
    const invertedCells = invertedFrame.cells as AsciiCell[];
    
    // Black image should produce lightest glyph normally, darkest when inverted
    expect(normalCells[0].glyph).toBe(' ');
    expect(invertedCells[0].glyph).toBe('@');
  });

  it('should include color information when colorMode is foreground', () => {
    const image = createTestImage(50, 50, 200);
    const frame = convertWithDefaults(image, { cols: 10, colorMode: 'foreground' });
    
    const cells = frame.cells as AsciiCell[];
    expect(cells[0].fg).toBeDefined();
    expect(cells[0].fg.r).toBeGreaterThan(0);
  });

  it('should use white color when colorMode is none', () => {
    const image = createTestImage(50, 50, 128);
    const frame = convertWithDefaults(image, { cols: 10, colorMode: 'none' });
    
    const cells = frame.cells as AsciiCell[];
    expect(cells[0].fg).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('frameToText', () => {
  it('should convert frame to plain text', () => {
    const image = createGradientImage(100, 50);
    const frame = convertWithDefaults(image, { cols: 20 });
    
    const text = frameToText(frame);
    
    expect(text).toContain('\n');
    expect(text.split('\n').length).toBe(frame.rows);
    expect(text.split('\n')[0].length).toBe(frame.cols);
  });

  it('should produce NO DIGITS in text output', () => {
    const image = createGradientImage(100, 50);
    const frame = convertWithDefaults(image, { cols: 80 });
    
    const text = frameToText(frame);
    expect(text).not.toMatch(/[0-9]/);
  });
});

describe('frameToAnsi', () => {
  it('should include ANSI color codes', () => {
    const image = createTestImage(50, 50, 200);
    const frame = convertWithDefaults(image, { cols: 10 });
    
    const ansi = frameToAnsi(frame);
    
    // Should contain ANSI escape sequences
    expect(ansi).toContain('\x1b[38;2;');
    expect(ansi).toContain('\x1b[0m');
  });
});

describe('getCellAt', () => {
  it('should return cell at valid position', () => {
    const image = createTestImage(50, 50);
    const frame = convertWithDefaults(image, { cols: 10 });
    
    const cell = getCellAt(frame, 0, 0);
    expect(cell).toBeDefined();
    expect(cell?.glyph).toBeDefined();
  });

  it('should return undefined for out of bounds', () => {
    const image = createTestImage(50, 50);
    const frame = convertWithDefaults(image, { cols: 10 });
    
    expect(getCellAt(frame, -1, 0)).toBeUndefined();
    expect(getCellAt(frame, 0, -1)).toBeUndefined();
    expect(getCellAt(frame, 1000, 0)).toBeUndefined();
  });
});

describe('iterateCells', () => {
  it('should iterate over all cells with positions', () => {
    const image = createTestImage(50, 50);
    const frame = convertWithDefaults(image, { cols: 5 });
    
    const cells = [...iterateCells(frame)];
    
    expect(cells.length).toBe(frame.cols * frame.rows);
    expect(cells[0]).toHaveProperty('cell');
    expect(cells[0]).toHaveProperty('x');
    expect(cells[0]).toHaveProperty('y');
  });
});
