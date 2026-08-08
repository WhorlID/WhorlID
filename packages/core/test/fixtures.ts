import type { CollectedSignals } from '../src/collector.js';

/** A fully populated signal set, shaped exactly like a real collection. */
export function fullSignals(overrides: Partial<CollectedSignals> = {}): CollectedSignals {
  return {
    collectorVersion: '1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36',
    platform: 'Win32',
    webdriver: false,
    languages: ['en-US', 'en'],
    language: 'en-US',
    timezone: 'Europe/Berlin',
    timezoneOffset: -60,
    hardwareConcurrency: 16,
    deviceMemory: 8,
    maxTouchPoints: 0,
    cookieEnabled: true,
    vendor: 'Google Inc.',
    screen: {
      width: 2560,
      height: 1440,
      availWidth: 2560,
      availHeight: 1400,
      colorDepth: 24,
      pixelDepth: 24,
      devicePixelRatio: 1.5,
    },
    colorScheme: 'dark',
    reducedMotion: false,
    touchSupport: false,
    plugins: ['PDF Viewer'],
    canvas: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg',
    webgl: {
      vendor: 'WebKit',
      renderer: 'WebKit WebGL',
      version: 'WebGL 1.0',
      shadingLanguageVersion: 'WebGL GLSL ES 1.0',
      unmaskedVendor: 'Google Inc. (NVIDIA)',
      unmaskedRenderer: 'ANGLE (NVIDIA GeForce RTX 3070 Direct3D11)',
      extensions: ['ANGLE_instanced_arrays', 'EXT_blend_minmax'],
      params: { MAX_TEXTURE_SIZE: 16384, ALIASED_LINE_WIDTH_RANGE: [1, 1] },
    },
    audio: '124.04347527516074',
    fonts: ['Arial', 'Calibri', 'Segoe UI'],
    math: { tan: -1.4214488238747245, sin: 0.8178819121159085, sqrt: 1.4142135623730951 },
    localStorage: true,
    sessionStorage: true,
    indexedDB: true,
    ...overrides,
  };
}

export const fullExtended = {
  colorGamut: 'srgb',
  hdr: false,
  contrastPreference: 'none',
  forcedColors: false,
  invertedColors: false,
  monochrome: 0,
  storageQuota: 268435456,
};
