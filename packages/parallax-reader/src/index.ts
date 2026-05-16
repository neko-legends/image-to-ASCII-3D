/**
 * @ascii/parallax-reader
 * 
 * Standalone Three.js parallax asset loader and renderer.
 * Load pre-baked .aparallax files without needing source or depth images.
 * 
 * @example
 * ```typescript
 * import { loadParallaxAsset, createParallaxScene } from '@ascii/parallax-reader';
 * 
 * // Load the asset
 * const asset = await loadParallaxAsset('/path/to/art.aparallax');
 * 
 * // Create a complete scene with tilt controls
 * const { animate, dispose } = await createParallaxScene(asset, container);
 * animate(); // Start the animation loop
 * 
 * // Later, clean up
 * dispose();
 * ```
 * 
 * @example
 * ```typescript
 * // Or use lower-level APIs for custom setups
 * import { loadParallaxAsset, createParallaxMesh, ParallaxController } from '@ascii/parallax-reader';
 * 
 * const asset = await loadParallaxAsset('/path/to/art.aparallax');
 * const mesh = await createParallaxMesh(asset);
 * 
 * // Add to your own scene
 * scene.add(mesh);
 * 
 * // Create controller for tilt
 * const controller = new ParallaxController(mesh, asset.maxTilt);
 * 
 * // In your animation loop
 * controller.update();
 * ```
 */

// Format types and constants
export {
  MAGIC,
  FORMAT_VERSION,
  HEADER_SIZE,
  FLAGS,
  type ParallaxAsset,
  type CreateAssetOptions,
} from './format.js';

// Encoder (for creating .aparallax files)
export {
  encodeParallaxAsset,
  canvasToPngData,
} from './encoder.js';

// Decoder (for loading .aparallax files)
export {
  decodeParallaxAsset,
  loadParallaxAsset,
} from './decoder.js';

// Three.js renderer
export {
  ParallaxController,
  createParallaxMesh,
  createParallaxScene,
  type ParallaxControllerOptions,
} from './renderer.js';
