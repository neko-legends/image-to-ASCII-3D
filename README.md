# ImageToASCII3D

ImageToASCII3D is a browser-based image-to-ASCII tool with optional depth-map driven Three.js parallax.

## Features

- Color or monochrome ASCII conversion
- Optional reference depth map for interactive 3D parallax
- Fit, stretch, and manual grid sizing
- Font, glyph, dithering, edge detection, and invert controls
- Bloom, saturation, RGB split, scanline, grain, pulse, wave, and flicker controls in 3D mode
- Hit, death, and reset shader FX for game-style previews
- Export PNG, HTML, plain text clipboard copy, and `.aparallax` assets
- Import saved `.aparallax` assets without the original source image

## Run

```powershell
npm install
npm run dev
```

The Vite dev server defaults to `http://127.0.0.1:4000/`.

## Build

```powershell
npm run build
npm run preview
```

## AI Agent Instructions

- Treat this as an npm workspace. Use `npm install`, `npm run build`, and `npm test` from the repository root.
- Do not commit `node_modules`, `dist`, generated `.aparallax` files, exported `ascii-art.png`, or exported `ascii-art.html`.
- Keep the browser app in `apps/web` and the reusable conversion/parallax code in `packages/core` and `packages/parallax-reader`.
- Preserve the core export surface: PNG, HTML, plain text copy, `.aparallax` export, and `.aparallax` import.
- Preserve the optional depth-map path for 3D mode; the app should still work as a 2D ASCII converter when no depth map is loaded.
- The development server is expected on `http://127.0.0.1:4000/`. After UI changes, run the app and check the browser console.
- Prefer focused changes over broad rewrites. The conversion engine has tests, so extend tests when changing glyph mapping, resizing, dithering, luminance, or frame output behavior.

## Project Layout

```text
apps/web                  Vite web application
packages/core             Image-to-ASCII conversion engine
packages/parallax-reader  Portable .aparallax encoder/decoder and Three.js mesh loader
tests                     Core conversion tests
```
