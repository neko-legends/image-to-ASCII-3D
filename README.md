# ImageToASCII3D

Repository: [neko-legends/image-to-ASCII-3D](https://github.com/neko-legends/image-to-ASCII-3D)

ImageToASCII3D is a standalone desktop image-to-ASCII tool with optional depth-map driven Three.js parallax.

## Features

- Color or monochrome ASCII conversion
- Optional reference depth map for interactive 3D parallax
- Fit, stretch, and manual grid sizing
- Font, glyph, dithering, edge detection, and invert controls
- Bloom, saturation, RGB split, scanline, grain, pulse, wave, and flicker controls in 3D mode
- Hit, death, and reset shader FX for game-style previews
- Export PNG, HTML, plain text clipboard copy, and `.aparallax` assets
- Import saved `.aparallax` assets without the original source image
- Drag and drop PNG, JPEG, GIF, WebP, AVIF, BMP, SVG, and ICO files for source images or depth maps

## Run The Desktop App

```powershell
npm install
npm run dev
```

The desktop app uses Tauri. In development, Tauri starts the local Vite server internally and opens the native app window; it does not launch a browser tab.
Release builds load the bundled frontend directly from the executable; they do not require `http://127.0.0.1` to be running.

## Build A Standalone Desktop App

```powershell
npm install
npm run tauri:build
```

For a quick test build without installer packaging:

```powershell
npm run build
.\node_modules\.bin\tauri.cmd build --no-bundle
```

The direct executable is written to:

```text
src-tauri/target/release/image-to-ascii-3d.exe
```

## Optional Web Mode

The same UI can still run as a plain Vite web app for browser-only testing or development.

```powershell
npm run dev:web
```

The web dev server defaults to `http://127.0.0.1:1442/`.
The web preview server defaults to `http://127.0.0.1:1443/`.

## AI Agent Instructions

- Treat this as an npm workspace. Use `npm install`, `npm run build`, and `npm test` from the repository root.
- Do not commit `node_modules`, `dist`, `src-tauri/target`, generated `.aparallax` files, exported `ascii-art.png`, or exported `ascii-art.html`.
- The primary GUI target is the Tauri desktop app. The web app is available as an optional development/preview mode.
- Keep the browser app in `apps/web` and the reusable conversion/parallax code in `packages/core` and `packages/parallax-reader`.
- Preserve the core export surface: PNG, HTML, plain text copy, `.aparallax` export, and `.aparallax` import.
- Preserve the optional depth-map path for 3D mode; the app should still work as a 2D ASCII converter when no depth map is loaded.
- `npm run dev` is the desktop Tauri app. `npm run dev:web` is the explicit browser-only development server on `http://127.0.0.1:1442/`; it does not open a browser automatically.
- Prefer focused changes over broad rewrites. The conversion engine has tests, so extend tests when changing glyph mapping, resizing, dithering, luminance, or frame output behavior.

## Project Layout

```text
apps/web                  Vite web application
packages/core             Image-to-ASCII conversion engine
packages/parallax-reader  Portable .aparallax encoder/decoder and Three.js mesh loader
src-tauri                 Tauri desktop shell and build configuration
tests                     Core conversion tests
```
