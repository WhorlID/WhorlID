// Extra signals that the WhorlID API does not accept.
//
// These are collected for the local visitor id only. The API validates with
// additionalProperties:false and returns 400 rather than ignoring unknown
// fields, so everything here lives under a single `extended` key that the
// connected-mode filter drops wholesale. See SYNC.md.

import { safe } from './collector.js';

export interface ExtendedSignals {
  [key: string]: unknown;
}

/** First matching media query value, or null when none match. */
function firstMatch(queries: Array<[string, string]>): string | null {
  return safe(() => {
    for (const [query, value] of queries) {
      if (window.matchMedia(query).matches) return value;
    }
    return null;
  });
}

function matches(query: string): boolean | null {
  return safe(() => window.matchMedia(query).matches);
}

/**
 * Storage quota, bucketed to the nearest 256 MB.
 *
 * The raw byte figure drifts every time the user caches anything, which would
 * make it useless for identity. The bucket is stable for a given disk.
 */
async function storageQuotaBucket(): Promise<number | null> {
  try {
    const storage = (navigator as any)?.storage;
    if (!storage || typeof storage.estimate !== 'function') return null;
    const { quota } = await storage.estimate();
    if (typeof quota !== 'number' || !Number.isFinite(quota)) return null;
    const bucket = 256 * 1024 * 1024;
    return Math.round(quota / bucket) * bucket;
  } catch {
    return null;
  }
}

export async function collectExtendedSignals(): Promise<ExtendedSignals> {
  return {
    // Display capability. Stable for a given monitor, so this one also feeds
    // the visitor id.
    colorGamut: firstMatch([
      ['(color-gamut: rec2020)', 'rec2020'],
      ['(color-gamut: p3)', 'p3'],
      ['(color-gamut: srgb)', 'srgb'],
    ]),
    hdr: matches('(dynamic-range: high)'),
    // Accessibility preferences. User-toggleable, so reported but never hashed.
    contrastPreference: firstMatch([
      ['(prefers-contrast: more)', 'more'],
      ['(prefers-contrast: less)', 'less'],
      ['(prefers-contrast: custom)', 'custom'],
      ['(prefers-contrast: no-preference)', 'none'],
    ]),
    forcedColors: matches('(forced-colors: active)'),
    invertedColors: matches('(inverted-colors: inverted)'),
    monochrome: safe(() => {
      for (let depth = 0; depth <= 10; depth++) {
        if (window.matchMedia(`(monochrome: ${depth})`).matches) return depth;
      }
      return null;
    }),
    storageQuota: await storageQuotaBucket(),
  };
}
