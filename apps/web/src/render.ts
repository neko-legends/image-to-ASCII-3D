/**
 * ASCII frame renderers
 * HTML and Canvas rendering for browser display
 */

import type { AsciiFrame, AsciiCell, RGB } from '@ascii/core';
import { rgbToHex, rgbToCss } from '@ascii/core';

/**
 * Render ASCII frame to HTML (colored spans)
 */
export function renderToHtml(frame: AsciiFrame, colored: boolean = true): string {
  const cells = frame.cells as AsciiCell[];
  const lines: string[] = [];
  
  for (let y = 0; y < frame.rows; y++) {
    const rowChars: string[] = [];
    
    for (let x = 0; x < frame.cols; x++) {
      const idx = y * frame.cols + x;
      const cell = cells[idx];
      
      if (!cell) {
        rowChars.push(' ');
        continue;
      }
      
      const char = escapeHtml(cell.glyph);
      
      if (colored) {
        const color = rgbToHex(cell.fg);
        rowChars.push(`<span style="color:${color}">${char}</span>`);
      } else {
        rowChars.push(char);
      }
    }
    
    lines.push(`<div class="ascii-row">${rowChars.join('')}</div>`);
  }
  
  return lines.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, c => map[c] || c);
}

/**
 * Render ASCII frame to canvas for PNG export
 */
export function renderToCanvas(
  frame: AsciiFrame,
  options: {
    fontFamily?: string;
    fontSize?: number;
    backgroundColor?: RGB;
    colored?: boolean;
  } = {}
): HTMLCanvasElement {
  const {
    fontFamily = 'JetBrains Mono',
    fontSize = 14,
    backgroundColor = { r: 0, g: 0, b: 0 },
    colored = true,
  } = options;
  
  // Create offscreen canvas to measure font metrics
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  measureCtx.font = `${fontSize}px "${fontFamily}", monospace`;
  
  // Measure character width (monospace, so any char works)
  const charMetrics = measureCtx.measureText('M');
  const charWidth = charMetrics.width;
  const charHeight = fontSize * 1.2; // Line height
  
  // Create output canvas
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(frame.cols * charWidth);
  canvas.height = Math.ceil(frame.rows * charHeight);
  
  const ctx = canvas.getContext('2d')!;
  
  // Fill background
  ctx.fillStyle = rgbToCss(backgroundColor);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Configure text rendering
  ctx.font = `${fontSize}px "${fontFamily}", monospace`;
  ctx.textBaseline = 'top';
  
  // Disable ligatures (not supported in canvas, handled via CSS in HTML output)
  
  const cells = frame.cells as AsciiCell[];
  const defaultColor = colored ? null : '#ffffff';
  
  for (let y = 0; y < frame.rows; y++) {
    for (let x = 0; x < frame.cols; x++) {
      const idx = y * frame.cols + x;
      const cell = cells[idx];
      
      if (!cell || cell.glyph === ' ') continue;
      
      ctx.fillStyle = defaultColor || rgbToHex(cell.fg);
      ctx.fillText(cell.glyph, x * charWidth, y * charHeight);
    }
  }
  
  return canvas;
}

/**
 * Export canvas as PNG data URL
 */
export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/**
 * Download canvas as PNG file
 */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string = 'ascii-art.png'): void {
  const dataUrl = canvasToPngDataUrl(canvas);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

/**
 * Export frame as HTML file
 */
export function downloadAsHtml(frame: AsciiFrame, filename: string = 'ascii-art.html'): void {
  const html = generateHtmlDocument(frame);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Generate a complete HTML document with the ASCII art
 */
function generateHtmlDocument(frame: AsciiFrame): string {
  const asciiHtml = renderToHtml(frame, true);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ASCII Art</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #000;
      display: flex;
      justify-content: center;
    }
    .ascii-container {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      line-height: 1.2;
      font-variant-ligatures: none;
      -webkit-font-feature-settings: "liga" 0;
      font-feature-settings: "liga" 0;
    }
    .ascii-row {
      white-space: pre;
    }
  </style>
</head>
<body>
  <div class="ascii-container">
${asciiHtml}
  </div>
</body>
</html>`;
}
