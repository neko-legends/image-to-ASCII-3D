# ASCII Art Generator - Agent Studio Mission

## Overview

Build a production-quality **Color Image → ASCII** generator as a web application.

**Project Location:** `projects/ascii-generator/`
**Built By:** Agent Studio CodeGenerator (OpenCode integration)

---

## Phase 1 Scope (Web App Only)

### Build
- A TypeScript core conversion engine (UI-agnostic, no DOM dependencies)
- A web app UI for upload/preview/tuning/export

### Do NOT Build
- Tauri/Electron desktop wrappers
- Steam packaging
- Native file system integration beyond standard browser downloads

---

## Goal

Create a high-quality image-to-ASCII generator that:
- Uses **letters + symbols ONLY** (NO DIGITS 0-9 anywhere in the glyph set or output)
- Supports **color output** in the browser (truecolor per glyph)
- Supports **resolution/sizing modes** (character-grid and target-pixel export)
- Exports: **HTML** and **PNG** (rendered ASCII image)

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript (strict mode) |
| Build | Vite |
| UI | Vanilla TS (React optional if it helps) |
| Testing | Vitest |
| Font | JetBrains Mono (primary), fallback: IBM Plex Mono, Consolas, Menlo |

---

## Project Structure

```
projects/ascii-generator/
├── packages/
│   └── core/                    # Pure TS engine, NO DOM
│       ├── src/
│       │   ├── index.ts         # Main exports
│       │   ├── types.ts         # AsciiFrame, options, etc.
│       │   ├── convert.ts       # Main conversion logic
│       │   ├── resize.ts        # Image resizing (box average, nearest)
│       │   ├── luminance.ts     # Gamma-aware luminance calculation
│       │   ├── edge.ts          # Sobel edge detection
│       │   ├── dither.ts        # Floyd-Steinberg dithering
│       │   ├── color.ts         # Color sampling and packing
│       │   ├── glyphs.ts        # Glyph presets and validation
│       │   └── utils.ts         # packColor, unpackColor, getCell
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   └── web/                     # Vite web app
│       ├── src/
│       │   ├── main.ts          # Entry point
│       │   ├── ui/              # UI components
│       │   ├── renderers/
│       │   │   ├── html.ts      # HTML <pre> + <span> renderer
│       │   │   └── canvas.ts    # Canvas renderer + PNG export
│       │   └── calibration/
│       │       └── density.ts   # Glyph density measurement
│       ├── index.html
│       ├── package.json
│       └── vite.config.ts
├── tests/
│   ├── core/
│   │   ├── charset.test.ts      # No-digits validation
│   │   ├── convert.test.ts      # Determinism, dimensions
│   │   └── golden.test.ts       # Golden image tests
│   └── setup.ts
├── package.json                 # Workspace root
├── pnpm-workspace.yaml
├── tsconfig.json                # Base config
├── DESIGN.md                    # Architecture documentation
└── README.md                    # Usage documentation
```

---

## Agent Studio Task Breakdown

### Task 1: Project Scaffold
**Agent:** CodeGenerator
**Description:** Create project structure, package.json files, TypeScript configs, Vite config
**Expected Files:**
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `apps/web/index.html`
**Build Command:** `pnpm install`
**Verification:** All files exist, pnpm install succeeds

---

### Task 2: Core Types
**Agent:** CodeGenerator
**Description:** Define TypeScript types for AsciiFrame, options, glyph maps
**Expected Files:**
- `packages/core/src/types.ts`
- `packages/core/src/index.ts`
**Build Command:** `pnpm --filter @ascii/core build`
**Verification:** TypeScript compiles without errors

**Key Types:**
```typescript
interface AsciiFrame {
  cols: number;
  rows: number;
  cells: AsciiCell[];  // or Uint32Array for packed
  charset: string;
}

interface AsciiCell {
  glyph: string;
  fg: RGB;
  bg?: RGB;
}

interface ConvertOptions {
  cols?: number;
  rows?: number;
  preset?: 'dense' | 'clean' | 'minimal';
  customCharset?: string;
  invert?: boolean;
  dither?: boolean;
  edge?: boolean;
  edgeStrength?: number;
  bgMode?: 'off' | 'color';
}
```

---

### Task 3: Glyph Presets & Validation
**Agent:** CodeGenerator
**Description:** Create glyph presets (no digits!), charset validation
**Expected Files:**
- `packages/core/src/glyphs.ts`
- `tests/core/charset.test.ts`
**Test Command:** `pnpm test`
**Verification:** Tests pass, no digits in any preset

**Presets:**
1. `dense` - Maximum detail: `@%#*+=-:. ` + letters
2. `clean` - Balanced: `#@$%&?*+=-:. ` (no digits)
3. `minimal` - Stylized: `.:-=+*#` 

**Validation:**
- Reject any charset containing `[0-9]`
- Test must verify: rendered output contains no digits

---

### Task 4: Image Processing Pipeline
**Agent:** CodeGenerator
**Description:** Implement resize, luminance, edge detection, dithering
**Expected Files:**
- `packages/core/src/resize.ts`
- `packages/core/src/luminance.ts`
- `packages/core/src/edge.ts`
- `packages/core/src/dither.ts`
**Build Command:** `pnpm --filter @ascii/core build`
**Verification:** TypeScript compiles

**Requirements:**
- **Resize:** Box average (default) and nearest-neighbor
- **Luminance:** Gamma-aware (sRGB → linear, Rec. 709 coefficients)
- **Edge:** Sobel on luminance grid, configurable blend strength
- **Dither:** Floyd-Steinberg, deterministic (no randomness)

---

### Task 5: Color Sampling
**Agent:** CodeGenerator
**Description:** Implement color extraction and packing utilities
**Expected Files:**
- `packages/core/src/color.ts`
- `packages/core/src/utils.ts`
**Build Command:** `pnpm --filter @ascii/core build`
**Verification:** TypeScript compiles

**Requirements:**
- Box average RGB for each cell region
- Pack/unpack RGB to/from Uint32
- Optional palette quantization (webSafe, 256-color)

---

### Task 6: Main Conversion Logic
**Agent:** CodeGenerator
**Description:** Implement convertFromRGBA and convertFromImageData
**Expected Files:**
- `packages/core/src/convert.ts`
- `tests/core/convert.test.ts`
**Test Command:** `pnpm test`
**Verification:** Tests pass

**API:**
```typescript
function convertFromRGBA(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: ConvertOptions,
  glyphMap: GlyphMap
): AsciiFrame;

function convertFromImageData(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  options: ConvertOptions,
  glyphMap: GlyphMap
): AsciiFrame;
```

---

### Task 7: Glyph Density Calibration (Web)
**Agent:** CodeGenerator
**Description:** Measure glyph densities using offscreen canvas
**Expected Files:**
- `apps/web/src/calibration/density.ts`
**Build Command:** `pnpm --filter @ascii/web build`
**Verification:** Build succeeds

**Algorithm:**
1. Render each glyph onto 32x32 offscreen canvas
2. Count "ink" pixels (alpha > threshold)
3. Sort glyphs light → dark
4. Cache by (fontFamily, fontSize, charset, fontWeight)
5. Pass sorted glyph string to core as `GlyphMap`

---

### Task 8: HTML Renderer
**Agent:** CodeGenerator
**Description:** Render AsciiFrame as HTML with colored spans
**Expected Files:**
- `apps/web/src/renderers/html.ts`
**Build Command:** `pnpm --filter @ascii/web build`
**Verification:** Build succeeds

**Output:**
```html
<pre style="font-family: 'JetBrains Mono', monospace; line-height: 1; font-feature-settings: 'liga' 0;">
  <span style="color: rgb(255,128,64)">@</span>...
</pre>
```

---

### Task 9: Canvas Renderer + PNG Export
**Agent:** CodeGenerator
**Description:** Render AsciiFrame to canvas, export as PNG
**Expected Files:**
- `apps/web/src/renderers/canvas.ts`
**Build Command:** `pnpm --filter @ascii/web build`
**Verification:** Build succeeds

**Requirements:**
- Draw glyphs with `fillText`
- Measure monospace metrics for spacing
- Export canvas to PNG blob/download

---

### Task 10: Web UI
**Agent:** CodeGenerator
**Description:** Build the main web app interface
**Expected Files:**
- `apps/web/src/main.ts`
- `apps/web/src/ui/controls.ts`
- `apps/web/src/ui/preview.ts`
- `apps/web/src/ui/export.ts`
**Build Command:** `pnpm --filter @ascii/web build`
**Verification:** Build succeeds, dev server runs

**UI Controls:**
- File upload + drag/drop
- Preset selector (dense/clean/minimal)
- Custom charset input (validated, rejects digits)
- Color mode toggle (text-only / text+bg)
- Dither toggle
- Edge enhancement toggle + strength slider
- Invert toggle
- Sizing mode (explicit cols/rows, fit container, target px)
- Font family selector
- Font size sliders (preview / export)
- Aspect correction slider

**Export Buttons:**
- Copy plain ASCII to clipboard
- Download HTML
- Download PNG

---

### Task 11: Golden Tests
**Agent:** CodeGenerator
**Description:** Add golden/snapshot tests with procedural images
**Expected Files:**
- `tests/core/golden.test.ts`
- `tests/fixtures/` (generated test images)
**Test Command:** `pnpm test`
**Verification:** All tests pass

**Test Images:**
- Gradient (horizontal luminance ramp)
- Checkerboard (alternating black/white)
- Color bars (RGB stripes)

---

### Task 12: Documentation
**Agent:** CodeGenerator (or Lorekeeper)
**Description:** Write README and DESIGN docs
**Expected Files:**
- `README.md`
- `DESIGN.md`
**Verification:** Files exist with required sections

**README Sections:**
- How to run web app (dev + build)
- Presets + sizing modes explained
- Why monospace + ligatures off
- How target-px export works
- Tips: best font size, aspect slider, dithering

**DESIGN Sections:**
- Core pipeline steps (diagram)
- Density calibration method
- AsciiFrame data model
- Why it's designed for reuse in Phase 2

---

## Success Criteria

| Criterion | Verification |
|-----------|--------------|
| Converts images to colored ASCII | Manual test with sample image |
| No digits in output | `tests/core/charset.test.ts` passes |
| Explicit grid sizing works | Manual test |
| Fit container sizing works | Manual test |
| Target-px export sizing works | Manual test |
| Ligatures disabled | Visual inspection |
| HTML export works | Download and open in browser |
| PNG export works | Download and verify image |
| All tests pass | `pnpm test` exits 0 |
| Docs are complete | README and DESIGN exist with sections |

---

## Execution Order

```
Task 1 (scaffold)
    │
    ▼
Task 2 (types) ──────┐
    │                │
    ▼                │
Task 3 (glyphs) ─────┼──► Task 6 (convert)
    │                │         │
    ▼                │         ▼
Task 4 (processing)──┘    Task 11 (golden tests)
    │
    ▼
Task 5 (color)
    │
    ▼
Task 7 (calibration) ──► Task 8 (HTML renderer)
                              │
                              ▼
                         Task 9 (Canvas + PNG)
                              │
                              ▼
                         Task 10 (Web UI)
                              │
                              ▼
                         Task 12 (Docs)
```

---

## Notes for Agent Studio

- **Workdir:** `projects/ascii-generator/`
- **Package Manager:** pnpm (monorepo)
- **Build Verification:** `pnpm run build` at root
- **Test Verification:** `pnpm test` at root
- **Max Retries:** 3 per task
- **Model:** `venice/claude-opus-45` via OpenCode

Each task should be executed sequentially following the dependency order. The CodeGenerator will use OpenCode for agentic, iterative development with automatic build/test verification.
