// Runs under happy-dom, which provides navigator/screen/matchMedia but no real
// canvas, WebGL or WebAudio. That split is the point: it proves the probes
// degrade to null instead of throwing when an API is missing or blocked, which
// is exactly what a privacy-hardened browser looks like. Real signal values are
// covered by the Playwright smoke test.

import { describe, expect, it, vi, afterEach } from 'vitest';
import { COLLECTOR_VERSION, collectSignals, safe } from '../src/collector.js';
import { collectExtendedSignals } from '../src/signals-extra.js';
import { SIGNAL_KEYS } from '../src/identify-schema.js';

describe('safe', () => {
  it('returns the value when the probe works', () => {
    expect(safe(() => 42)).toBe(42);
  });

  it('returns null when the probe throws', () => {
    expect(
      safe(() => {
        throw new Error('blocked by the browser');
      })
    ).toBeNull();
  });

  it('returns the given fallback instead of null', () => {
    expect(
      safe(() => {
        throw new Error('blocked');
      }, [])
    ).toEqual([]);
  });
});

describe('collectSignals', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits exactly the keys the API knows about', async () => {
    const signals = await collectSignals();
    expect(Object.keys(signals).sort()).toEqual([...SIGNAL_KEYS].sort());
  });

  it('stamps the collector version', async () => {
    expect((await collectSignals()).collectorVersion).toBe(COLLECTOR_VERSION);
  });

  it('reads the environment it can see', async () => {
    const signals = await collectSignals();
    expect(typeof signals.userAgent).toBe('string');
    expect(signals.screen).toMatchObject({ width: expect.any(Number) });
    expect(['dark', 'light']).toContain(signals.colorScheme);
  });

  it('reports blocked probes as null rather than throwing', async () => {
    const signals = await collectSignals();
    // No WebAudio in happy-dom, so this is the blocked-probe path.
    expect(signals.audio).toBeNull();
  });

  it('survives a matchMedia that throws', async () => {
    vi.stubGlobal('matchMedia', () => {
      throw new Error('blocked');
    });
    const signals = await collectSignals();
    expect(signals.colorScheme).toBeNull();
    expect(signals.reducedMotion).toBeNull();
    expect(typeof signals.userAgent).toBe('string');
  });

  it('reports how long the expensive probes took', async () => {
    const timings: Record<string, number> = {};
    await collectSignals((name, ms) => {
      timings[name] = ms;
    });
    expect(Object.keys(timings).sort()).toEqual(['audio', 'canvas', 'fonts', 'math', 'webgl']);
    for (const ms of Object.values(timings)) {
      expect(ms).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('collectExtendedSignals', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the extended pack without throwing', async () => {
    const extended = await collectExtendedSignals();
    expect(Object.keys(extended).sort()).toEqual([
      'colorGamut',
      'contrastPreference',
      'forcedColors',
      'hdr',
      'invertedColors',
      'monochrome',
      'storageQuota',
    ]);
  });

  it('degrades to null when matchMedia throws', async () => {
    vi.stubGlobal('matchMedia', () => {
      throw new Error('blocked');
    });
    const extended = await collectExtendedSignals();
    expect(extended.colorGamut).toBeNull();
    expect(extended.hdr).toBeNull();
  });

  it('buckets the storage quota instead of reporting raw bytes', async () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      storage: { estimate: async () => ({ quota: 500_000_123 }) },
    });
    const extended = await collectExtendedSignals();
    expect(extended.storageQuota).toBe(2 * 256 * 1024 * 1024);
  });

  it('returns null when the storage API is missing', async () => {
    vi.stubGlobal('navigator', { userAgent: 'test' });
    expect((await collectExtendedSignals()).storageQuota).toBeNull();
  });
});
