/**
 * Parallax asset encoder - creates .aparallax binary files
 */

import {
  MAGIC,
  FORMAT_VERSION,
  HEADER_SIZE,
  FLAGS,
  type CreateAssetOptions,
} from './format.js';

/**
 * Encode a parallax asset to binary format
 */
export function encodeParallaxAsset(options: CreateAssetOptions): ArrayBuffer {
  const {
    textureData,
    textureWidth,
    textureHeight,
    positions,
    uvs,
    segmentsX,
    segmentsY,
    planeWidth,
    planeHeight,
    maxTilt,
    colored,
  } = options;

  const vertexCount = positions.length / 3;
  
  // Validate
  if (uvs.length / 2 !== vertexCount) {
    throw new Error(`UV count mismatch: expected ${vertexCount * 2}, got ${uvs.length}`);
  }

  // Calculate total size
  const textureSize = textureData.byteLength;
  const positionsSize = positions.byteLength;
  const uvsSize = uvs.byteLength;
  
  const totalSize = 
    HEADER_SIZE +           // Header
    4 + textureSize +       // Texture section (size + data)
    4 + positionsSize + uvsSize; // Geometry section (vertexCount + positions + uvs)

  // Create buffer
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  let offset = 0;

  // --- Header (32 bytes) ---
  
  // Magic (5 bytes)
  bytes.set(MAGIC, offset);
  offset += 5;
  
  // Version (1 byte)
  view.setUint8(offset, FORMAT_VERSION);
  offset += 1;
  
  // Flags (2 bytes)
  let flags = 0;
  if (colored) flags |= FLAGS.COLORED;
  view.setUint16(offset, flags, true);
  offset += 2;
  
  // Texture dimensions (4 + 4 bytes)
  view.setUint32(offset, textureWidth, true);
  offset += 4;
  view.setUint32(offset, textureHeight, true);
  offset += 4;
  
  // Segments (2 + 2 bytes)
  view.setUint16(offset, segmentsX, true);
  offset += 2;
  view.setUint16(offset, segmentsY, true);
  offset += 2;
  
  // Plane dimensions (4 + 4 bytes)
  view.setFloat32(offset, planeWidth, true);
  offset += 4;
  view.setFloat32(offset, planeHeight, true);
  offset += 4;
  
  // Max tilt (2 bytes)
  view.setUint16(offset, maxTilt, true);
  offset += 2;
  
  // Reserved (2 bytes)
  view.setUint16(offset, 0, true);
  offset += 2;
  
  // Sanity check: we should be at HEADER_SIZE
  if (offset !== HEADER_SIZE) {
    throw new Error(`Header size mismatch: expected ${HEADER_SIZE}, wrote ${offset}`);
  }

  // --- Texture Section ---
  
  // Texture size (4 bytes)
  view.setUint32(offset, textureSize, true);
  offset += 4;
  
  // Texture data
  bytes.set(textureData, offset);
  offset += textureSize;

  // --- Geometry Section ---
  
  // Vertex count (4 bytes)
  view.setUint32(offset, vertexCount, true);
  offset += 4;
  
  // Positions (Float32Array)
  bytes.set(new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength), offset);
  offset += positionsSize;
  
  // UVs (Float32Array)
  bytes.set(new Uint8Array(uvs.buffer, uvs.byteOffset, uvs.byteLength), offset);
  offset += uvsSize;

  // Final sanity check
  if (offset !== totalSize) {
    throw new Error(`Size mismatch: expected ${totalSize}, wrote ${offset}`);
  }

  return buffer;
}

/**
 * Helper to convert a canvas to PNG Uint8Array
 */
export async function canvasToPngData(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob from canvas'));
        return;
      }
      const buffer = await blob.arrayBuffer();
      resolve(new Uint8Array(buffer));
    }, 'image/png');
  });
}
