# ASCII Art Generator - Design Document

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Web App (apps/web)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Upload    │  │  Controls   │  │   Preview   │  │   Export   │ │
│  │  Handler    │  │    Panel    │  │    Area     │  │   Panel    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│         │                │                │                │        │
│         └────────────────┼────────────────┼────────────────┘        │
│                          │                │                         │
│  ┌───────────────────────▼────────────────▼───────────────────────┐ │
│  │                    Density Calibrator                          │ │
│  │              (measures glyph ink coverage)                     │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          │ GlyphMap                                 │
│  ┌───────────────────────▼────────────────────────────────────────┐ │
│  │                      Renderers                                  │ │
│  │   ┌─────────────┐              ┌─────────────┐                 │ │
│  │   │    HTML     │              │   Canvas    │                 │ │
│  │   │  Renderer   │              │  Renderer   │──► PNG Export   │ │
│  │   └─────────────┘              └─────────────┘                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ AsciiFrame
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Core Engine (packages/core)                    │
│                         (Pure TypeScript, NO DOM)                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    convertFromRGBA()                         │   │
│  │                    convertFromImageData()                    │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────┐   │
│  │                   Processing Pipeline                        │   │
│  │                                                              │   │
│  │   ┌─────────┐   ┌───────────┐   ┌────────┐   ┌───────────┐  │   │
│  │   │ Resize  │──►│ Luminance │──►│  Edge  │──►│  Dither   │  │   │
│  │   │         │   │           │   │(Sobel) │   │(Floyd-S.) │  │   │
│  │   └─────────┘   └───────────┘   └────────┘   └───────────┘  │   │
│  │        │                                           │         │   │
│  │        │              ┌────────────┐               │         │   │
│  │        └─────────────►│   Color    │◄──────────────┘         │   │
│  │                       │  Sampling  │                         │   │
│  │                       └─────┬──────┘                         │   │
│  │                             │                                │   │
│  │                       ┌─────▼──────┐                         │   │
│  │                       │   Glyph    │                         │   │
│  │                       │  Mapping   │◄── GlyphMap             │   │
│  │                       └─────┬──────┘                         │   │
│  │                             │                                │   │
│  └─────────────────────────────┼────────────────────────────────┘   │
│                                │                                    │
│                          ┌─────▼──────┐                             │
│                          │ AsciiFrame │                             │
│                          └────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Data Model

### AsciiFrame

The central output structure - represents the converted ASCII art.

```typescript
interface AsciiFrame {
  /** Number of character columns */
  cols: number;
  
  /** Number of character rows */
  rows: number;
  
  /** 
   * Cell data - can be structured array or packed Uint32Array
   * Length = cols * rows
   */
  cells: AsciiCell[] | PackedCells;
  
  /** The charset used for this conversion (for reference) */
  charset: string;
  
  /** Metadata about the conversion */
  meta?: {
    sourceWidth: number;
    sourceHeight: number;
    options: ConvertOptions;
  };
}

interface AsciiCell {
  /** The character to display */
  glyph: string;
  
  /** Foreground color (RGB) */
  fg: RGB;
  
  /** Background color (RGB, optional) */
  bg?: RGB;
}

interface RGB {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
}

/** 
 * Packed representation for performance
 * Each cell is 2x Uint32: [glyphIndex | fgPacked, bgPacked]
 */
interface PackedCells {
  data: Uint32Array;
  glyphLookup: string[];  // Index → glyph character
}
```

### GlyphMap

Passed from web app to core - contains density-sorted glyphs.

```typescript
interface GlyphMap {
  /** Glyphs sorted by density (lightest → darkest) */
  glyphs: string;
  
  /** Optional: density values for each glyph (0.0 - 1.0) */
  densities?: number[];
  
  /** Font info used for calibration (for cache key) */
  calibration?: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
  };
}
```

---

## Processing Pipeline

### Step 1: Resize

Downscale source image to target grid size.

```
Source Image (W × H pixels)
         │
         ▼
┌─────────────────────┐
│   Box Average       │  ← Default: average all pixels in each cell region
│   or Nearest        │  ← Optional: pick center pixel (pixelated look)
└─────────────────────┘
         │
         ▼
Grid (cols × rows) of averaged RGBA values
```

**Box Average Algorithm:**
```typescript
for each cell (cx, cy):
  // Calculate source region for this cell
  x0 = floor(cx * sourceWidth / cols)
  x1 = floor((cx + 1) * sourceWidth / cols)
  y0 = floor(cy * sourceHeight / rows)
  y1 = floor((cy + 1) * sourceHeight / rows)
  
  // Average all pixels in region
  sum_r, sum_g, sum_b, count = 0
  for y in y0..y1:
    for x in x0..x1:
      sum_r += source[y][x].r
      sum_g += source[y][x].g
      sum_b += source[y][x].b
      count++
  
  cell[cy][cx] = { r: sum_r/count, g: sum_g/count, b: sum_b/count }
```

### Step 2: Luminance Calculation

Convert RGB to perceptual luminance with gamma correction.

```typescript
function rgbToLuminance(r: number, g: number, b: number): number {
  // sRGB → Linear
  const linearR = srgbToLinear(r / 255);
  const linearG = srgbToLinear(g / 255);
  const linearB = srgbToLinear(b / 255);
  
  // Rec. 709 luminance coefficients
  return 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB;
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 
    ? c / 12.92 
    : Math.pow((c + 0.055) / 1.055, 2.4);
}
```

### Step 3: Edge Detection (Optional)

Enhance edges using Sobel operator.

```typescript
// Sobel kernels
const Gx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
const Gy = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

function sobelEdge(luminanceGrid: number[][]): number[][] {
  const edges = create2DArray(cols, rows, 0);
  
  for (y = 1; y < rows - 1; y++) {
    for (x = 1; x < cols - 1; x++) {
      let gx = 0, gy = 0;
      
      for (ky = -1; ky <= 1; ky++) {
        for (kx = -1; kx <= 1; kx++) {
          const lum = luminanceGrid[y + ky][x + kx];
          gx += lum * Gx[ky + 1][kx + 1];
          gy += lum * Gy[ky + 1][kx + 1];
        }
      }
      
      edges[y][x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  
  return edges;
}

// Blend edges into luminance
finalLuminance = luminance + edgeStrength * edges;
```

### Step 4: Dithering (Optional)

Floyd-Steinberg error diffusion for better detail.

```typescript
function floydSteinberg(luminanceGrid: number[][], glyphCount: number): number[][] {
  const result = clone(luminanceGrid);
  
  for (y = 0; y < rows; y++) {
    for (x = 0; x < cols; x++) {
      const oldValue = result[y][x];
      const newValue = quantize(oldValue, glyphCount);  // Snap to nearest glyph level
      const error = oldValue - newValue;
      
      result[y][x] = newValue;
      
      // Distribute error to neighbors
      if (x + 1 < cols)           result[y][x + 1]     += error * 7/16;
      if (y + 1 < rows) {
        if (x > 0)                result[y + 1][x - 1] += error * 3/16;
                                  result[y + 1][x]     += error * 5/16;
        if (x + 1 < cols)         result[y + 1][x + 1] += error * 1/16;
      }
    }
  }
  
  return result;
}
```

### Step 5: Glyph Mapping

Map luminance values to glyphs.

```typescript
function mapToGlyph(luminance: number, glyphMap: GlyphMap, invert: boolean): string {
  const glyphs = glyphMap.glyphs;
  
  // Luminance 0..1 → index 0..(glyphs.length-1)
  let index = Math.floor(luminance * (glyphs.length - 1));
  
  if (invert) {
    index = glyphs.length - 1 - index;
  }
  
  return glyphs[Math.max(0, Math.min(index, glyphs.length - 1))];
}
```

---

## Glyph Density Calibration

**Problem:** Different fonts render glyphs with different "ink coverage". A `@` might be 80% filled in one font but 60% in another.

**Solution:** Measure actual density in the browser using the chosen font.

```typescript
async function calibrateGlyphs(
  charset: string,
  fontFamily: string,
  fontSize: number
): Promise<GlyphMap> {
  const canvas = new OffscreenCanvas(32, 32);
  const ctx = canvas.getContext('2d')!;
  
  ctx.font = `${fontSize}px "${fontFamily}"`;
  ctx.textBaseline = 'top';
  
  const densities: { char: string; density: number }[] = [];
  
  for (const char of charset) {
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 32, 32);
    
    // Draw glyph
    ctx.fillStyle = 'black';
    ctx.fillText(char, 0, 0);
    
    // Count dark pixels
    const imageData = ctx.getImageData(0, 0, 32, 32);
    let inkPixels = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i] < 128) inkPixels++;  // R channel < 128 = ink
    }
    
    densities.push({ char, density: inkPixels / (32 * 32) });
  }
  
  // Sort by density (light → dark)
  densities.sort((a, b) => a.density - b.density);
  
  return {
    glyphs: densities.map(d => d.char).join(''),
    densities: densities.map(d => d.density),
    calibration: { fontFamily, fontSize, fontWeight: 400 }
  };
}
```

---

## Sizing Modes

### 1. Explicit Grid
User specifies exact `cols` and `rows`.

### 2. Fit Container
Calculate cols/rows from container size and font metrics.

```typescript
function fitToContainer(
  containerWidth: number,
  containerHeight: number,
  cellWidth: number,
  cellHeight: number,
  sourceAspectRatio: number
): { cols: number; rows: number } {
  const maxCols = Math.floor(containerWidth / cellWidth);
  const maxRows = Math.floor(containerHeight / cellHeight);
  
  // Maintain source aspect ratio
  const cellAspect = cellWidth / cellHeight;
  let cols = maxCols;
  let rows = Math.round(cols / sourceAspectRatio / cellAspect);
  
  if (rows > maxRows) {
    rows = maxRows;
    cols = Math.round(rows * sourceAspectRatio * cellAspect);
  }
  
  return { cols, rows };
}
```

### 3. Target Pixel Export
User specifies output image dimensions (e.g., 1920×1080).

```typescript
function targetPixelSize(
  targetWidth: number,
  targetHeight: number,
  fontSize: number,
  cellWidth: number,
  cellHeight: number,
  sourceAspectRatio: number
): { cols: number; rows: number; exportFontSize: number } {
  // Calculate how many cells fit in target dimensions
  let cols = Math.floor(targetWidth / cellWidth);
  let rows = Math.floor(targetHeight / cellHeight);
  
  // Adjust to maintain source aspect ratio
  const cellAspect = cellWidth / cellHeight;
  rows = Math.round(cols / sourceAspectRatio / cellAspect);
  
  return { cols, rows, exportFontSize: fontSize };
}
```

---

## Why This Design?

### Core/Web Separation
- **Core** is pure TypeScript with no DOM dependencies
- Can be reused in Node.js, Electron, Workers, etc.
- **Web** handles browser-specific concerns (Canvas, DOM, fonts)
- Clean testing - core can be tested without browser

### GlyphMap Injection
- Core doesn't know about fonts or Canvas
- Web measures font-specific densities
- Passes sorted glyph list to core
- Enables consistent results across platforms

### Packed Cell Format
- Optional optimization for large outputs
- Uses Uint32Array for memory efficiency
- Single allocation, no object overhead

### No Digits Guarantee
- Charset validation at input boundary
- Default presets carefully curated
- Hard test: regex check on output

---

## Phase 2 Considerations (Future)

This design supports future extensions:

1. **CLI Tool** - Core works in Node.js, add a CLI wrapper
2. **Electron/Tauri** - Core + native file system access
3. **Video Mode** - Process frames, output to terminal or video
4. **Custom Fonts** - Load TTF/WOFF, extract glyph paths for density
5. **WebGL Renderer** - GPU-accelerated for real-time preview
