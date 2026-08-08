import { describe, expect, it } from 'vitest';
import { buildComponents, computeConfidence, computeVisitorId, identityInput } from '../src/identity.js';
import { fullExtended, fullSignals } from './fixtures.js';

describe('computeVisitorId', () => {
  it('is stable for identical input', () => {
    expect(computeVisitorId(fullSignals(), fullExtended)).toBe(
      computeVisitorId(fullSignals(), fullExtended)
    );
  });

  it('returns 32 hex characters', () => {
    expect(computeVisitorId(fullSignals(), fullExtended)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('does not depend on the order signals were collected in', () => {
    const forward = fullSignals();
    const reversed = Object.fromEntries(Object.entries(forward).reverse());
    expect(computeVisitorId(reversed, fullExtended)).toBe(
      computeVisitorId(forward, fullExtended)
    );
  });

  describe('changes when a hashed signal changes', () => {
    const baseline = computeVisitorId(fullSignals(), fullExtended);

    it.each([
      ['canvas', { canvas: 'data:image/png;base64,DIFFERENT' }],
      ['audio', { audio: '99.9' }],
      ['fonts', { fonts: ['Arial'] }],
      ['platform', { platform: 'MacIntel' }],
      ['timezone', { timezone: 'Asia/Tokyo' }],
      ['hardwareConcurrency', { hardwareConcurrency: 4 }],
    ])('%s', (_name, override) => {
      expect(computeVisitorId(fullSignals(override), fullExtended)).not.toBe(baseline);
    });

    it('webgl renderer', () => {
      const signals = fullSignals();
      const webgl = { ...(signals.webgl as object), renderer: 'Apple M2' };
      expect(computeVisitorId(fullSignals({ webgl }), fullExtended)).not.toBe(baseline);
    });

    it('colorGamut, the one extended signal that counts', () => {
      expect(computeVisitorId(fullSignals(), { ...fullExtended, colorGamut: 'p3' })).not.toBe(
        baseline
      );
    });
  });

  describe('survives changes that do not mean a new device', () => {
    const baseline = computeVisitorId(fullSignals(), fullExtended);

    it.each([
      ['a browser update', { userAgent: 'Mozilla/5.0 Chrome/999.0.0.0' }],
      ['travelling, so a new timezone offset', { timezoneOffset: 300 }],
      ['a language switch', { language: 'de-DE', languages: ['de-DE'] }],
      ['toggling dark mode', { colorScheme: 'light' }],
      ['installing a plugin', { plugins: ['PDF Viewer', 'Widevine'] }],
      ['turning cookies off', { cookieEnabled: false }],
    ])('%s', (_name, override) => {
      expect(computeVisitorId(fullSignals(override), fullExtended)).toBe(baseline);
    });

    it('opening a taskbar or zooming the page', () => {
      const screen = {
        ...(fullSignals().screen as object),
        availHeight: 1300,
        devicePixelRatio: 2,
      };
      expect(computeVisitorId(fullSignals({ screen }), fullExtended)).toBe(baseline);
    });

    it('rotating the device', () => {
      const screen = { ...(fullSignals().screen as object), width: 1440, height: 2560 };
      expect(computeVisitorId(fullSignals({ screen }), fullExtended)).toBe(baseline);
    });

    it('an accessibility preference change', () => {
      expect(computeVisitorId(fullSignals(), { ...fullExtended, forcedColors: true })).toBe(
        baseline
      );
    });
  });

  it('still produces an id when every strong probe is blocked', () => {
    const blocked = fullSignals({ canvas: null, webgl: null, audio: null, fonts: [] });
    expect(computeVisitorId(blocked, {})).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('identityInput', () => {
  it('excludes the volatile signals from what gets hashed', () => {
    const input = identityInput(fullSignals(), fullExtended);
    for (const key of ['userAgent', 'languages', 'timezoneOffset', 'plugins', 'colorScheme']) {
      expect(input).not.toHaveProperty(key);
    }
  });

  it('reduces the screen to orientation-insensitive dimensions', () => {
    expect(identityInput(fullSignals(), fullExtended).screen).toEqual({
      dimensions: [1440, 2560],
      colorDepth: 24,
      pixelDepth: 24,
    });
  });
});

describe('computeConfidence', () => {
  it('is highest when every strong probe answered', () => {
    expect(computeConfidence(fullSignals())).toBe(1);
  });

  it('drops as strong probes go missing', () => {
    const two = computeConfidence(fullSignals({ canvas: null, audio: null }));
    const one = computeConfidence(fullSignals({ canvas: null, audio: null, fonts: [] }));
    expect(two).toBeLessThan(1);
    expect(one).toBeLessThan(two);
  });

  it('caps at 0.5 when fewer than two strong probes answered', () => {
    expect(computeConfidence(fullSignals({ canvas: null, audio: null, webgl: null }))).toBeLessThanOrEqual(0.5);
  });

  it('penalises automated browsers', () => {
    expect(computeConfidence(fullSignals({ webdriver: true }))).toBeLessThan(
      computeConfidence(fullSignals())
    );
  });

  it('stays within 0..1', () => {
    const worst = computeConfidence(
      fullSignals({ canvas: null, webgl: null, audio: null, fonts: [], webdriver: true })
    );
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThanOrEqual(1);
  });

  it('treats a blank string as a blocked probe, not evidence', () => {
    expect(computeConfidence(fullSignals({ canvas: '   ' }))).toBeLessThan(
      computeConfidence(fullSignals())
    );
  });
});

describe('buildComponents', () => {
  it('reports every collected signal', () => {
    const components = buildComponents(fullSignals(), fullExtended);
    expect(components.canvas?.value).toBe(fullSignals().canvas);
    expect(components.userAgent?.value).toBe(fullSignals().userAgent);
  });

  it('namespaces extended signals so they cannot collide', () => {
    const components = buildComponents(fullSignals(), fullExtended);
    expect(components['extended.colorGamut']?.value).toBe('srgb');
  });

  it('attaches durations when they were measured', () => {
    const components = buildComponents(fullSignals(), fullExtended, { canvas: 12.5 });
    expect(components.canvas?.duration).toBe(12.5);
    expect(components.audio?.duration).toBeUndefined();
  });
});
