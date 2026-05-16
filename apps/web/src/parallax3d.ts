/**
 * Three.js based 3D parallax renderer for ASCII art
 * 
 * Renders ASCII to a canvas texture, maps onto a subdivided plane,
 * displaces vertices with depth map, and tilts based on mouse movement.
 * Supports bloom post-processing for glow effects.
 */

import * as THREE from 'three';
import { 
  EffectComposer, 
  RenderPass, 
  BloomEffect, 
  EffectPass, 
  HueSaturationEffect,
  ChromaticAberrationEffect,
  ScanlineEffect,
  NoiseEffect,
  BlendFunction,
} from 'postprocessing';
import type { AsciiFrame, RGBAImage } from '@ascii/core';
import { 
  encodeParallaxAsset, 
  canvasToPngData, 
  decodeParallaxAsset,
  createParallaxMesh,
  type CreateAssetOptions,
  type ParallaxAsset,
} from '@ascii/parallax-reader';

export interface Parallax3DOptions {
  /** Container element to render into */
  container: HTMLElement;
  /** Max rotation angle in degrees */
  maxTilt: number;
  /** Depth displacement strength (0-1) */
  depthStrength: number;
  /** Invert depth map */
  invertDepth: boolean;
  /** Depth smoothing passes (0 = sharp edges, higher = rounder edges) */
  depthSmoothing: number;
  /** Font family for rendering */
  fontFamily: string;
  /** Whether to use color */
  colored: boolean;
}

interface ParallaxState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  mesh: THREE.Mesh;
  targetRotation: { x: number; y: number };
  currentRotation: { x: number; y: number };
  animationId: number | null;
  resizeObserver: ResizeObserver | null;
  mouseMoveHandler: ((e: MouseEvent) => void) | null;
  // Post-processing
  composer: EffectComposer;
  bloomEffect: BloomEffect;
  saturationEffect: HueSaturationEffect;
  chromaticAberrationEffect: ChromaticAberrationEffect;
  scanlineEffect: ScanlineEffect;
  noiseEffect: NoiseEffect;
  // Shader material (for animated effects)
  shaderMaterial: THREE.ShaderMaterial | null;
  startTime: number;
  // Export data
  asciiCanvas: HTMLCanvasElement;
  segmentsX: number;
  segmentsY: number;
  planeWidth: number;
  planeHeight: number;
  maxTilt: number;
  colored: boolean;
}

let state: ParallaxState | null = null;

/**
 * Create animated shader material for ASCII texture
 * Supports: color pulse, UV wave distortion, edge glow, hit effect, death/explosion
 * 
 * Death effect uses fragment-based particle simulation:
 * - Divides texture into grid of cells (each cell = character tile)
 * - Each cell explodes independently with unique velocity
 * - Original colors are preserved (samples from cell's original UV)
 */
function createAsciiShaderMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0.0 },
      // Animation toggles and intensities
      uColorPulseIntensity: { value: 0.0 },  // 0 = off, 0.1-0.3 = subtle
      uColorPulseSpeed: { value: 1.0 },
      uWaveIntensity: { value: 0.0 },        // 0 = off, 0.005-0.02 = subtle
      uWaveSpeed: { value: 2.0 },
      uWaveFrequency: { value: 10.0 },
      uGlowIntensity: { value: 0.0 },        // Edge glow / brightness boost
      uFlickerIntensity: { value: 0.0 },     // Random brightness flicker
      // Hit effect uniforms (triggered, auto-decays)
      uHitTime: { value: -1.0 },             // Time when hit was triggered (-1 = inactive)
      uHitIntensity: { value: 1.0 },         // Overall hit effect strength
      uHitDuration: { value: 0.2 },          // Hit effect duration in seconds
      uHitColor: { value: new THREE.Vector3(1.0, 0.2, 0.1) },
      // Death/explosion uniforms - fragment-based particle system
      uDeathTime: { value: -1.0 },           // Time when death was triggered (-1 = inactive)
      uDeathDuration: { value: 1.5 },        // Total explosion duration
      uDeathExplosionStrength: { value: 0.8 }, // How far particles fly (in UV space)
      uDeathGravity: { value: 0.5 },         // Gravity pull on particles
      uDeathSpread: { value: 1.0 },          // Randomness of explosion directions
      uDeathParticleScale: { value: 0.8 },   // Particle size (1.0 = full cell, <1 = smaller)
      uDeathCenter: { value: new THREE.Vector2(0.5, 0.5) }, // Explosion center (UV space)
      uDeathGridSize: { value: new THREE.Vector2(60.0, 40.0) }, // Number of cells (cols, rows)
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uTexture;
      uniform float uTime;
      uniform float uColorPulseIntensity;
      uniform float uColorPulseSpeed;
      uniform float uWaveIntensity;
      uniform float uWaveSpeed;
      uniform float uWaveFrequency;
      uniform float uGlowIntensity;
      uniform float uFlickerIntensity;
      // Hit effect
      uniform float uHitTime;
      uniform float uHitIntensity;
      uniform float uHitDuration;
      // Death effect
      uniform float uDeathTime;
      uniform float uDeathDuration;
      uniform float uDeathExplosionStrength;
      uniform float uDeathGravity;
      uniform float uDeathSpread;
      uniform float uDeathParticleScale;
      uniform vec2 uDeathCenter;
      uniform vec2 uDeathGridSize;
      
      varying vec2 vUv;
      
      // High quality random functions
      float random(vec2 st) {
        return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      vec2 random2(vec2 st) {
        return vec2(
          fract(sin(dot(st, vec2(127.1, 311.7))) * 43758.5453123),
          fract(sin(dot(st, vec2(269.5, 183.3))) * 43758.5453123)
        );
      }
      
      void main() {
        vec2 uv = vUv;
        float alpha = 1.0;
        
        // Calculate hit progress (0 = just hit, 1 = effect done)
        float hitProgress = 1.0;
        if (uHitTime >= 0.0) {
          float hitElapsed = uTime - uHitTime;
          hitProgress = clamp(hitElapsed / uHitDuration, 0.0, 1.0);
        }
        
        // Hit effect: UV distortion (shake/wobble)
        if (hitProgress < 1.0) {
          float hitStrength = (1.0 - hitProgress) * uHitIntensity;
          float shake = sin(uTime * 60.0) * hitStrength * 0.02;
          float shake2 = cos(uTime * 45.0) * hitStrength * 0.015;
          uv.x += shake;
          uv.y += shake2;
        }
        
        // ========================================
        // Death/Explosion Effect - Fragment Particles
        // ========================================
        vec2 originalUv = uv; // Store for color sampling
        float deathAlpha = 1.0;
        
        if (uDeathTime >= 0.0) {
          float elapsed = uTime - uDeathTime;
          float progress = clamp(elapsed / uDeathDuration, 0.0, 1.0);
          
          if (progress > 0.0 && progress < 1.0) {
            // Determine which cell/tile this pixel belongs to
            vec2 cellId = floor(uv * uDeathGridSize);
            vec2 cellUv = fract(uv * uDeathGridSize); // Position within cell (0-1)
            
            // Get random values for this cell (deterministic per cell)
            vec2 cellRand = random2(cellId);
            float cellRand1 = random(cellId + 0.5);
            float cellRand2 = random(cellId + 1.5);
            
            // Cell center in UV space
            vec2 cellCenterUv = (cellId + 0.5) / uDeathGridSize;
            
            // Direction from explosion center to this cell
            vec2 toCell = cellCenterUv - uDeathCenter;
            float distFromCenter = length(toCell);
            vec2 baseDir = distFromCenter > 0.001 ? normalize(toCell) : vec2(0.0);
            
            // Add randomness to direction (spread)
            float angle = atan(baseDir.y, baseDir.x);
            angle += (cellRand.x - 0.5) * 3.14159 * uDeathSpread;
            vec2 explodeDir = vec2(cos(angle), sin(angle));
            
            // Stagger start time based on distance from center (closer = earlier)
            float staggerDelay = distFromCenter * 0.3;
            float cellProgress = clamp((progress - staggerDelay) / (1.0 - staggerDelay), 0.0, 1.0);
            
            if (cellProgress > 0.0) {
              // Velocity varies per cell
              float speed = uDeathExplosionStrength * (0.5 + cellRand1 * 1.0);
              
              // Explosion movement (ease out)
              float moveCurve = 1.0 - pow(1.0 - cellProgress, 2.0);
              vec2 offset = explodeDir * moveCurve * speed;
              
              // Apply gravity (accelerates over time)
              offset.y -= cellProgress * cellProgress * uDeathGravity;
              
              // Calculate where this cell has moved to
              vec2 movedCellCenter = cellCenterUv + offset;
              
              // Transform current UV to sample from original cell position
              // We need to reverse the transformation: where would this pixel have come from?
              vec2 localOffset = uv - movedCellCenter;
              
              // Particle shrinking over time
              float particleSize = uDeathParticleScale * (1.0 - cellProgress * 0.5);
              localOffset /= particleSize;
              
              // Rotation per particle
              float rotation = elapsed * (cellRand2 - 0.5) * 8.0;
              float c = cos(rotation);
              float s = sin(rotation);
              localOffset = vec2(
                localOffset.x * c - localOffset.y * s,
                localOffset.x * s + localOffset.y * c
              );
              
              // Check if this pixel is within the moved/rotated cell bounds
              vec2 cellSize = 1.0 / uDeathGridSize;
              vec2 halfCell = cellSize * 0.5 * particleSize;
              
              if (abs(localOffset.x) < halfCell.x && abs(localOffset.y) < halfCell.y) {
                // Inside a particle! Sample from original cell position
                vec2 sampleUv = cellCenterUv + localOffset;
                sampleUv = clamp(sampleUv, vec2(0.0), vec2(1.0));
                originalUv = sampleUv;
                
                // Fade out over time
                deathAlpha = 1.0 - smoothstep(0.4, 1.0, cellProgress);
                
                // Particles near edge fade faster (gives torn edge look)
                float edgeDist = max(abs(localOffset.x) / halfCell.x, abs(localOffset.y) / halfCell.y);
                deathAlpha *= 1.0 - smoothstep(0.7, 1.0, edgeDist);
              } else {
                // Outside all particles - transparent
                deathAlpha = 0.0;
              }
            }
          } else if (progress >= 1.0) {
            // Animation complete - fully transparent
            deathAlpha = 0.0;
          }
        }
        
        // UV wave distortion (ambient effect) - apply after death transform
        if (uWaveIntensity > 0.0 && deathAlpha > 0.0) {
          float wave = sin(originalUv.y * uWaveFrequency + uTime * uWaveSpeed) * uWaveIntensity;
          originalUv.x += wave;
          float wave2 = sin(originalUv.x * uWaveFrequency * 0.7 + uTime * uWaveSpeed * 0.8) * uWaveIntensity * 0.5;
          originalUv.y += wave2;
        }
        
        // Sample texture from original UV (preserves colors!)
        vec4 texColor = texture2D(uTexture, originalUv);
        vec3 color = texColor.rgb;
        
        // Hit effect: chromatic aberration spike (no color flash)
        if (hitProgress < 1.0) {
          float hitStrength = (1.0 - hitProgress) * uHitIntensity;
          vec2 caOffset = vec2(hitStrength * 0.015, 0.0);
          vec3 caColor;
          caColor.r = texture2D(uTexture, originalUv + caOffset).r;
          caColor.g = texture2D(uTexture, originalUv).g;
          caColor.b = texture2D(uTexture, originalUv - caOffset).b;
          color = mix(color, caColor, hitStrength * 0.7);
        }
        
        // Color pulse (shifts hue/brightness over time)
        if (uColorPulseIntensity > 0.0) {
          float pulse = sin(uTime * uColorPulseSpeed) * 0.5 + 0.5;
          color.r += pulse * uColorPulseIntensity * 0.3;
          color.g += (1.0 - pulse) * uColorPulseIntensity * 0.2;
          color.b += pulse * uColorPulseIntensity * 0.4;
          color *= 1.0 + (pulse - 0.5) * uColorPulseIntensity;
        }
        
        // Flicker effect (random brightness variation)
        if (uFlickerIntensity > 0.0) {
          float flicker = random(vec2(floor(uTime * 30.0), floor(vUv.y * 100.0)));
          color *= 1.0 + (flicker - 0.5) * uFlickerIntensity;
        }
        
        // Glow/brightness boost
        if (uGlowIntensity > 0.0) {
          float luminance = dot(color, vec3(0.299, 0.587, 0.114));
          color += color * luminance * uGlowIntensity;
        }
        
        // Apply death alpha (fragment particle system handles color preservation)
        alpha *= deathAlpha;
        
        // Discard fully transparent pixels for performance
        if (alpha < 0.01) discard;
        
        gl_FragColor = vec4(color, texColor.a * alpha);
      }
    `,
    transparent: true,
  });
}

/**
 * Initialize 3D parallax scene
 */
export function initParallax3D(
  frame: AsciiFrame,
  depthMap: RGBAImage,
  options: Parallax3DOptions
): void {
  // Clean up any existing scene
  destroyParallax3D();

  const { container, maxTilt, depthStrength, invertDepth, depthSmoothing, fontFamily, colored } = options;

  // Create ASCII texture with proper color space
  const asciiCanvas = renderAsciiToCanvas(frame, fontFamily, colored);
  const asciiTexture = new THREE.CanvasTexture(asciiCanvas);
  asciiTexture.minFilter = THREE.LinearFilter;
  asciiTexture.magFilter = THREE.LinearFilter;
  // Canvas data is already sRGB, tell Three.js not to convert it again
  asciiTexture.colorSpace = THREE.SRGBColorSpace;

  // Create depth canvas for vertex displacement (with optional smoothing)
  let depthCanvas = createDepthCanvas(depthMap, invertDepth);
  if (depthSmoothing > 0) {
    depthCanvas = smoothDepthCanvas(depthCanvas, depthSmoothing);
  }

  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Calculate aspect ratio from ASCII canvas
  const aspect = asciiCanvas.width / asciiCanvas.height;

  // Camera - positioned to see the plane nicely
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.z = 2.5;

  // Renderer with proper color management
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Fix washed out colors: output in sRGB color space
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Create displaced plane geometry
  // More segments = smoother depth displacement
  const segmentsX = Math.min(256, frame.cols);
  const segmentsY = Math.min(256, frame.rows);
  const geometry = new THREE.PlaneGeometry(aspect * 2, 2, segmentsX, segmentsY);

  // Displace vertices based on depth map
  displaceGeometry(geometry, depthCanvas, depthStrength);

  // Use custom shader material for animated effects
  const shaderMaterial = createAsciiShaderMaterial(asciiTexture);

  const mesh = new THREE.Mesh(geometry, shaderMaterial);
  scene.add(mesh);
  
  const startTime = performance.now();

  // Mouse tracking state
  const targetRotation = { x: 0, y: 0 };
  const currentRotation = { x: 0, y: 0 };
  const maxTiltRad = THREE.MathUtils.degToRad(maxTilt);

  // Mouse move handler
  const mouseMoveHandler = (e: MouseEvent): void => {
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Normalized mouse position (-1 to 1)
    const normalizedX = (e.clientX - centerX) / (rect.width / 2);
    const normalizedY = (e.clientY - centerY) / (rect.height / 2);

    // Clamp and apply to target rotation
    targetRotation.y = THREE.MathUtils.clamp(normalizedX, -1, 1) * maxTiltRad;
    targetRotation.x = THREE.MathUtils.clamp(-normalizedY, -1, 1) * maxTiltRad;
  };

  document.addEventListener('mousemove', mouseMoveHandler);

  // Set up post-processing with bloom
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  
  // Bloom effect (starts disabled with intensity 0)
  const bloomEffect = new BloomEffect({
    intensity: 0,
    luminanceThreshold: 0.5,
    luminanceSmoothing: 0.3,
    mipmapBlur: true,
  });
  
  // Saturation effect (default 100% = no change)
  const saturationEffect = new HueSaturationEffect({
    saturation: 0, // 0 = no change, -1 = grayscale, 1 = double saturation
  });
  
  // Chromatic Aberration - RGB split effect (starts disabled)
  const chromaticAberrationEffect = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0, 0), // Will be set via controls
    radialModulation: false,
    modulationOffset: 0.15,
  });
  
  // Scanlines - CRT monitor effect (starts disabled)
  const scanlineEffect = new ScanlineEffect({
    blendFunction: BlendFunction.MULTIPLY,
    density: 1.5, // Lines per pixel
  });
  scanlineEffect.blendMode.opacity.value = 0; // Start disabled
  
  // Noise/Film grain effect (starts disabled)
  const noiseEffect = new NoiseEffect({
    blendFunction: BlendFunction.OVERLAY,
    premultiply: true,
  });
  noiseEffect.blendMode.opacity.value = 0; // Start disabled
  
  const effectPass = new EffectPass(
    camera, 
    bloomEffect, 
    saturationEffect,
    chromaticAberrationEffect,
    scanlineEffect,
    noiseEffect
  );
  composer.addPass(effectPass);

  // Resize handler
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        composer.setSize(width, height);
      }
    }
  });
  resizeObserver.observe(container);

  // Animation loop
  let animationId: number | null = null;

  function animate(): void {
    animationId = requestAnimationFrame(animate);

    // Smooth interpolation
    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.08;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.08;

    // Apply rotation to mesh
    mesh.rotation.x = currentRotation.x;
    mesh.rotation.y = currentRotation.y;
    
    // Update shader time uniform for animations
    const elapsed = (performance.now() - startTime) / 1000;
    shaderMaterial.uniforms.uTime.value = elapsed;

    // Render with post-processing
    composer.render();
  }

  animationId = requestAnimationFrame(animate);

  // Store state for cleanup and export
  const planeWidth = aspect * 2;
  const planeHeight = 2;
  
  state = {
    scene,
    camera,
    renderer,
    mesh,
    targetRotation,
    currentRotation,
    animationId,
    resizeObserver,
    mouseMoveHandler,
    // Post-processing
    composer,
    bloomEffect,
    saturationEffect,
    chromaticAberrationEffect,
    scanlineEffect,
    noiseEffect,
    // Shader material
    shaderMaterial,
    startTime,
    // Export data
    asciiCanvas,
    segmentsX,
    segmentsY,
    planeWidth,
    planeHeight,
    maxTilt,
    colored,
  };
}

/**
 * Clean up Three.js resources
 */
export function destroyParallax3D(): void {
  if (!state) return;

  // Stop animation
  if (state.animationId !== null) {
    cancelAnimationFrame(state.animationId);
  }

  // Remove event listeners
  if (state.mouseMoveHandler) {
    document.removeEventListener('mousemove', state.mouseMoveHandler);
  }

  // Stop observing
  if (state.resizeObserver) {
    state.resizeObserver.disconnect();
  }

  // Dispose Three.js resources
  state.mesh.geometry.dispose();
  if (state.shaderMaterial) {
    state.shaderMaterial.uniforms.uTexture.value?.dispose();
    state.shaderMaterial.dispose();
  } else {
    (state.mesh.material as THREE.MeshBasicMaterial).map?.dispose();
    (state.mesh.material as THREE.MeshBasicMaterial).dispose();
  }
  state.composer.dispose();
  state.renderer.dispose();

  // Remove canvas from DOM
  state.renderer.domElement.remove();

  state = null;
}

/**
 * Check if parallax is currently active
 */
export function isParallaxActive(): boolean {
  return state !== null;
}

/**
 * Render ASCII frame to a canvas for use as texture
 */
function renderAsciiToCanvas(
  frame: AsciiFrame,
  fontFamily: string,
  colored: boolean
): HTMLCanvasElement {
  const cells = frame.cells as Array<{ glyph: string; fg: { r: number; g: number; b: number } }>;

  // Calculate dimensions - use a reasonable font size for texture
  const fontSize = 14;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Measure character dimensions
  ctx.font = `${fontSize}px "${fontFamily}", monospace`;
  const charWidth = ctx.measureText('M').width;
  const charHeight = fontSize * 1.2;

  // Set canvas size
  canvas.width = Math.ceil(frame.cols * charWidth);
  canvas.height = Math.ceil(frame.rows * charHeight);

  // Fill background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render characters
  ctx.font = `${fontSize}px "${fontFamily}", monospace`;
  ctx.textBaseline = 'top';

  for (let y = 0; y < frame.rows; y++) {
    for (let x = 0; x < frame.cols; x++) {
      const idx = y * frame.cols + x;
      const cell = cells[idx];

      if (!cell || cell.glyph === ' ') continue;

      if (colored) {
        const { r, g, b } = cell.fg;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = '#00ff00'; // Classic green
      }

      ctx.fillText(cell.glyph, x * charWidth, y * charHeight);
    }
  }

  return canvas;
}

/**
 * Create a depth canvas from RGBAImage
 */
function createDepthCanvas(depthMap: RGBAImage, invert: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = depthMap.width;
  canvas.height = depthMap.height;

  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(depthMap.width, depthMap.height);

  for (let i = 0; i < depthMap.data.length; i += 4) {
    // Convert to grayscale
    const r = depthMap.data[i];
    const g = depthMap.data[i + 1];
    const b = depthMap.data[i + 2];
    let gray = (r + g + b) / 3;

    if (invert) {
      gray = 255 - gray;
    }

    imageData.data[i] = gray;
    imageData.data[i + 1] = gray;
    imageData.data[i + 2] = gray;
    imageData.data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Apply Gaussian-like smoothing to the depth canvas.
 * This creates rounder, softer edges instead of sharp depth transitions.
 * @param canvas - The depth canvas to smooth
 * @param passes - Number of blur passes (higher = smoother)
 */
function smoothDepthCanvas(canvas: HTMLCanvasElement, passes: number): HTMLCanvasElement {
  const width = canvas.width;
  const height = canvas.height;
  
  // Create output canvas
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const outCtx = output.getContext('2d')!;
  
  // Use CSS blur filter for efficient smoothing
  // Each pass applies a small blur; multiple passes create stronger smoothing
  const blurRadius = Math.max(1, Math.min(passes, 20));
  
  outCtx.filter = `blur(${blurRadius}px)`;
  outCtx.drawImage(canvas, 0, 0);
  
  // Reset filter and draw again to ensure edges are filled
  // (blur can cause edge artifacts)
  outCtx.filter = 'none';
  
  return output;
}

/**
 * Displace plane geometry vertices based on depth map
 */
function displaceGeometry(
  geometry: THREE.PlaneGeometry,
  depthCanvas: HTMLCanvasElement,
  strength: number
): void {
  const ctx = depthCanvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, depthCanvas.width, depthCanvas.height);
  const depthData = imageData.data;

  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;

  for (let i = 0; i < positions.count; i++) {
    const u = uvs.getX(i);
    const v = uvs.getY(i);

    // Sample depth at UV coordinate
    const x = Math.floor(u * (depthCanvas.width - 1));
    const y = Math.floor((1 - v) * (depthCanvas.height - 1)); // Flip Y

    const pixelIdx = (y * depthCanvas.width + x) * 4;
    const depth = depthData[pixelIdx] / 255; // Normalized 0-1

    // Displace Z based on depth
    const z = positions.getZ(i);
    positions.setZ(i, z + depth * strength);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * Export the current parallax scene to a self-contained .aparallax binary file.
 * The resulting file can be loaded with @ascii/parallax-reader without needing
 * the original source or depth images.
 */
export async function exportParallaxAsset(): Promise<ArrayBuffer | null> {
  if (!state) {
    console.warn('No active parallax scene to export');
    return null;
  }

  // Get the geometry data (already displaced)
  const geometry = state.mesh.geometry as THREE.BufferGeometry;
  const posAttr = geometry.attributes.position;
  const uvAttr = geometry.attributes.uv;
  
  if (!posAttr || !uvAttr) {
    console.error('Geometry missing position or uv attributes');
    return null;
  }
  
  const positions = posAttr.array as Float32Array;
  const uvs = uvAttr.array as Float32Array;
  
  // Validate geometry
  const expectedVertexCount = (state.segmentsX + 1) * (state.segmentsY + 1);
  const actualVertexCount = positions.length / 3;
  
  console.log(`Export: segments=${state.segmentsX}x${state.segmentsY}, expected vertices=${expectedVertexCount}, actual=${actualVertexCount}`);
  console.log(`Positions: ${positions.length} floats, UVs: ${uvs.length} floats`);
  
  if (actualVertexCount !== expectedVertexCount) {
    console.warn(`Vertex count mismatch: expected ${expectedVertexCount}, got ${actualVertexCount}`);
  }

  // Convert ASCII canvas to PNG data
  const textureData = await canvasToPngData(state.asciiCanvas);
  console.log(`Texture: ${state.asciiCanvas.width}x${state.asciiCanvas.height}, PNG size: ${textureData.byteLength} bytes`);

  // Build the asset options - create copies to ensure we own the buffers
  const positionsCopy = new Float32Array(positions.length);
  positionsCopy.set(positions);
  
  const uvsCopy = new Float32Array(uvs.length);
  uvsCopy.set(uvs);

  const assetOptions: CreateAssetOptions = {
    textureData,
    textureWidth: state.asciiCanvas.width,
    textureHeight: state.asciiCanvas.height,
    positions: positionsCopy,
    uvs: uvsCopy,
    segmentsX: state.segmentsX,
    segmentsY: state.segmentsY,
    planeWidth: state.planeWidth,
    planeHeight: state.planeHeight,
    maxTilt: state.maxTilt,
    colored: state.colored,
  };

  // Encode to binary
  const result = encodeParallaxAsset(assetOptions);
  console.log(`Encoded parallax asset: ${result.byteLength} bytes`);
  return result;
}

/**
 * Download the current parallax scene as a .aparallax file
 */
export async function downloadParallaxAsset(filename: string = 'parallax-ascii.aparallax'): Promise<void> {
  const buffer = await exportParallaxAsset();
  if (!buffer) return;

  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Set the zoom level (camera distance) for the parallax scene
 * @param zoomPercent - Zoom percentage (100 = default, >100 = closer, <100 = farther)
 */
export function setParallaxZoom(zoomPercent: number): void {
  if (!state) return;
  
  // Default camera z is 2.5
  // 100% = 2.5, 200% = 1.25, 50% = 5.0
  const defaultZ = 2.5;
  const newZ = defaultZ / (zoomPercent / 100);
  state.camera.position.z = newZ;
}

/**
 * Get current zoom level
 */
export function getParallaxZoom(): number {
  if (!state) return 100;
  const defaultZ = 2.5;
  return (defaultZ / state.camera.position.z) * 100;
}

/**
 * Set bloom intensity
 * @param intensity - Bloom intensity (0 = off, 100 = moderate, 300 = strong)
 */
export function setBloomIntensity(intensity: number): void {
  if (!state) return;
  state.bloomEffect.intensity = intensity / 100;
}

/**
 * Set bloom luminance threshold
 * @param threshold - Percentage (0-100), lower = more pixels bloom
 */
export function setBloomThreshold(threshold: number): void {
  if (!state) return;
  state.bloomEffect.luminanceMaterial.threshold = threshold / 100;
}

/**
 * Set bloom radius (blur spread)
 * @param radius - Percentage (0-100)
 */
export function setBloomRadius(radius: number): void {
  if (!state) return;
  // The BloomEffect uses mipmapBlur, radius affects the blur kernel
  state.bloomEffect.mipmapBlurPass.radius = radius / 100;
}

/**
 * Get current bloom settings
 */
export function getBloomSettings(): { intensity: number; threshold: number; radius: number } {
  if (!state) return { intensity: 0, threshold: 50, radius: 50 };
  return {
    intensity: state.bloomEffect.intensity * 100,
    threshold: state.bloomEffect.luminanceMaterial.threshold * 100,
    radius: state.bloomEffect.mipmapBlurPass.radius * 100,
  };
}

/**
 * Set saturation level
 * @param saturation - Percentage (0 = grayscale, 100 = normal, 200 = double saturation)
 */
export function setSaturation(saturation: number): void {
  if (!state) return;
  // Convert 0-200% to -1 to 1 range (100% = 0 = no change)
  state.saturationEffect.saturation = (saturation - 100) / 100;
}

/**
 * Get current saturation level
 */
export function getSaturation(): number {
  if (!state) return 100;
  // Convert -1 to 1 range back to 0-200%
  return (state.saturationEffect.saturation + 1) * 100;
}

// ============================================================================
// Chromatic Aberration Effect Controls
// ============================================================================

/**
 * Set chromatic aberration intensity (RGB split)
 * @param intensity - 0 = off, 100 = moderate, 200 = strong
 */
export function setChromaticAberration(intensity: number): void {
  if (!state) return;
  const offset = (intensity / 100) * 0.01; // Max offset of 0.02
  state.chromaticAberrationEffect.offset.set(offset, offset);
}

/**
 * Get current chromatic aberration intensity
 */
export function getChromaticAberration(): number {
  if (!state) return 0;
  return (state.chromaticAberrationEffect.offset.x / 0.01) * 100;
}

// ============================================================================
// Scanlines Effect Controls
// ============================================================================

/**
 * Set scanlines intensity
 * @param intensity - 0 = off, 50 = subtle, 100 = strong
 */
export function setScanlines(intensity: number): void {
  if (!state) return;
  state.scanlineEffect.blendMode.opacity.value = intensity / 100;
}

/**
 * Get current scanlines intensity
 */
export function getScanlines(): number {
  if (!state) return 0;
  return state.scanlineEffect.blendMode.opacity.value * 100;
}

/**
 * Set scanlines density (lines per pixel)
 * @param density - 0.5 = sparse, 1.5 = default, 3 = dense
 */
export function setScanlinesDensity(density: number): void {
  if (!state) return;
  state.scanlineEffect.density = density;
}

// ============================================================================
// Noise/Film Grain Effect Controls
// ============================================================================

/**
 * Set noise/film grain intensity
 * @param intensity - 0 = off, 30 = subtle, 100 = strong
 */
export function setNoise(intensity: number): void {
  if (!state) return;
  state.noiseEffect.blendMode.opacity.value = intensity / 100;
}

/**
 * Get current noise intensity
 */
export function getNoise(): number {
  if (!state) return 0;
  return state.noiseEffect.blendMode.opacity.value * 100;
}

// ============================================================================
// Shader Animation Controls (Color Pulse, UV Wave, Flicker, Glow)
// ============================================================================

/**
 * Set color pulse animation intensity
 * @param intensity - 0 = off, 30 = subtle, 100 = strong
 */
export function setColorPulse(intensity: number): void {
  if (!state?.shaderMaterial) return;
  state.shaderMaterial.uniforms.uColorPulseIntensity.value = intensity / 100;
}

/**
 * Get current color pulse intensity
 */
export function getColorPulse(): number {
  if (!state?.shaderMaterial) return 0;
  return state.shaderMaterial.uniforms.uColorPulseIntensity.value * 100;
}

/**
 * Set UV wave distortion intensity
 * @param intensity - 0 = off, 50 = subtle, 100 = strong
 */
export function setWaveDistortion(intensity: number): void {
  if (!state?.shaderMaterial) return;
  // Map 0-100 to 0-0.02 (subtle range)
  state.shaderMaterial.uniforms.uWaveIntensity.value = (intensity / 100) * 0.02;
}

/**
 * Get current wave distortion intensity
 */
export function getWaveDistortion(): number {
  if (!state?.shaderMaterial) return 0;
  return (state.shaderMaterial.uniforms.uWaveIntensity.value / 0.02) * 100;
}

/**
 * Set flicker intensity (random brightness variation)
 * @param intensity - 0 = off, 30 = subtle, 100 = strong
 */
export function setFlicker(intensity: number): void {
  if (!state?.shaderMaterial) return;
  state.shaderMaterial.uniforms.uFlickerIntensity.value = intensity / 100;
}

/**
 * Get current flicker intensity
 */
export function getFlicker(): number {
  if (!state?.shaderMaterial) return 0;
  return state.shaderMaterial.uniforms.uFlickerIntensity.value * 100;
}

/**
 * Set glow intensity (brightness boost for bright areas)
 * @param intensity - 0 = off, 50 = subtle, 100 = strong
 */
export function setGlow(intensity: number): void {
  if (!state?.shaderMaterial) return;
  state.shaderMaterial.uniforms.uGlowIntensity.value = intensity / 100;
}

/**
 * Get current glow intensity
 */
export function getGlow(): number {
  if (!state?.shaderMaterial) return 0;
  return state.shaderMaterial.uniforms.uGlowIntensity.value * 100;
}

// ============================================================================
// Hit Effect (Game Damage Feedback)
// ============================================================================

export interface HitEffectOptions {
  /** Intensity multiplier (default 1.0) */
  intensity?: number;
  /** Duration in seconds (default 0.2) */
  duration?: number;
  /** Flash color as [r, g, b] 0-1 (default: red/orange [1, 0.2, 0.1]) */
  color?: [number, number, number];
}

/**
 * Trigger a hit/damage effect - auto-decaying flash + shake + chromatic spike
 * Call this when the player/enemy takes damage
 * 
 * @example
 * // Basic hit
 * triggerHit();
 * 
 * // Strong hit with custom color
 * triggerHit({ intensity: 1.5, color: [1, 1, 0] }); // Yellow flash
 * 
 * // Quick weak hit
 * triggerHit({ intensity: 0.5, duration: 0.1 });
 */
export function triggerHit(options: HitEffectOptions = {}): void {
  if (!state?.shaderMaterial) return;
  
  const {
    intensity = 1.0,
    duration = 0.2,
    color = [1.0, 0.2, 0.1],
  } = options;
  
  const uniforms = state.shaderMaterial.uniforms;
  uniforms.uHitTime.value = uniforms.uTime.value; // Trigger from current time
  uniforms.uHitIntensity.value = intensity;
  uniforms.uHitDuration.value = duration;
  uniforms.uHitColor.value.set(color[0], color[1], color[2]);
}

/**
 * Check if hit effect is currently active
 */
export function isHitActive(): boolean {
  if (!state?.shaderMaterial) return false;
  const uniforms = state.shaderMaterial.uniforms;
  if (uniforms.uHitTime.value < 0) return false;
  const elapsed = uniforms.uTime.value - uniforms.uHitTime.value;
  return elapsed < uniforms.uHitDuration.value;
}

/**
 * Cancel/reset hit effect immediately
 */
export function resetHit(): void {
  if (!state?.shaderMaterial) return;
  state.shaderMaterial.uniforms.uHitTime.value = -1.0;
}

// ============================================================================
// Death/Explosion Effect (Game Death Animation)
// ============================================================================

export interface DeathEffectOptions {
  /** Explosion strength - how far particles fly in UV space (default 0.8) */
  explosionStrength?: number;
  /** Duration in seconds (default 1.5) */
  duration?: number;
  /** Gravity pull on particles (default 0.5) */
  gravity?: number;
  /** Randomness of explosion directions 0-1 (default 1.0) */
  spread?: number;
  /** Particle size relative to cell (default 0.8, smaller = more "debris" look) */
  particleScale?: number;
  /** Explosion center in UV space [x, y] 0-1 (default [0.5, 0.5] = center) */
  center?: [number, number];
  /** Grid size [cols, rows] - more = smaller particles (default auto from frame) */
  gridSize?: [number, number];
}

/**
 * Trigger death/explosion effect - characters break apart as individual particles
 * Each particle keeps its original color and flies outward
 * 
 * @example
 * // Basic death explosion
 * triggerDeath();
 * 
 * // Big dramatic explosion with lots of small particles
 * triggerDeath({ explosionStrength: 1.2, gridSize: [80, 50] });
 * 
 * // Explosion from hit point (left side)
 * triggerDeath({ center: [0.2, 0.5] });
 * 
 * // Quick disintegration (less force, smaller particles)
 * triggerDeath({ explosionStrength: 0.3, particleScale: 0.5, duration: 0.8 });
 * 
 * // Chaotic scatter (high spread)
 * triggerDeath({ spread: 1.5, gravity: 0.2 });
 */
export function triggerDeath(options: DeathEffectOptions = {}): void {
  if (!state?.shaderMaterial) return;
  
  const {
    explosionStrength = 0.8,
    duration = 1.5,
    gravity = 0.5,
    spread = 1.0,
    particleScale = 0.8,
    center = [0.5, 0.5],
    gridSize,
  } = options;
  
  const uniforms = state.shaderMaterial.uniforms;
  uniforms.uDeathTime.value = uniforms.uTime.value; // Trigger from current time
  uniforms.uDeathDuration.value = duration;
  uniforms.uDeathExplosionStrength.value = explosionStrength;
  uniforms.uDeathGravity.value = gravity;
  uniforms.uDeathSpread.value = spread;
  uniforms.uDeathParticleScale.value = particleScale;
  uniforms.uDeathCenter.value.set(center[0], center[1]);
  
  // Set grid size (default to stored segment count or 60x40)
  if (gridSize) {
    uniforms.uDeathGridSize.value.set(gridSize[0], gridSize[1]);
  } else {
    // Use stored ASCII dimensions if available
    const cols = state.segmentsX || 60;
    const rows = state.segmentsY || 40;
    uniforms.uDeathGridSize.value.set(cols, rows);
  }
}

/**
 * Check if death effect is currently active
 */
export function isDeathActive(): boolean {
  if (!state?.shaderMaterial) return false;
  const uniforms = state.shaderMaterial.uniforms;
  if (uniforms.uDeathTime.value < 0) return false;
  const elapsed = uniforms.uTime.value - uniforms.uDeathTime.value;
  return elapsed < uniforms.uDeathDuration.value;
}

/**
 * Get death animation progress (0-1, or -1 if not active)
 */
export function getDeathProgress(): number {
  if (!state?.shaderMaterial) return -1;
  const uniforms = state.shaderMaterial.uniforms;
  if (uniforms.uDeathTime.value < 0) return -1;
  const elapsed = uniforms.uTime.value - uniforms.uDeathTime.value;
  return Math.min(1, elapsed / uniforms.uDeathDuration.value);
}

/**
 * Cancel/reset death effect immediately (restores original state)
 */
export function resetDeath(): void {
  if (!state?.shaderMaterial) return;
  state.shaderMaterial.uniforms.uDeathTime.value = -1.0;
}

/**
 * Convenience: trigger both hit and death together (for one-shot kills)
 */
export function triggerKill(hitOptions?: HitEffectOptions, deathOptions?: DeathEffectOptions): void {
  triggerHit({ intensity: 1.5, duration: 0.15, ...hitOptions });
  // Slight delay before explosion starts
  setTimeout(() => {
    triggerDeath(deathOptions);
  }, 50);
}

/**
 * Load and display a parallax scene from an imported .aparallax file
 */
export async function importParallaxAsset(
  buffer: ArrayBuffer,
  container: HTMLElement
): Promise<ParallaxAsset> {
  // Clean up any existing scene
  destroyParallax3D();

  // Decode the asset
  const asset = decodeParallaxAsset(buffer);

  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.z = 2.5;

  // Renderer with proper color management
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Fix washed out colors: output in sRGB color space
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Create mesh from imported asset
  // Cast to THREE.Mesh to handle version differences between packages
  const mesh = await createParallaxMesh(asset) as unknown as THREE.Mesh;
  scene.add(mesh);

  // Mouse tracking state
  const targetRotation = { x: 0, y: 0 };
  const currentRotation = { x: 0, y: 0 };
  const maxTiltRad = THREE.MathUtils.degToRad(asset.maxTilt);

  // Mouse move handler
  const mouseMoveHandler = (e: MouseEvent): void => {
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const normalizedX = (e.clientX - centerX) / (rect.width / 2);
    const normalizedY = (e.clientY - centerY) / (rect.height / 2);

    targetRotation.y = THREE.MathUtils.clamp(normalizedX, -1, 1) * maxTiltRad;
    targetRotation.x = THREE.MathUtils.clamp(-normalizedY, -1, 1) * maxTiltRad;
  };

  document.addEventListener('mousemove', mouseMoveHandler);

  // Set up post-processing with bloom
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  
  const bloomEffect = new BloomEffect({
    intensity: 0,
    luminanceThreshold: 0.5,
    luminanceSmoothing: 0.3,
    mipmapBlur: true,
  });
  
  // Saturation effect (default 100% = no change)
  const saturationEffect = new HueSaturationEffect({
    saturation: 0, // 0 = no change, -1 = grayscale, 1 = double saturation
  });
  
  // Chromatic Aberration - RGB split effect (starts disabled)
  const chromaticAberrationEffect = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0, 0),
    radialModulation: false,
    modulationOffset: 0.15,
  });
  
  // Scanlines - CRT monitor effect (starts disabled)
  const scanlineEffect = new ScanlineEffect({
    blendFunction: BlendFunction.MULTIPLY,
    density: 1.5,
  });
  scanlineEffect.blendMode.opacity.value = 0;
  
  // Noise/Film grain effect (starts disabled)
  const noiseEffect = new NoiseEffect({
    blendFunction: BlendFunction.OVERLAY,
    premultiply: true,
  });
  noiseEffect.blendMode.opacity.value = 0;
  
  const effectPass = new EffectPass(
    camera, 
    bloomEffect, 
    saturationEffect,
    chromaticAberrationEffect,
    scanlineEffect,
    noiseEffect
  );
  composer.addPass(effectPass);

  // Resize handler
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        composer.setSize(width, height);
      }
    }
  });
  resizeObserver.observe(container);

  // Animation loop
  let animationId: number | null = null;

  function animate(): void {
    animationId = requestAnimationFrame(animate);

    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.08;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.08;

    mesh.rotation.x = currentRotation.x;
    mesh.rotation.y = currentRotation.y;

    composer.render();
  }

  animationId = requestAnimationFrame(animate);

  // Create a dummy canvas for export compatibility (not available for imported assets)
  const dummyCanvas = document.createElement('canvas');
  dummyCanvas.width = asset.textureWidth;
  dummyCanvas.height = asset.textureHeight;

  // Store state
  state = {
    scene,
    camera,
    renderer,
    mesh,
    targetRotation,
    currentRotation,
    animationId,
    resizeObserver,
    mouseMoveHandler,
    composer,
    bloomEffect,
    saturationEffect,
    chromaticAberrationEffect,
    scanlineEffect,
    noiseEffect,
    shaderMaterial: null, // Imported assets use basic material
    startTime: performance.now(),
    asciiCanvas: dummyCanvas,
    segmentsX: asset.segmentsX,
    segmentsY: asset.segmentsY,
    planeWidth: asset.planeWidth,
    planeHeight: asset.planeHeight,
    maxTilt: asset.maxTilt,
    colored: asset.colored,
  };

  return asset;
}
