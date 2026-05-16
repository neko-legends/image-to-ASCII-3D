/**
 * ASCII Parallax Binary Format Specification (.aparallax)
 * 
 * A self-contained binary format for 3D parallax ASCII art that can be
 * loaded directly by Three.js without the original source or depth images.
 * 
 * ## Format Overview
 * 
 * The format stores:
 * 1. Pre-rendered ASCII texture (as PNG)
 * 2. Pre-displaced geometry (vertex positions already include depth displacement)
 * 3. Metadata for rendering settings
 * 
 * ## Binary Layout
 * 
 * ```
 * [Header - 32 bytes]
 * ├── Magic:       5 bytes  "APRLX"
 * ├── Version:     1 byte   (currently 1)
 * ├── Flags:       2 bytes  (bitfield: colored, etc.)
 * ├── TexWidth:    4 bytes  uint32 (texture width in pixels)
 * ├── TexHeight:   4 bytes  uint32 (texture height in pixels)
 * ├── SegmentsX:   2 bytes  uint16 (geometry X segments)
 * ├── SegmentsY:   2 bytes  uint16 (geometry Y segments)
 * ├── PlaneWidth:  4 bytes  float32 (plane width in world units)
 * ├── PlaneHeight: 4 bytes  float32 (plane height in world units)
 * ├── MaxTilt:     2 bytes  uint16 (max tilt in degrees)
 * ├── Reserved:    2 bytes  (for future use)
 * 
 * [Texture Section]
 * ├── TexSize:     4 bytes  uint32 (PNG data size)
 * └── TexData:     N bytes  (PNG image data)
 * 
 * [Geometry Section]
 * ├── VertexCount: 4 bytes  uint32
 * ├── Positions:   VertexCount * 3 * 4 bytes (Float32Array x,y,z)
 * └── UVs:         VertexCount * 2 * 4 bytes (Float32Array u,v)
 * ```
 */

/** Magic bytes for file identification */
export const MAGIC = new Uint8Array([0x41, 0x50, 0x52, 0x4C, 0x58]); // "APRLX"

/** Current format version */
export const FORMAT_VERSION = 1;

/** Header size in bytes */
export const HEADER_SIZE = 32;

/** Flag bits */
export const FLAGS = {
  COLORED: 1 << 0,
  // Future flags can use bits 1-15
} as const;

/**
 * Parsed parallax asset data
 */
export interface ParallaxAsset {
  /** Format version */
  version: number;
  
  /** Whether the texture has color (vs monochrome) */
  colored: boolean;
  
  /** Texture dimensions */
  textureWidth: number;
  textureHeight: number;
  
  /** Geometry subdivision */
  segmentsX: number;
  segmentsY: number;
  
  /** Plane dimensions in world units */
  planeWidth: number;
  planeHeight: number;
  
  /** Maximum tilt angle in degrees */
  maxTilt: number;
  
  /** PNG texture data (can be used with THREE.TextureLoader or as Image src) */
  textureData: Uint8Array;
  
  /** Vertex positions (already displaced) */
  positions: Float32Array;
  
  /** UV coordinates */
  uvs: Float32Array;
  
  /** Number of vertices */
  vertexCount: number;
}

/**
 * Options for creating a parallax asset
 */
export interface CreateAssetOptions {
  /** ASCII texture as PNG data */
  textureData: Uint8Array;
  textureWidth: number;
  textureHeight: number;
  
  /** Displaced geometry data */
  positions: Float32Array;
  uvs: Float32Array;
  segmentsX: number;
  segmentsY: number;
  
  /** Plane dimensions in world units */
  planeWidth: number;
  planeHeight: number;
  
  /** Maximum tilt angle in degrees */
  maxTilt: number;
  
  /** Whether texture has color */
  colored: boolean;
}
