// The guardrail that keeps this library from breaking the paid API.
//
// POST /v1/identify validates with additionalProperties:false and does not
// strip unknown fields, so a single extra signal key turns every connected
// request into a 400. These tests fail the moment this library would send
// something the API refuses.

import Ajv from 'ajv';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { load } from '../src/agent.js';
import { SIGNAL_KEYS, toIdentifyPayload } from '../src/identify-schema.js';
import { collectExtendedSignals } from '../src/signals-extra.js';
import {
  IDENTIFY_BODY_LIMIT,
  SCHEMA_SIGNAL_KEYS,
  identifyBodySchema,
} from './identify-body.schema.js';
import { fullSignals } from './fixtures.js';

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(identifyBodySchema);

function expectValid(body: unknown): void {
  const ok = validate(body);
  expect(ok ? [] : validate.errors, JSON.stringify(validate.errors, null, 2)).toEqual([]);
  expect(ok).toBe(true);
}

describe('toIdentifyPayload', () => {
  it('produces a body the API accepts', () => {
    expectValid({ publicKey: 'pk_live_abc', signals: toIdentifyPayload(fullSignals()) });
  });

  it('only emits keys the API declares', () => {
    for (const key of SIGNAL_KEYS) {
      expect(SCHEMA_SIGNAL_KEYS).toContain(key);
    }
    expect([...SIGNAL_KEYS].sort()).toEqual([...SCHEMA_SIGNAL_KEYS].sort());
  });

  it('drops the extended signal pack', async () => {
    const extended = await collectExtendedSignals();
    const payload = toIdentifyPayload({ ...fullSignals(), ...extended, extended });
    for (const key of Object.keys(extended)) {
      expect(payload).not.toHaveProperty(key);
    }
    expect(payload).not.toHaveProperty('extended');
    expectValid({ publicKey: 'pk_live_abc', signals: payload });
  });

  it('never forwards serverUserAgent, which the API reserves for itself', () => {
    const payload = toIdentifyPayload({
      ...fullSignals(),
      serverUserAgent: 'forged by the client',
    });
    expect(payload).not.toHaveProperty('serverUserAgent');
  });

  it('strips unknown keys nested inside screen and webgl', () => {
    const signals = fullSignals();
    const payload = toIdentifyPayload({
      ...signals,
      screen: { ...(signals.screen as object), orientation: 'landscape' },
      webgl: { ...(signals.webgl as object), precision: 'highp' },
    });
    expect(payload.screen).not.toHaveProperty('orientation');
    expect(payload.webgl).not.toHaveProperty('precision');
    expectValid({ publicKey: 'pk_live_abc', signals: payload });
  });

  it('keeps collectorVersion so the server can attribute the signal set', () => {
    expect(toIdentifyPayload(fullSignals()).collectorVersion).toBe('1');
  });

  it('passes null probes through rather than dropping them', () => {
    const payload = toIdentifyPayload(fullSignals({ canvas: null, webgl: null, audio: null }));
    expect(payload.canvas).toBeNull();
    expect(payload.webgl).toBeNull();
    expectValid({ publicKey: 'pk_live_abc', signals: payload });
  });
});

describe('connected mode over the wire', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a body that validates and fits the size limit', async () => {
    let sent: { url: string; body: string } | null = null;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      sent = { url, body: String(init.body) };
      return {
        ok: true,
        json: async () => ({
          requestId: 'req_1',
          visitorId: 'vis_1',
          similarity: 0.94,
          isReturning: true,
        }),
      };
    });

    const agent = await load({ publicKey: 'pk_live_abc', endpoint: 'https://api.test/v1/identify' });
    const result = await agent.get();

    expect(sent).not.toBeNull();
    expect(sent!.url).toBe('https://api.test/v1/identify');
    const body = JSON.parse(sent!.body);
    expectValid(body);
    expect(body.publicKey).toBe('pk_live_abc');
    expect(sent!.body.length).toBeLessThan(IDENTIFY_BODY_LIMIT);

    expect(result.mode).toBe('connected');
    if (result.mode !== 'connected') throw new Error('expected connected mode');
    expect(result.visitorId).toBe('vis_1');
    expect(result.requestId).toBe('req_1');
    expect(result.similarity).toBe(0.94);
    expect(result.localVisitorId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('surfaces the API error message', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: 'usage_limit_exceeded' }),
    }));
    const agent = await load({ publicKey: 'pk_live_abc', endpoint: 'https://api.test/v1/identify' });
    await expect(agent.get()).rejects.toThrow('usage_limit_exceeded');
  });

  it('still fails usefully when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    }));
    const agent = await load({ publicKey: 'pk_live_abc', endpoint: 'https://api.test/v1/identify' });
    await expect(agent.get()).rejects.toThrow('502');
  });
});

describe('offline mode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes no network request at all', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const agent = await load();
    const result = await agent.get();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.mode).toBe('offline');
    expect(result.visitorId).toMatch(/^[0-9a-f]{32}$/);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('returns the same id twice in the same browser', async () => {
    const agent = await load();
    const first = await agent.get();
    const second = await agent.get();
    expect(first.visitorId).toBe(second.visitorId);
  });

  it('can skip the extended pack', async () => {
    const agent = await load({ extendedSignals: false });
    const result = await agent.get();
    const extendedKeys = Object.keys(result.components).filter((k) => k.startsWith('extended.'));
    expect(extendedKeys).toEqual([]);
  });
});
