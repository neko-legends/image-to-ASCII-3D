/**
 * Parallax asset decoder - loads .aparallax binary files
 */

import {
  MAGIC,
  HEADER_SIZE,
  FLAGS,
  type ParallaxAsset,
} from './format.js';

/**
 * Decode a parallax asset from binary data
 */
export function decodeParallaxAsset(data: ArrayBuffer): ParallaxAsset {
  console.log(`Decoding parallax asset: ${data.byteLength} bytes`);
  
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  
  let offset = 0;

  // --- Header ---
  
  // Verify magic
  const magicBytes = Array.from(bytes.slice(0, 5)).map(b => String.fromCharCode(b)).join('');
  console.log(`Magic bytes: "${magicBytes}" (expected "APRLX")`);
  
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[offset + i] !== MAGIC[i]) {
      throw new Error(`Invalid file format: magic bytes mismatch at position ${i}. Got ${bytes[offset + i]}, expected ${MAGIC[i]}`);
    }
  }
  offset += 5;
  
  // Version
  const version = view.getUint8(offset);
  offset += 1;
  
  if (version !== 1) {
    throw new Error(`Unsupported format version: ${version}`);
  }
  
  // Flags
  const flags = view.getUint16(offset, true);
  offset += 2;
  const colored = (flags & FLAGS.COLORED) !== 0;
  
  // Texture dimensions
  const textureWidth = view.getUint32(offset, true);
  offset += 4;
  const textureHeight = view.getUint32(offset, true);
  offset += 4;
  
  // Segments
  const segmentsX = view.getUint16(offset, true);
  offset += 2;
  const segmentsY = view.getUint16(offset, true);
  offset += 2;
  
  // Plane dimensions
  const planeWidth = view.getFloat32(offset, true);
  offset += 4;
  const planeHeight = view.getFloat32(offset, true);
  offset += 4;
  
  // Max tilt
  const maxTilt = view.getUint16(offset, true);
  offset += 2;
  
  // Reserved
  offset += 2;
  
  // Sanity check
  if (offset !== HEADER_SIZE) {
    throw new Error(`Header read mismatch: expected ${HEADER_SIZE}, at ${offset}`);
  }

  // --- Texture Section ---
  
  const textureSize = view.getUint32(offset, true);
  offset += 4;
  
  console.log(`Header parsed: ${textureWidth}x${textureHeight} texture, ${segmentsX}x${segmentsY} segments, textureSize=${textureSize}`);
  
  const textureData = bytes.slice(offset, offset + textureSize);
  offset += textureSize;

  // --- Geometry Section ---
  
  const vertexCount = view.getUint32(offset, true);
  offset += 4;
  
  const expectedVertexCount = (segmentsX + 1) * (segmentsY + 1);
  console.log(`Geometry: vertexCount=${vertexCount}, expected=${expectedVertexCount}`);
  
  if (vertexCount !== expectedVertexCount) {
    console.warn(`Vertex count mismatch! This may cause rendering issues.`);
  }
  
  const positionsSize = vertexCount * 3 * 4;
  const positions = new Float32Array(data.slice(offset, offset + positionsSize));
  offset += positionsSize;
  
  const uvsSize = vertexCount * 2 * 4;
  const uvs = new Float32Array(data.slice(offset, offset + uvsSize));
  offset += uvsSize;
  
  console.log(`Decoded: positions=${positions.length} floats, uvs=${uvs.length} floats, total read=${offset} bytes`);

  return {
    version,
    colored,
    textureWidth,
    textureHeight,
    segmentsX,
    segmentsY,
    planeWidth,
    planeHeight,
    maxTilt,
    textureData,
    positions,
    uvs,
    vertexCount,
  };
}

/**
 * Load a parallax asset from a URL
 */
export async function loadParallaxAsset(url: string): Promise<ParallaxAsset> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load parallax asset: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return decodeParallaxAsset(buffer);
}
