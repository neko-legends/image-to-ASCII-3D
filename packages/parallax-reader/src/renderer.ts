/**
 * Three.js parallax mesh renderer
 * 
 * Creates a complete parallax mesh from a loaded ParallaxAsset.
 * Handles texture loading, geometry creation, and tilt controls.
 */

import * as THREE from 'three';
import type { ParallaxAsset } from './format.js';

/**
 * Options for the parallax controller
 */
export interface ParallaxControllerOptions {
  /** Container element for mouse tracking (defaults to document.body) */
  container?: HTMLElement;
  
  /** Enable mouse-based tilt (default: true) */
  enableMouseTilt?: boolean;
  
  /** Enable device orientation tilt for mobile (default: true) */
  enableGyroTilt?: boolean;
  
  /** Smoothing factor for rotation (0-1, higher = snappier) */
  smoothing?: number;
}

/**
 * Parallax controller - handles tilt animation for a mesh
 */
export class ParallaxController {
  private mesh: THREE.Mesh;
  private maxTiltRad: number;
  private targetRotation = { x: 0, y: 0 };
  private currentRotation = { x: 0, y: 0 };
  private smoothing: number;
  
  private container: HTMLElement;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private orientationHandler: ((e: DeviceOrientationEvent) => void) | null = null;
  private disposed = false;

  constructor(
    mesh: THREE.Mesh,
    maxTiltDegrees: number,
    options: ParallaxControllerOptions = {}
  ) {
    this.mesh = mesh;
    this.maxTiltRad = THREE.MathUtils.degToRad(maxTiltDegrees);
    this.smoothing = options.smoothing ?? 0.08;
    this.container = options.container ?? document.body;

    if (options.enableMouseTilt !== false) {
      this.enableMouseTilt();
    }

    if (options.enableGyroTilt !== false && 'DeviceOrientationEvent' in window) {
      this.enableGyroTilt();
    }
  }

  /**
   * Enable mouse-based tilt
   */
  private enableMouseTilt(): void {
    this.mouseMoveHandler = (e: MouseEvent) => {
      const rect = this.container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const normalizedX = THREE.MathUtils.clamp(
        (e.clientX - centerX) / (rect.width / 2),
        -1,
        1
      );
      const normalizedY = THREE.MathUtils.clamp(
        (e.clientY - centerY) / (rect.height / 2),
        -1,
        1
      );

      this.targetRotation.y = normalizedX * this.maxTiltRad;
      this.targetRotation.x = -normalizedY * this.maxTiltRad;
    };

    document.addEventListener('mousemove', this.mouseMoveHandler);
  }

  /**
   * Enable gyroscope-based tilt for mobile devices
   */
  private enableGyroTilt(): void {
    this.orientationHandler = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;

      // gamma: left-to-right tilt (-90 to 90)
      // beta: front-to-back tilt (-180 to 180)
      const normalizedX = THREE.MathUtils.clamp(e.gamma / 45, -1, 1);
      const normalizedY = THREE.MathUtils.clamp((e.beta - 45) / 45, -1, 1);

      this.targetRotation.y = normalizedX * this.maxTiltRad;
      this.targetRotation.x = -normalizedY * this.maxTiltRad;
    };

    window.addEventListener('deviceorientation', this.orientationHandler);
  }

  /**
   * Update the mesh rotation (call this in your animation loop)
   */
  update(): void {
    if (this.disposed) return;

    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * this.smoothing;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * this.smoothing;

    this.mesh.rotation.x = this.currentRotation.x;
    this.mesh.rotation.y = this.currentRotation.y;
  }

  /**
   * Set target rotation programmatically (for non-mouse/gyro control)
   */
  setTargetRotation(x: number, y: number): void {
    this.targetRotation.x = THREE.MathUtils.clamp(x, -this.maxTiltRad, this.maxTiltRad);
    this.targetRotation.y = THREE.MathUtils.clamp(y, -this.maxTiltRad, this.maxTiltRad);
  }

  /**
   * Clean up event listeners
   */
  dispose(): void {
    this.disposed = true;
    
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    
    if (this.orientationHandler) {
      window.removeEventListener('deviceorientation', this.orientationHandler);
      this.orientationHandler = null;
    }
  }
}

/**
 * Create a Three.js mesh from a ParallaxAsset
 */
export async function createParallaxMesh(asset: ParallaxAsset): Promise<THREE.Mesh> {
  // Create texture from PNG data
  const texture = await createTextureFromPngData(asset.textureData);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // PNG data is sRGB, tell Three.js not to convert it again
  texture.colorSpace = THREE.SRGBColorSpace;

  // Create geometry with pre-displaced positions
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(asset.positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(asset.uvs, 2));
  
  // Generate indices for the grid
  const indices = generateGridIndices(asset.segmentsX, asset.segmentsY);
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  
  geometry.computeVertexNormals();

  // Create material
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.FrontSide,
  });

  return new THREE.Mesh(geometry, material);
}

/**
 * Create a texture from PNG data (Uint8Array)
 */
async function createTextureFromPngData(data: Uint8Array): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    // Create a blob URL from the PNG data
    // Copy to a plain ArrayBuffer to avoid SharedArrayBuffer type issues
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    const blob = new Blob([buffer], { type: 'image/png' });
    const url = URL.createObjectURL(blob);

    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture: THREE.Texture) => {
        URL.revokeObjectURL(url);
        resolve(texture);
      },
      undefined,
      (err: unknown) => {
        URL.revokeObjectURL(url);
        reject(err);
      }
    );
  });
}

/**
 * Generate triangle indices for a grid geometry
 */
function generateGridIndices(segmentsX: number, segmentsY: number): Uint32Array {
  const indices: number[] = [];
  
  for (let y = 0; y < segmentsY; y++) {
    for (let x = 0; x < segmentsX; x++) {
      const a = y * (segmentsX + 1) + x;
      const b = a + 1;
      const c = a + (segmentsX + 1);
      const d = c + 1;

      // Two triangles per grid cell
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  return new Uint32Array(indices);
}

/**
 * Convenience function to set up everything in one call
 */
export async function createParallaxScene(
  asset: ParallaxAsset,
  container: HTMLElement,
  options: ParallaxControllerOptions = {}
): Promise<{
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  mesh: THREE.Mesh;
  controller: ParallaxController;
  animate: () => void;
  dispose: () => void;
}> {
  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Create camera
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
  camera.position.z = 2.5;

  // Create renderer with proper color management
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Fix washed out colors: output in sRGB color space
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Create mesh
  const mesh = await createParallaxMesh(asset);
  scene.add(mesh);

  // Create controller
  const controller = new ParallaxController(mesh, asset.maxTilt, {
    ...options,
    container,
  });

  // Resize handler
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    }
  });
  resizeObserver.observe(container);

  // Animation loop
  let animationId: number | null = null;

  function animate(): void {
    animationId = requestAnimationFrame(animate);
    controller.update();
    renderer.render(scene, camera);
  }

  // Cleanup function
  function dispose(): void {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }
    
    controller.dispose();
    resizeObserver.disconnect();
    
    mesh.geometry.dispose();
    (mesh.material as THREE.MeshBasicMaterial).map?.dispose();
    (mesh.material as THREE.MeshBasicMaterial).dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return {
    scene,
    camera,
    renderer,
    mesh,
    controller,
    animate,
    dispose,
  };
}
