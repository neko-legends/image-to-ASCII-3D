/**
 * ASCII Art Generator - Main Application
 */

import {
  convert,
  frameToText,
  GLYPH_PRESETS,
  type RGBAImage,
  type ConvertOptions,
  type DitheringMode,
  type GlyphPresetName,
  type AsciiFrame,
} from '@ascii/core';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { getCalibratedGlyphMap } from './calibrate.js';
import { renderToHtml, renderToCanvas, downloadCanvasAsPng, downloadAsHtml } from './render.js';
import { 
  initParallax3D, 
  destroyParallax3D, 
  isParallaxActive, 
  downloadParallaxAsset, 
  importParallaxAsset, 
  setParallaxZoom, 
  setBloomIntensity, 
  setBloomThreshold, 
  setBloomRadius, 
  setSaturation,
  setChromaticAberration,
  setScanlines,
  setNoise,
  setColorPulse,
  setWaveDistortion,
  setFlicker,
  triggerHit,
  triggerDeath,
  resetDeath,
  resetHit,
} from './parallax3d.js';

// State
let currentImage: RGBAImage | null = null;
let currentDepthMap: RGBAImage | null = null;
let currentFrame: AsciiFrame | null = null;

// LocalStorage keys
const STORAGE_KEY = 'ascii-generator-last-image';
const DEPTH_STORAGE_KEY = 'ascii-generator-last-depth';
const SETTINGS_KEY = 'ascii-generator-settings';

// Debug panel
const debugPanel = document.getElementById('debug-panel')!;
const debugLog = document.getElementById('debug-log')!;

function debug(msg: string): void {
  console.log(msg);
  const line = document.createElement('div');
  line.className = 'debug-line';
  line.textContent = msg;
  debugLog.appendChild(line);
  debugLog.scrollTop = debugLog.scrollHeight;
}

function clearDebugLog(): void {
  debugLog.innerHTML = '';
}

// Make clearDebugLog available globally for the button
(window as unknown as { clearDebugLog: typeof clearDebugLog }).clearDebugLog = clearDebugLog;

// Toggle debug panel with ` key
document.addEventListener('keydown', (e) => {
  if (e.key === '`') {
    debugPanel.classList.toggle('hidden');
  }
});

// DOM Elements - Image upload
const uploadArea = document.getElementById('upload-area')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const previewImage = document.getElementById('preview-image') as HTMLImageElement;

const IMAGE_EXTENSIONS = new Set([
  'avif', 'bmp', 'gif', 'ico', 'jfif', 'jpeg', 'jpg', 'png', 'svg', 'webp',
]);
const IMAGE_MIME_TYPES = new Set([
  'image/avif', 'image/bmp', 'image/gif', 'image/jpeg', 'image/png', 'image/svg+xml',
  'image/vnd.microsoft.icon', 'image/webp', 'image/x-icon',
]);
const SUPPORTED_IMAGE_FORMATS = 'PNG, JPEG, GIF, WebP, AVIF, BMP, SVG, or ICO';
const PARALLAX_WHEEL_ZOOM_STEP = 10;

type NativeDropTarget = 'source' | 'depth';
type DropPosition = { x: number; y: number };

// DOM Elements - Depth map upload
const depthUploadArea = document.getElementById('depth-upload-area')!;
const depthFileInput = document.getElementById('depth-file-input') as HTMLInputElement;
const depthPreviewImage = document.getElementById('depth-preview-image') as HTMLImageElement;

// DOM Elements - Controls
const fitModeSelect = document.getElementById('fit-mode') as HTMLSelectElement;
const fontSizeGroup = document.getElementById('font-size-group')!;
const fontSizeInput = document.getElementById('font-size') as HTMLInputElement;
const fontSizeValue = document.getElementById('font-size-value')!;
const colsGroup = document.getElementById('cols-group')!;
const colsInput = document.getElementById('cols') as HTMLInputElement;
const colsValue = document.getElementById('cols-value')!;
const fontFamilySelect = document.getElementById('font-family') as HTMLSelectElement;
const presetSelect = document.getElementById('preset') as HTMLSelectElement;
const ditheringSelect = document.getElementById('dithering') as HTMLSelectElement;
const edgeCheckbox = document.getElementById('edge-detection') as HTMLInputElement;
const invertCheckbox = document.getElementById('invert') as HTMLInputElement;
const colorCheckbox = document.getElementById('color-mode') as HTMLInputElement;

// DOM Elements - Parallax controls
const parallaxEnabledCheckbox = document.getElementById('parallax-enabled') as HTMLInputElement;
const parallaxDepthGroup = document.getElementById('parallax-depth-group')!;
const parallaxDepthInput = document.getElementById('parallax-depth') as HTMLInputElement;
const parallaxDepthValue = document.getElementById('parallax-depth-value')!;
const parallaxTiltGroup = document.getElementById('parallax-tilt-group')!;
const parallaxTiltInput = document.getElementById('parallax-tilt') as HTMLInputElement;
const parallaxTiltValue = document.getElementById('parallax-tilt-value')!;
const parallaxInvertGroup = document.getElementById('parallax-invert-group')!;
const parallaxInvertCheckbox = document.getElementById('parallax-invert') as HTMLInputElement;
const depthSmoothingGroup = document.getElementById('depth-smoothing-group')!;
const depthSmoothingInput = document.getElementById('depth-smoothing') as HTMLInputElement;
const depthSmoothingValue = document.getElementById('depth-smoothing-value')!;
const parallaxZoomGroup = document.getElementById('parallax-zoom-group')!;
const parallaxZoomInput = document.getElementById('parallax-zoom') as HTMLInputElement;
const parallaxZoomValue = document.getElementById('parallax-zoom-value')!;

// DOM Elements - Bloom controls
const bloomIntensityGroup = document.getElementById('bloom-intensity-group')!;
const bloomIntensityInput = document.getElementById('bloom-intensity') as HTMLInputElement;
const bloomIntensityValue = document.getElementById('bloom-intensity-value')!;
const bloomThresholdGroup = document.getElementById('bloom-threshold-group')!;
const bloomThresholdInput = document.getElementById('bloom-threshold') as HTMLInputElement;
const bloomThresholdValue = document.getElementById('bloom-threshold-value')!;
const bloomRadiusGroup = document.getElementById('bloom-radius-group')!;
const bloomRadiusInput = document.getElementById('bloom-radius') as HTMLInputElement;
const bloomRadiusValue = document.getElementById('bloom-radius-value')!;
const saturationGroup = document.getElementById('saturation-group')!;
const saturationInput = document.getElementById('saturation') as HTMLInputElement;
const saturationValue = document.getElementById('saturation-value')!;

// DOM Elements - FX controls (new animated effects)
const fxDivider = document.getElementById('fx-divider')!;
const chromaticGroup = document.getElementById('chromatic-group')!;
const chromaticInput = document.getElementById('chromatic') as HTMLInputElement;
const chromaticValue = document.getElementById('chromatic-value')!;
const scanlinesGroup = document.getElementById('scanlines-group')!;
const scanlinesInput = document.getElementById('scanlines') as HTMLInputElement;
const scanlinesValue = document.getElementById('scanlines-value')!;
const noiseGroup = document.getElementById('noise-group')!;
const noiseInput = document.getElementById('noise') as HTMLInputElement;
const noiseValue = document.getElementById('noise-value')!;
const colorPulseGroup = document.getElementById('color-pulse-group')!;
const colorPulseInput = document.getElementById('color-pulse') as HTMLInputElement;
const colorPulseValue = document.getElementById('color-pulse-value')!;
const waveGroup = document.getElementById('wave-group')!;
const waveInput = document.getElementById('wave') as HTMLInputElement;
const waveValue = document.getElementById('wave-value')!;
const flickerGroup = document.getElementById('flicker-group')!;
const flickerInput = document.getElementById('flicker') as HTMLInputElement;
const flickerValue = document.getElementById('flicker-value')!;

// DOM Elements - Game FX buttons
const gameFxDivider = document.getElementById('game-fx-divider')!;
const gameFxGroup = document.getElementById('game-fx-group')!;
const hitBtn = document.getElementById('hit-btn') as HTMLButtonElement;
const deathBtn = document.getElementById('death-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;

// DOM Elements - Parallax import
const openParallaxBtn = document.getElementById('open-parallax-btn') as HTMLButtonElement;
const parallaxFileInput = document.getElementById('parallax-file-input') as HTMLInputElement;

// DOM Elements - Actions & Output
const convertBtn = document.getElementById('convert-btn') as HTMLButtonElement;
const exportPngBtn = document.getElementById('export-png-btn') as HTMLButtonElement;
const exportHtmlBtn = document.getElementById('export-html-btn') as HTMLButtonElement;
const copyTextBtn = document.getElementById('copy-text-btn') as HTMLButtonElement;
const exportParallaxBtn = document.getElementById('export-parallax-btn') as HTMLButtonElement;
const outputContainer = document.getElementById('ascii-output')!;
const outputInfo = document.getElementById('output-info')!;

// Initialize
function init(): void {
  updateScale();
  setupEventListeners();
  void setupTauriDragAndDrop();
  loadSettings();
  updateFitModeUI();
  updateParallaxUI();
  updateColsDisplay();
  updateFontSizeDisplay();
  updateCharAspect();
  updateParallaxDepthDisplay();
  updateDepthSmoothingDisplay();
  updateParallaxTiltDisplay();
  updateParallaxZoomDisplay();
  updateBloomIntensityDisplay();
  updateBloomThresholdDisplay();
  updateBloomRadiusDisplay();
  updateSaturationDisplay();
  updateChromaticDisplay();
  updateScanlinesDisplay();
  updateNoiseDisplay();
  updateColorPulseDisplay();
  updateWaveDisplay();
  updateFlickerDisplay();
  
  // Refit on window resize (only for manual mode)
  window.addEventListener('resize', debounce(() => {
    updateScale();
    refitOutput();
  }, 150));
  
  // Restore last image if available
  restoreLastImage();
}

function updateScale(): void {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  document.documentElement.style.setProperty('--ui-scale', String(scale));
}

/**
 * Refit the output when container size changes
 */
function refitOutput(): void {
  if (!currentFrame) return;
  
  const pre = outputContainer.querySelector('pre');
  if (!pre) return;
  
  const padding = 16;
  const availableWidth = outputContainer.clientWidth - padding;
  const availableHeight = outputContainer.clientHeight - padding;
  
  const fontSize = calculateFitFontSizeWithSize(currentFrame.cols, currentFrame.rows, availableWidth, availableHeight);
  pre.style.fontSize = `${fontSize}px`;
  outputInfo.textContent = `${currentFrame.cols} x ${currentFrame.rows} chars @ ${fontSize}px`;
}

/**
 * Simple debounce helper
 */
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timeout: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  }) as T;
}

function setupEventListeners(): void {
  // Prevent a file dropped outside an upload target from replacing the app page.
  document.addEventListener('dragover', preventDocumentFileDrop);
  document.addEventListener('drop', preventDocumentFileDrop);

  // File upload - main image
  uploadArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);
  uploadArea.addEventListener('dragover', handleDragOver);
  uploadArea.addEventListener('dragleave', handleDragLeave);
  uploadArea.addEventListener('drop', handleDrop);
  
  // File upload - depth map
  depthUploadArea.addEventListener('click', () => depthFileInput.click());
  depthFileInput.addEventListener('change', handleDepthFileSelect);
  depthUploadArea.addEventListener('dragover', handleDepthDragOver);
  depthUploadArea.addEventListener('dragleave', handleDepthDragLeave);
  depthUploadArea.addEventListener('drop', handleDepthDrop);
  
  // Options
  fitModeSelect.addEventListener('change', () => {
    updateFitModeUI();
    saveSettings();
  });
  fontFamilySelect.addEventListener('change', () => {
    updateCharAspect();
    saveSettings();
  });
  fontSizeInput.addEventListener('input', () => {
    updateFontSizeDisplay();
    saveSettings();
  });
  colsInput.addEventListener('input', () => {
    updateColsDisplay();
    saveSettings();
  });
  presetSelect.addEventListener('change', saveSettings);
  ditheringSelect.addEventListener('change', saveSettings);
  edgeCheckbox.addEventListener('change', saveSettings);
  invertCheckbox.addEventListener('change', saveSettings);
  colorCheckbox.addEventListener('change', saveSettings);
  
  // Parallax options
  parallaxEnabledCheckbox.addEventListener('change', () => {
    updateParallaxUI();
    saveSettings();
  });
  parallaxDepthInput.addEventListener('input', () => {
    updateParallaxDepthDisplay();
    saveSettings();
  });
  parallaxTiltInput.addEventListener('input', () => {
    updateParallaxTiltDisplay();
    saveSettings();
  });
  parallaxInvertCheckbox.addEventListener('change', saveSettings);
  depthSmoothingInput.addEventListener('input', () => {
    updateDepthSmoothingDisplay();
    saveSettings();
  });
  parallaxZoomInput.addEventListener('input', () => {
    updateParallaxZoomDisplay();
    applyParallaxZoom();
    saveSettings();
  });
  outputContainer.addEventListener('wheel', handleParallaxZoomWheel, { passive: false });
  
  // Bloom controls
  bloomIntensityInput.addEventListener('input', () => {
    updateBloomIntensityDisplay();
    applyBloomSettings();
    saveSettings();
  });
  bloomThresholdInput.addEventListener('input', () => {
    updateBloomThresholdDisplay();
    applyBloomSettings();
    saveSettings();
  });
  bloomRadiusInput.addEventListener('input', () => {
    updateBloomRadiusDisplay();
    applyBloomSettings();
    saveSettings();
  });
  saturationInput.addEventListener('input', () => {
    updateSaturationDisplay();
    applySaturation();
    saveSettings();
  });
  
  // FX controls (new animated effects)
  chromaticInput.addEventListener('input', () => {
    updateChromaticDisplay();
    applyFxSettings();
    saveSettings();
  });
  scanlinesInput.addEventListener('input', () => {
    updateScanlinesDisplay();
    applyFxSettings();
    saveSettings();
  });
  noiseInput.addEventListener('input', () => {
    updateNoiseDisplay();
    applyFxSettings();
    saveSettings();
  });
  colorPulseInput.addEventListener('input', () => {
    updateColorPulseDisplay();
    applyFxSettings();
    saveSettings();
  });
  waveInput.addEventListener('input', () => {
    updateWaveDisplay();
    applyFxSettings();
    saveSettings();
  });
  flickerInput.addEventListener('input', () => {
    updateFlickerDisplay();
    applyFxSettings();
    saveSettings();
  });
  
  // Game FX buttons
  hitBtn.addEventListener('click', () => {
    triggerHit();
  });
  deathBtn.addEventListener('click', () => {
    triggerDeath();
  });
  resetBtn.addEventListener('click', () => {
    resetHit();
    resetDeath();
  });
  
  // Parallax import
  openParallaxBtn.addEventListener('click', () => parallaxFileInput.click());
  parallaxFileInput.addEventListener('change', handleParallaxImport);
  
  // Actions
  convertBtn.addEventListener('click', handleConvert);
  exportPngBtn.addEventListener('click', handleExportPng);
  exportHtmlBtn.addEventListener('click', handleExportHtml);
  copyTextBtn.addEventListener('click', handleCopyText);
  exportParallaxBtn.addEventListener('click', handleExportParallax);
  
  // Initialize UI states
  updateFitModeUI();
  updateParallaxUI();
  updateParallaxDepthDisplay();
  updateDepthSmoothingDisplay();
  updateParallaxTiltDisplay();
  updateParallaxZoomDisplay();
  updateBloomIntensityDisplay();
  updateBloomThresholdDisplay();
  updateBloomRadiusDisplay();
  updateSaturationDisplay();
  // Initialize FX displays
  updateChromaticDisplay();
  updateScanlinesDisplay();
  updateNoiseDisplay();
  updateColorPulseDisplay();
  updateWaveDisplay();
  updateFlickerDisplay();
}

async function setupTauriDragAndDrop(): Promise<void> {
  if (!('__TAURI_INTERNALS__' in window)) return;

  try {
    const appWindow = getCurrentWindow();
    let scaleFactor = await appWindow.scaleFactor();

    await appWindow.onScaleChanged(({ payload }) => {
      scaleFactor = payload.scaleFactor;
    });

    await appWindow.onDragDropEvent(({ payload }) => {
      if (payload.type === 'leave') {
        setNativeDropHighlight(null);
        return;
      }

      const target = nativeDropTargetAt(payload.position, scaleFactor);
      if (payload.type === 'enter' || payload.type === 'over') {
        setNativeDropHighlight(target);
        return;
      }

      setNativeDropHighlight(null);
      const path = payload.paths[0];
      if (target && path) void loadNativeDroppedPath(path, target);
    });
  } catch (error) {
    console.error('Failed to initialize native drag and drop:', error);
  }
}

function nativeDropTargetAt(position: DropPosition, scaleFactor: number): NativeDropTarget | null {
  const x = position.x / scaleFactor;
  const y = position.y / scaleFactor;
  const element = document.elementFromPoint(x, y);

  if (element?.closest('#upload-area')) return 'source';
  if (element?.closest('#depth-upload-area')) return 'depth';
  return null;
}

function setNativeDropHighlight(target: NativeDropTarget | null): void {
  uploadArea.classList.toggle('dragover', target === 'source');
  depthUploadArea.classList.toggle('dragover', target === 'depth');
}

async function loadNativeDroppedPath(path: string, target: NativeDropTarget): Promise<void> {
  try {
    const response = await invoke<ArrayBuffer | Uint8Array | number[]>('read_dropped_file', { path });
    const bytes = response instanceof ArrayBuffer ? response : new Uint8Array(response);
    const name = path.split(/[\\/]/).pop() || 'dropped-file';
    const file = new File([bytes], name, { type: mimeTypeForFileName(name) });

    if (target === 'source') await loadImageFile(file);
    else await loadDepthMapFile(file);
  } catch (error) {
    console.error('Failed to load dropped file:', error);
    alert(`Could not load the dropped file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function mimeTypeForFileName(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    avif: 'image/avif',
    bmp: 'image/bmp',
    gif: 'image/gif',
    ico: 'image/x-icon',
    jfif: 'image/jpeg',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    webp: 'image/webp',
  };
  return extension ? mimeTypes[extension] ?? 'application/octet-stream' : 'application/octet-stream';
}

type SavedSettings = {
  fitMode: string;
  fontSize: string;
  cols: string;
  fontFamily: string;
  preset: string;
  dithering: string;
  edgeDetection: boolean;
  invert: boolean;
  colorMode: boolean;
  parallaxEnabled: boolean;
  parallaxDepth: string;
  parallaxTilt: string;
  parallaxInvert: boolean;
  depthSmoothing: string;
  parallaxZoom: string;
  bloomIntensity: string;
  bloomThreshold: string;
  bloomRadius: string;
  saturation: string;
  // New FX settings
  chromatic: string;
  scanlines: string;
  noise: string;
  colorPulse: string;
  wave: string;
  flicker: string;
};

function saveSettings(): void {
  const settings: SavedSettings = {
    fitMode: fitModeSelect.value,
    fontSize: fontSizeInput.value,
    cols: colsInput.value,
    fontFamily: fontFamilySelect.value,
    preset: presetSelect.value,
    dithering: ditheringSelect.value,
    edgeDetection: edgeCheckbox.checked,
    invert: invertCheckbox.checked,
    colorMode: colorCheckbox.checked,
    parallaxEnabled: parallaxEnabledCheckbox.checked,
    parallaxDepth: parallaxDepthInput.value,
    parallaxTilt: parallaxTiltInput.value,
    parallaxInvert: parallaxInvertCheckbox.checked,
    depthSmoothing: depthSmoothingInput.value,
    parallaxZoom: parallaxZoomInput.value,
    bloomIntensity: bloomIntensityInput.value,
    bloomThreshold: bloomThresholdInput.value,
    bloomRadius: bloomRadiusInput.value,
    saturation: saturationInput.value,
    // New FX settings
    chromatic: chromaticInput.value,
    scanlines: scanlinesInput.value,
    noise: noiseInput.value,
    colorPulse: colorPulseInput.value,
    wave: waveInput.value,
    flicker: flickerInput.value,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSettings(): void {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const settings = JSON.parse(raw) as Partial<SavedSettings>;

    if (settings.fitMode && fitModeSelect.querySelector(`option[value="${settings.fitMode}"]`)) {
      fitModeSelect.value = settings.fitMode;
    }
    if (settings.fontSize) {
      const value = Math.max(parseInt(fontSizeInput.min, 10), Math.min(parseInt(fontSizeInput.max, 10), parseInt(settings.fontSize, 10)));
      fontSizeInput.value = Number.isFinite(value) ? String(value) : fontSizeInput.value;
    }
    if (settings.cols) {
      const value = Math.max(parseInt(colsInput.min, 10), Math.min(parseInt(colsInput.max, 10), parseInt(settings.cols, 10)));
      colsInput.value = Number.isFinite(value) ? String(value) : colsInput.value;
    }
    if (settings.fontFamily && fontFamilySelect.querySelector(`option[value="${settings.fontFamily}"]`)) {
      fontFamilySelect.value = settings.fontFamily;
    }
    if (settings.preset && presetSelect.querySelector(`option[value="${settings.preset}"]`)) {
      presetSelect.value = settings.preset;
    }
    if (settings.dithering && ditheringSelect.querySelector(`option[value="${settings.dithering}"]`)) {
      ditheringSelect.value = settings.dithering;
    }
    if (typeof settings.edgeDetection === 'boolean') {
      edgeCheckbox.checked = settings.edgeDetection;
    }
    if (typeof settings.invert === 'boolean') {
      invertCheckbox.checked = settings.invert;
    }
    if (typeof settings.colorMode === 'boolean') {
      colorCheckbox.checked = settings.colorMode;
    }
    if (typeof settings.parallaxEnabled === 'boolean') {
      parallaxEnabledCheckbox.checked = settings.parallaxEnabled;
    }
    if (settings.parallaxDepth) {
      const value = Math.max(parseInt(parallaxDepthInput.min, 10), Math.min(parseInt(parallaxDepthInput.max, 10), parseInt(settings.parallaxDepth, 10)));
      parallaxDepthInput.value = Number.isFinite(value) ? String(value) : parallaxDepthInput.value;
    }
    if (settings.parallaxTilt) {
      const value = Math.max(parseInt(parallaxTiltInput.min, 10), Math.min(parseInt(parallaxTiltInput.max, 10), parseInt(settings.parallaxTilt, 10)));
      parallaxTiltInput.value = Number.isFinite(value) ? String(value) : parallaxTiltInput.value;
    }
    if (typeof settings.parallaxInvert === 'boolean') {
      parallaxInvertCheckbox.checked = settings.parallaxInvert;
    }
    if (settings.depthSmoothing) {
      const value = Math.max(parseInt(depthSmoothingInput.min, 10), Math.min(parseInt(depthSmoothingInput.max, 10), parseInt(settings.depthSmoothing, 10)));
      depthSmoothingInput.value = Number.isFinite(value) ? String(value) : depthSmoothingInput.value;
    }
    if (settings.parallaxZoom) {
      const value = Math.max(parseInt(parallaxZoomInput.min, 10), Math.min(parseInt(parallaxZoomInput.max, 10), parseInt(settings.parallaxZoom, 10)));
      parallaxZoomInput.value = Number.isFinite(value) ? String(value) : parallaxZoomInput.value;
    }
    if (settings.bloomIntensity) {
      const value = Math.max(parseInt(bloomIntensityInput.min, 10), Math.min(parseInt(bloomIntensityInput.max, 10), parseInt(settings.bloomIntensity, 10)));
      bloomIntensityInput.value = Number.isFinite(value) ? String(value) : bloomIntensityInput.value;
    }
    if (settings.bloomThreshold) {
      const value = Math.max(parseInt(bloomThresholdInput.min, 10), Math.min(parseInt(bloomThresholdInput.max, 10), parseInt(settings.bloomThreshold, 10)));
      bloomThresholdInput.value = Number.isFinite(value) ? String(value) : bloomThresholdInput.value;
    }
    if (settings.bloomRadius) {
      const value = Math.max(parseInt(bloomRadiusInput.min, 10), Math.min(parseInt(bloomRadiusInput.max, 10), parseInt(settings.bloomRadius, 10)));
      bloomRadiusInput.value = Number.isFinite(value) ? String(value) : bloomRadiusInput.value;
    }
    if (settings.saturation) {
      const value = Math.max(parseInt(saturationInput.min, 10), Math.min(parseInt(saturationInput.max, 10), parseInt(settings.saturation, 10)));
      saturationInput.value = Number.isFinite(value) ? String(value) : saturationInput.value;
    }
    // Load new FX settings
    if (settings.chromatic) {
      const value = Math.max(parseInt(chromaticInput.min, 10), Math.min(parseInt(chromaticInput.max, 10), parseInt(settings.chromatic, 10)));
      chromaticInput.value = Number.isFinite(value) ? String(value) : chromaticInput.value;
    }
    if (settings.scanlines) {
      const value = Math.max(parseInt(scanlinesInput.min, 10), Math.min(parseInt(scanlinesInput.max, 10), parseInt(settings.scanlines, 10)));
      scanlinesInput.value = Number.isFinite(value) ? String(value) : scanlinesInput.value;
    }
    if (settings.noise) {
      const value = Math.max(parseInt(noiseInput.min, 10), Math.min(parseInt(noiseInput.max, 10), parseInt(settings.noise, 10)));
      noiseInput.value = Number.isFinite(value) ? String(value) : noiseInput.value;
    }
    if (settings.colorPulse) {
      const value = Math.max(parseInt(colorPulseInput.min, 10), Math.min(parseInt(colorPulseInput.max, 10), parseInt(settings.colorPulse, 10)));
      colorPulseInput.value = Number.isFinite(value) ? String(value) : colorPulseInput.value;
    }
    if (settings.wave) {
      const value = Math.max(parseInt(waveInput.min, 10), Math.min(parseInt(waveInput.max, 10), parseInt(settings.wave, 10)));
      waveInput.value = Number.isFinite(value) ? String(value) : waveInput.value;
    }
    if (settings.flicker) {
      const value = Math.max(parseInt(flickerInput.min, 10), Math.min(parseInt(flickerInput.max, 10), parseInt(settings.flicker, 10)));
      flickerInput.value = Number.isFinite(value) ? String(value) : flickerInput.value;
    }
  } catch (err) {
    console.warn('Failed to load settings:', err);
  }
}

/**
 * Toggle controls visibility based on fit mode
 */
function updateFitModeUI(): void {
  const mode = fitModeSelect.value;
  // fit/stretch: show font size, hide cols
  // manual: hide font size, show cols
  fontSizeGroup.style.display = mode === 'manual' ? 'none' : '';
  colsGroup.style.display = mode === 'manual' ? '' : 'none';
}

function updateFontSizeDisplay(): void {
  fontSizeValue.textContent = `${fontSizeInput.value}px`;
}

/**
 * Toggle parallax controls visibility
 */
function updateParallaxUI(): void {
  const enabled = parallaxEnabledCheckbox.checked;
  const active = isParallaxActive();
  parallaxDepthGroup.style.display = enabled ? '' : 'none';
  depthSmoothingGroup.style.display = enabled ? '' : 'none';
  parallaxTiltGroup.style.display = enabled ? '' : 'none';
  parallaxInvertGroup.style.display = enabled ? '' : 'none';
  // Zoom and bloom controls are visible when parallax is enabled OR when viewing imported parallax
  const showAdvanced = enabled || active;
  parallaxZoomGroup.style.display = showAdvanced ? '' : 'none';
  bloomIntensityGroup.style.display = showAdvanced ? '' : 'none';
  bloomThresholdGroup.style.display = showAdvanced ? '' : 'none';
  bloomRadiusGroup.style.display = showAdvanced ? '' : 'none';
  saturationGroup.style.display = showAdvanced ? '' : 'none';
  // FX controls (new animated effects)
  fxDivider.style.display = showAdvanced ? 'block' : 'none';
  chromaticGroup.style.display = showAdvanced ? '' : 'none';
  scanlinesGroup.style.display = showAdvanced ? '' : 'none';
  noiseGroup.style.display = showAdvanced ? '' : 'none';
  colorPulseGroup.style.display = showAdvanced ? '' : 'none';
  waveGroup.style.display = showAdvanced ? '' : 'none';
  flickerGroup.style.display = showAdvanced ? '' : 'none';
  // Game FX buttons
  gameFxDivider.style.display = showAdvanced ? 'block' : 'none';
  gameFxGroup.style.display = showAdvanced ? '' : 'none';
}

function updateParallaxDepthDisplay(): void {
  parallaxDepthValue.textContent = `${parallaxDepthInput.value}%`;
}

function updateParallaxTiltDisplay(): void {
  parallaxTiltValue.textContent = `${parallaxTiltInput.value}°`;
}

function updateParallaxZoomDisplay(): void {
  parallaxZoomValue.textContent = `${parallaxZoomInput.value}%`;
}

function updateBloomIntensityDisplay(): void {
  bloomIntensityValue.textContent = `${bloomIntensityInput.value}%`;
}

function updateBloomThresholdDisplay(): void {
  bloomThresholdValue.textContent = `${bloomThresholdInput.value}%`;
}

function updateBloomRadiusDisplay(): void {
  bloomRadiusValue.textContent = `${bloomRadiusInput.value}%`;
}

function updateSaturationDisplay(): void {
  saturationValue.textContent = `${saturationInput.value}%`;
}

function updateDepthSmoothingDisplay(): void {
  depthSmoothingValue.textContent = depthSmoothingInput.value;
}

function applyParallaxZoom(): void {
  if (isParallaxActive()) {
    setParallaxZoom(parseInt(parallaxZoomInput.value, 10));
  }
}

function handleParallaxZoomWheel(event: WheelEvent): void {
  if (!isParallaxActive() || event.deltaY === 0) return;

  event.preventDefault();
  const minimum = parseInt(parallaxZoomInput.min, 10);
  const maximum = parseInt(parallaxZoomInput.max, 10);
  const current = parseInt(parallaxZoomInput.value, 10);
  const direction = event.deltaY < 0 ? 1 : -1;
  const next = Math.max(minimum, Math.min(maximum, current + direction * PARALLAX_WHEEL_ZOOM_STEP));
  if (next === current) return;

  parallaxZoomInput.value = String(next);
  updateParallaxZoomDisplay();
  applyParallaxZoom();
  saveSettings();
}

function applyBloomSettings(): void {
  if (isParallaxActive()) {
    setBloomIntensity(parseInt(bloomIntensityInput.value, 10));
    setBloomThreshold(parseInt(bloomThresholdInput.value, 10));
    setBloomRadius(parseInt(bloomRadiusInput.value, 10));
  }
}

function applySaturation(): void {
  if (isParallaxActive()) {
    setSaturation(parseInt(saturationInput.value, 10));
  }
}

// FX display update functions
function updateChromaticDisplay(): void {
  chromaticValue.textContent = `${chromaticInput.value}%`;
}

function updateScanlinesDisplay(): void {
  scanlinesValue.textContent = `${scanlinesInput.value}%`;
}

function updateNoiseDisplay(): void {
  noiseValue.textContent = `${noiseInput.value}%`;
}

function updateColorPulseDisplay(): void {
  colorPulseValue.textContent = `${colorPulseInput.value}%`;
}

function updateWaveDisplay(): void {
  waveValue.textContent = `${waveInput.value}%`;
}

function updateFlickerDisplay(): void {
  flickerValue.textContent = `${flickerInput.value}%`;
}

// FX apply functions
function applyFxSettings(): void {
  if (isParallaxActive()) {
    setChromaticAberration(parseInt(chromaticInput.value, 10));
    setScanlines(parseInt(scanlinesInput.value, 10));
    setNoise(parseInt(noiseInput.value, 10));
    setColorPulse(parseInt(colorPulseInput.value, 10));
    setWaveDistortion(parseInt(waveInput.value, 10));
    setFlicker(parseInt(flickerInput.value, 10));
  }
}

function handleParallaxImport(e: Event): void {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    void loadParallaxFile(input.files[0]);
  }
  input.value = '';
}

async function loadParallaxFile(file: File): Promise<void> {
  if (!file.name.endsWith('.aparallax')) {
    alert('Please select a .aparallax file');
    return;
  }
  
  try {
    const buffer = await file.arrayBuffer();
    debug(`Loading parallax file: ${file.name}, size: ${buffer.byteLength} bytes`);
    
    const asset = await importParallaxAsset(buffer, outputContainer);
    
    // Update UI
    outputInfo.textContent = `Imported parallax (${asset.segmentsX}x${asset.segmentsY} segments)`;
    
    // Show zoom and bloom controls, apply current settings
    updateParallaxUI();
    applyParallaxZoom();
    applyBloomSettings();
    applySaturation();
    applyFxSettings();
    
    // Enable export button (re-exporting is possible)
    exportParallaxBtn.disabled = false;
    
    debug(`Imported parallax: ${asset.textureWidth}x${asset.textureHeight}, segments: ${asset.segmentsX}x${asset.segmentsY}, vertices: ${asset.vertexCount}`);
    
  } catch (err) {
    console.error('Failed to import parallax:', err);
    debug(`Import error: ${err instanceof Error ? err.message : String(err)}`);
    alert(`Failed to import parallax file: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

function handleDragOver(e: DragEvent): void {
  e.preventDefault();
  uploadArea.classList.add('dragover');
}

function handleDragLeave(e: DragEvent): void {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
}

function handleDrop(e: DragEvent): void {
  e.preventDefault();
  uploadArea.classList.remove('dragover');

  const file = getFirstDroppedFile(e);
  if (file) void loadImageFile(file);
}

function handleFileSelect(e: Event): void {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    void loadImageFile(input.files[0]);
  }
  input.value = '';
}

// Depth map handlers
function handleDepthDragOver(e: DragEvent): void {
  e.preventDefault();
  depthUploadArea.classList.add('dragover');
}

function handleDepthDragLeave(e: DragEvent): void {
  e.preventDefault();
  depthUploadArea.classList.remove('dragover');
}

function handleDepthDrop(e: DragEvent): void {
  e.preventDefault();
  depthUploadArea.classList.remove('dragover');

  const file = getFirstDroppedFile(e);
  if (file) void loadDepthMapFile(file);
}

function handleDepthFileSelect(e: Event): void {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    void loadDepthMapFile(input.files[0]);
  }
  input.value = '';
}

async function loadDepthMapFile(file: File): Promise<void> {
  if (!isSupportedImageFile(file)) {
    alert(`Please select a supported depth-map image: ${SUPPORTED_IMAGE_FORMATS}.`);
    return;
  }
  
  const url = URL.createObjectURL(file);
  
  try {
    const img = await loadImage(url);
    
    // Show preview
    depthPreviewImage.src = url;
    depthPreviewImage.hidden = false;
    depthUploadArea.querySelector('.upload-prompt')?.classList.add('hidden');
    
    // Extract RGBA data
    currentDepthMap = imageToRGBA(img);
    
    // Save to localStorage for persistence
    saveDepthMapToStorage(img);
    
    debug(`Depth map loaded: ${currentDepthMap.width}x${currentDepthMap.height}`);
    
  } catch (err) {
    console.error('Failed to load depth map:', err);
    alert(`Could not decode this depth-map image. Try ${SUPPORTED_IMAGE_FORMATS}.`);
  }
}

async function loadImageFile(file: File): Promise<void> {
  if (!isSupportedImageFile(file)) {
    alert(`Please select a supported image: ${SUPPORTED_IMAGE_FORMATS}.`);
    return;
  }
  
  const url = URL.createObjectURL(file);
  
  try {
    const img = await loadImage(url);
    
    // Show preview
    previewImage.src = url;
    previewImage.hidden = false;
    uploadArea.querySelector('.upload-prompt')?.classList.add('hidden');
    
    // Extract RGBA data
    currentImage = imageToRGBA(img);
    
    // Enable convert button
    convertBtn.disabled = false;
    
    // Save to localStorage for persistence
    saveImageToStorage(img);
    
  } catch (err) {
    console.error('Failed to load image:', err);
    alert(`Could not decode this image. Try ${SUPPORTED_IMAGE_FORMATS}.`);
  }
}

function preventDocumentFileDrop(e: DragEvent): void {
  if (hasDroppedFiles(e)) e.preventDefault();
}

function getFirstDroppedFile(e: DragEvent): File | null {
  return e.dataTransfer?.files.item(0) ?? null;
}

function hasDroppedFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

function isSupportedImageFile(file: File): boolean {
  if (IMAGE_MIME_TYPES.has(file.type.toLowerCase())) return true;

  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension !== undefined && IMAGE_EXTENSIONS.has(extension);
}

/**
 * Save image to localStorage as data URL
 */
function saveImageToStorage(img: HTMLImageElement): void {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    
    // Convert to data URL (JPEG for smaller size)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    localStorage.setItem(STORAGE_KEY, dataUrl);
  } catch (err) {
    console.warn('Failed to save image to storage:', err);
  }
}

/**
 * Restore last image from localStorage
 */
async function restoreLastImage(): Promise<void> {
  try {
    const dataUrl = localStorage.getItem(STORAGE_KEY);
    if (!dataUrl) return;
    
    const img = await loadImage(dataUrl);
    
    // Show preview
    previewImage.src = dataUrl;
    previewImage.hidden = false;
    uploadArea.querySelector('.upload-prompt')?.classList.add('hidden');
    
    // Extract RGBA data
    currentImage = imageToRGBA(img);
    
    // Enable convert button
    convertBtn.disabled = false;
    
    debug('Restored last image from storage');
  } catch (err) {
    console.warn('Failed to restore image from storage:', err);
    localStorage.removeItem(STORAGE_KEY);
  }
  
  // Also restore depth map
  await restoreLastDepthMap();
}

/**
 * Save depth map to localStorage as data URL
 */
function saveDepthMapToStorage(img: HTMLImageElement): void {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    
    // Convert to data URL (JPEG for smaller size)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    localStorage.setItem(DEPTH_STORAGE_KEY, dataUrl);
  } catch (err) {
    console.warn('Failed to save depth map to storage:', err);
  }
}

/**
 * Restore last depth map from localStorage
 */
async function restoreLastDepthMap(): Promise<void> {
  try {
    const dataUrl = localStorage.getItem(DEPTH_STORAGE_KEY);
    if (!dataUrl) return;
    
    const img = await loadImage(dataUrl);
    
    // Show preview
    depthPreviewImage.src = dataUrl;
    depthPreviewImage.hidden = false;
    depthUploadArea.querySelector('.upload-prompt')?.classList.add('hidden');
    
    // Extract RGBA data
    currentDepthMap = imageToRGBA(img);
    
    debug('Restored last depth map from storage');
  } catch (err) {
    console.warn('Failed to restore depth map from storage:', err);
    localStorage.removeItem(DEPTH_STORAGE_KEY);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function imageToRGBA(img: HTMLImageElement): RGBAImage {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  return {
    data: imageData.data,
    width: canvas.width,
    height: canvas.height,
  };
}

function updateColsDisplay(): void {
  colsValue.textContent = colsInput.value;
}

// Measured char aspect ratio (width/height) - updated when font changes
const PREVIEW_LINE_HEIGHT = 1.2;
let charAspect = 0.6;

/**
 * Measure the actual character aspect ratio for a given font
 * Uses DOM measurement to account for real line height
 */
function measureCharAspect(fontFamily: string, fontSize: number = 100): number {
  const cols = 50;
  const rows = 10;
  const line = 'M'.repeat(cols);
  const text = Array.from({ length: rows }, () => line).join('\n');
  
  const probe = document.createElement('pre');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.whiteSpace = 'pre';
  probe.style.margin = '0';
  probe.style.padding = '0';
  probe.style.fontFamily = `"${fontFamily}", monospace`;
  probe.style.fontSize = `${fontSize}px`;
  probe.style.lineHeight = String(PREVIEW_LINE_HEIGHT);
  probe.textContent = text;
  
  document.body.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  document.body.removeChild(probe);
  
  const charWidth = rect.width / cols;
  const lineHeight = rect.height / rows;
  
  return charWidth / lineHeight;
}

/**
 * Update char aspect ratio when font changes
 */
function updateCharAspect(): void {
  const fontFamily = fontFamilySelect.value;
  charAspect = measureCharAspect(fontFamily);
  
  debug(`Font "${fontFamily}" char aspect: ${charAspect.toFixed(3)}`);
}

/**
 * Get cell dimensions in pixels based on font's natural proportions
 */
function getCellDimensions(fontSize: number): { width: number; height: number } {
  const height = fontSize * PREVIEW_LINE_HEIGHT;
  const width = height * charAspect;
  return { width, height };
}

/**
 * Calculate optimal font size to fit ASCII art in container (for manual mode)
 * Takes pre-measured dimensions to avoid layout timing issues
 */
function calculateFitFontSizeWithSize(cols: number, rows: number, availableWidth: number, availableHeight: number): number {
  // Binary search for best font size that fits
  for (let fontSize = 24; fontSize >= 4; fontSize--) {
    const cell = getCellDimensions(fontSize);
    if (cols * cell.width <= availableWidth && rows * cell.height <= availableHeight) {
      return fontSize;
    }
  }
  return 4;
}

/**
 * Calculate cols/rows to fill container at a given font size, respecting image aspect ratio.
 * Uses the font's natural character aspect ratio to compensate for non-square cells.
 * 
 * Takes pre-measured dimensions to avoid layout measurement timing issues.
 */
function calculateDimensionsForFontSizeWithSize(
  imageWidth: number,
  imageHeight: number,
  availableWidth: number,
  availableHeight: number,
  fontSize: number
): { cols: number; rows: number } {
  const cell = getCellDimensions(fontSize);
  const cellAspect = cell.width / cell.height;
  
  // Max chars that fit in container
  const maxCols = Math.floor(availableWidth / cell.width);
  const maxRows = Math.floor(availableHeight / cell.height);
  
  // Image aspect ratio
  const imageAspect = imageWidth / imageHeight;
  
  // Calculate cols/rows so that VISUAL output matches image aspect
  // Visual aspect = (cols * cell.width) / (rows * cell.height) = imageAspect
  // rows = cols * cellAspect / imageAspect
  
  let cols = maxCols;
  let rows = Math.round(cols * cellAspect / imageAspect);
  
  // If rows exceed max, constrain by height
  if (rows > maxRows) {
    rows = maxRows;
    cols = Math.round(rows * imageAspect / cellAspect);
  }
  
  // Calculate actual visual dimensions
  const visualWidth = cols * cell.width;
  const visualHeight = rows * cell.height;
  const visualAspect = visualWidth / visualHeight;
  
  debug(`Image: ${imageWidth}x${imageHeight} (aspect: ${imageAspect.toFixed(2)})`);
  debug(`Cell: ${cell.width.toFixed(1)}x${cell.height.toFixed(1)}px (aspect: ${cellAspect.toFixed(2)})`);
  debug(`Container: ${availableWidth}x${availableHeight}px, Max: ${maxCols}x${maxRows}`);
  debug(`Output: ${cols}x${rows} chars`);
  debug(`Visual: ${visualWidth.toFixed(0)}x${visualHeight.toFixed(0)}px (aspect: ${visualAspect.toFixed(2)})`);
  
  return { 
    cols: Math.max(10, Math.min(cols, maxCols)), 
    rows: Math.max(5, Math.min(rows, maxRows)) 
  };
}

async function handleConvert(): Promise<void> {
  if (!currentImage) return;
  
  // Clear container and force layout reflow BEFORE measuring
  // This ensures we get accurate container dimensions
  outputContainer.innerHTML = '';
  
  // Force synchronous layout reflow by reading a layout property
  void outputContainer.offsetHeight;
  
  // Wait for next frame to ensure layout is complete
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  
  // Show loading after measurement setup
  outputContainer.innerHTML = '<div class="loading">Converting</div>';
  
  // Small delay for UI feedback
  await new Promise(r => setTimeout(r, 10));
  
  // Re-clear for accurate measurement (loading div affects nothing since we measure the container)
  const containerWidth = outputContainer.clientWidth;
  const containerHeight = outputContainer.clientHeight;
  
  debug(`Container dimensions: ${containerWidth}x${containerHeight}px`);
  
  try {
    const preset = presetSelect.value as GlyphPresetName;
    const charset = GLYPH_PRESETS[preset];
    const fontFamily = fontFamilySelect.value;
    
    // Get calibrated glyph map for the selected font
    const glyphMap = await getCalibratedGlyphMap(charset, fontFamily);
    
    const fitMode = fitModeSelect.value; // 'fit', 'stretch', or 'manual'
    
    // Cell aspect ratio from measured font
    const cellAspectRatio = charAspect;
    
    let cols: number;
    let rows: number | undefined;
    let fontSize: number;
    
    // Use captured dimensions for calculations
    const padding = 16;
    const availableWidth = containerWidth - padding;
    const availableHeight = containerHeight - padding;
    
    if (fitMode === 'fit') {
      // Fit mode: preserve aspect ratio, fit within container
      fontSize = parseInt(fontSizeInput.value, 10);
      const dims = calculateDimensionsForFontSizeWithSize(
        currentImage.width,
        currentImage.height,
        availableWidth,
        availableHeight,
        fontSize
      );
      cols = dims.cols;
      rows = dims.rows;
      debug(`Fit mode: preserving aspect ratio`);
    } else if (fitMode === 'stretch') {
      // Stretch mode: fill entire container, distort if needed
      fontSize = parseInt(fontSizeInput.value, 10);
      const cell = getCellDimensions(fontSize);
      
      cols = Math.floor(availableWidth / cell.width);
      rows = Math.floor(availableHeight / cell.height);
      debug(`Stretch mode: filling ${cols}x${rows} cells (ignoring aspect ratio)`);
    } else {
      // Manual mode: cols is input, calculate rows to maintain visual aspect ratio
      cols = parseInt(colsInput.value, 10);
      const imageAspect = currentImage.width / currentImage.height;
      const tempCell = getCellDimensions(12);
      const cellAspect = tempCell.width / tempCell.height;
      rows = Math.round(cols * cellAspect / imageAspect);
      fontSize = 0; // Will be calculated after conversion
      
      debug(`Manual mode: cols=${cols}, imageAspect=${imageAspect.toFixed(2)}, cellAspect=${cellAspect.toFixed(2)}, rows=${rows}`);
    }
    
    const options: Partial<ConvertOptions> = {
      cols,
      rows,
      dithering: ditheringSelect.value as DitheringMode,
      edgeDetection: edgeCheckbox.checked,
      edgeStrength: 0.3,
      invert: invertCheckbox.checked,
      colorMode: colorCheckbox.checked ? 'foreground' : 'none',
      preserveAspectRatio: false, // We handle aspect ratio ourselves
      cellAspectRatio,
    };
    
    // Convert
    currentFrame = convert(currentImage, glyphMap, options);
    
    // For manual mode, calculate font size after we know final dimensions
    if (fitMode === 'manual') {
      fontSize = calculateFitFontSizeWithSize(currentFrame.cols, currentFrame.rows, availableWidth, availableHeight);
    }
    
    // Render with the font size and selected font (natural line-height)
    const lineHeight = PREVIEW_LINE_HEIGHT;
    
    debug(`Source image: ${currentImage.width}x${currentImage.height}px (aspect: ${(currentImage.width/currentImage.height).toFixed(2)})`);
    debug(`Output: ${currentFrame.cols}x${currentFrame.rows} chars, fontSize: ${fontSize}px, lineHeight: ${lineHeight.toFixed(3)}`);
    
    const cell = getCellDimensions(fontSize);
    const outputWidthPx = currentFrame.cols * cell.width;
    const outputHeightPx = currentFrame.rows * cell.height;
    debug(`Rendered size: ${outputWidthPx.toFixed(0)}x${outputHeightPx.toFixed(0)}px (aspect: ${(outputWidthPx/outputHeightPx).toFixed(2)})`);
    
    // Check if we should use 3D parallax
    const useParallax3D = currentDepthMap && parallaxEnabledCheckbox.checked;
    
    if (useParallax3D) {
      // Use Three.js 3D renderer
      destroyParallax3D(); // Clean up any existing
      outputContainer.innerHTML = ''; // Clear container
      
      const depthPercent = parseInt(parallaxDepthInput.value, 10);
      const maxTilt = parseInt(parallaxTiltInput.value, 10);
      const depthStrength = depthPercent / 100; // Normalize to 0-1 range
      
      initParallax3D(currentFrame, currentDepthMap!, {
        container: outputContainer,
        maxTilt,
        depthStrength,
        invertDepth: parallaxInvertCheckbox.checked,
        depthSmoothing: parseInt(depthSmoothingInput.value, 10),
        fontFamily,
        colored: colorCheckbox.checked,
      });
      
      // Apply all post-processing settings
      applyParallaxZoom();
      applyBloomSettings();
      applySaturation();
      applyFxSettings();
      
      debug(`3D Parallax enabled: tilt=${maxTilt}°, depth=${depthStrength.toFixed(2)}`);
    } else {
      // Standard HTML rendering
      destroyParallax3D(); // Clean up if was active
      
      const html = renderToHtml(currentFrame, colorCheckbox.checked);
      outputContainer.innerHTML = `<pre style="font-size: ${fontSize}px; line-height: ${lineHeight}; font-family: '${fontFamily}', monospace;">${html}</pre>`;
      
      if (!colorCheckbox.checked) {
        outputContainer.classList.add('monochrome');
      } else {
        outputContainer.classList.remove('monochrome');
      }
    }
    
    // Update info
    const parallaxNote = useParallax3D ? ' (3D parallax)' : '';
    outputInfo.textContent = `${currentFrame.cols} x ${currentFrame.rows} chars @ ${fontSize}px${parallaxNote}`;
    
    // Enable export buttons
    exportPngBtn.disabled = false;
    exportHtmlBtn.disabled = false;
    copyTextBtn.disabled = false;
    // Parallax export only available when parallax is active
    exportParallaxBtn.disabled = !useParallax3D;
    
  } catch (err) {
    console.error('Conversion failed:', err);
    outputContainer.innerHTML = `<div class="error">Conversion failed: ${err}</div>`;
  }
}

function handleExportPng(): void {
  if (!currentFrame) return;
  
  const canvas = renderToCanvas(currentFrame, {
    fontFamily: fontFamilySelect.value,
    fontSize: parseInt(fontSizeInput.value, 10),
    colored: colorCheckbox.checked,
  });
  
  downloadCanvasAsPng(canvas, 'ascii-art.png');
}

function handleExportHtml(): void {
  if (!currentFrame) return;
  downloadAsHtml(currentFrame, 'ascii-art.html');
}

async function handleCopyText(): Promise<void> {
  if (!currentFrame) return;

  try {
    await navigator.clipboard.writeText(frameToText(currentFrame));
    const original = copyTextBtn.textContent;
    copyTextBtn.textContent = 'Copied';
    window.setTimeout(() => {
      copyTextBtn.textContent = original;
    }, 1200);
  } catch (err) {
    console.error('Copy failed:', err);
    alert('Copy failed. You can still select the ASCII text in the preview.');
  }
}

async function handleExportParallax(): Promise<void> {
  if (!isParallaxActive()) {
    alert('Parallax effect must be enabled to export');
    return;
  }
  await downloadParallaxAsset('parallax-ascii.aparallax');
}

// Start app
init();
