// The exact signal keys POST /v1/identify accepts.
//
// The API validates with additionalProperties:false and does not strip unknown
// fields, so one extra key is a 400 for the whole request. Connected mode
// therefore sends a whitelist copy rather than the raw signal object: new
// probes added to this library can never break the paid endpoint.
//
// This is a hand-mirrored copy of the API's schema. See SYNC.md.

export const SIGNAL_KEYS = [
  'collectorVersion',
  'userAgent',
  'platform',
  'webdriver',
  'languages',
  'language',
  'timezone',
  'timezoneOffset',
  'hardwareConcurrency',
  'deviceMemory',
  'maxTouchPoints',
  'cookieEnabled',
  'vendor',
  'screen',
  'colorScheme',
  'reducedMotion',
  'touchSupport',
  'plugins',
  'canvas',
  'webgl',
  'audio',
  'fonts',
  'math',
  'localStorage',
  'sessionStorage',
  'indexedDB',
] as const;

export const SCREEN_KEYS = [
  'width',
  'height',
  'availWidth',
  'availHeight',
  'colorDepth',
  'pixelDepth',
  'devicePixelRatio',
] as const;

export const WEBGL_KEYS = [
  'vendor',
  'renderer',
  'version',
  'shadingLanguageVersion',
  'unmaskedVendor',
  'unmaskedRenderer',
  'extensions',
  'params',
] as const;

function pick(source: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (source == null || typeof source !== 'object') return null;
  const src = source as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in src) out[key] = src[key];
  }
  return out;
}

/**
 * Reduce collected signals to what the API will accept.
 *
 * Note what is absent by construction: `serverUserAgent`. The API rejects a
 * client-supplied value and derives it from the request header after
 * validation, so a browser can never claim an authoritative user agent.
 */
export function toIdentifyPayload(signals: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SIGNAL_KEYS) {
    if (!(key in signals)) continue;
    const value = signals[key];
    if (key === 'screen') {
      out.screen = value == null ? null : pick(value, SCREEN_KEYS);
    } else if (key === 'webgl') {
      out.webgl = value == null ? null : pick(value, WEBGL_KEYS);
    } else {
      out[key] = value;
    }
  }
  return out;
}
