// Turning raw signals into a visitor id.
//
// Only a subset of the collected signals feeds the id. The rest are reported
// in `components` but excluded from the hash, because they change without the
// device changing: a user rotates a phone, opens a taskbar, zooms a page,
// updates a browser, or flies somewhere. Hashing those would mint a new id for
// the same device every time.

import type { CollectedSignals } from './collector.js';
import type { Components } from './types.js';
import { murmur128 } from './hash.js';
import { stableStringify } from './stable-stringify.js';

/**
 * Signals that make up the id. Anything not listed here is reported but not
 * hashed. Adding to this list changes every existing id, so treat it as a
 * breaking change.
 */
export const HASHED_SIGNALS = [
  'canvas',
  'webgl',
  'audio',
  'fonts',
  'math',
  'platform',
  'timezone',
  'hardwareConcurrency',
  'deviceMemory',
  'screen',
  'touchSupport',
  'vendor',
  'colorGamut',
] as const;

/** The four probes that carry most of the entropy. */
const STRONG_SIGNALS = ['canvas', 'webgl', 'audio', 'fonts'] as const;

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

/**
 * The screen as a pair sorted low-to-high, so a rotated phone keeps its id.
 * availWidth/availHeight and devicePixelRatio are left out: OS chrome and page
 * zoom move them around on an unchanged device.
 */
function screenIdentity(screen: unknown): unknown {
  if (!screen || typeof screen !== 'object') return null;
  const s = screen as Record<string, unknown>;
  const w = typeof s.width === 'number' ? s.width : null;
  const h = typeof s.height === 'number' ? s.height : null;
  const pair = w != null && h != null ? [Math.min(w, h), Math.max(w, h)] : null;
  return {
    dimensions: pair,
    colorDepth: s.colorDepth ?? null,
    pixelDepth: s.pixelDepth ?? null,
  };
}

/** The exact object that gets hashed. Exported so the demo can show it. */
export function identityInput(
  signals: CollectedSignals,
  extended: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of HASHED_SIGNALS) {
    if (key === 'screen') {
      out.screen = screenIdentity(signals.screen);
    } else if (key === 'colorGamut') {
      out.colorGamut = extended.colorGamut ?? null;
    } else {
      out[key] = signals[key] ?? null;
    }
  }
  return out;
}

export function computeVisitorId(
  signals: CollectedSignals,
  extended: Record<string, unknown>
): string {
  return murmur128(stableStringify(identityInput(signals, extended)));
}

/**
 * How much evidence backs the id, 0..1.
 *
 * This is a coverage measure: how many of the high-entropy probes actually
 * returned something. It is not a probability that two visits are the same
 * device, and it cannot be, because nothing here has seen another visit. The
 * calibrated cross-visit score is `similarity`, which only the API can produce.
 */
export function computeConfidence(signals: CollectedSignals): number {
  const present = STRONG_SIGNALS.filter((key) => isPresent(signals[key])).length;
  let score = 0.4 + 0.15 * present;
  // Automation is a strong hint the environment is synthetic and shared.
  if (signals.webdriver === true) score -= 0.3;
  if (present < 2) score = Math.min(score, 0.5);
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

export function buildComponents(
  signals: CollectedSignals,
  extended: Record<string, unknown>,
  durations: Record<string, number> = {}
): Components {
  const components: Components = {};
  for (const [name, value] of Object.entries(signals)) {
    components[name] = durations[name] != null
      ? { value, duration: durations[name] }
      : { value };
  }
  for (const [name, value] of Object.entries(extended)) {
    components[`extended.${name}`] = { value };
  }
  return components;
}
