// The public API.
//
//   import { load } from '@whorlid/whorlid';
//   const wh = await load();                        // offline, no network
//   const { visitorId, confidence } = await wh.get();
//
//   const wh = await load({ publicKey: 'pk_live_...' });  // server matching
//   const { visitorId, similarity } = await wh.get();
//
// Offline mode never touches the network. Connected mode sends signals to the
// WhorlID API, which compares them against previous visits and returns a
// server-assigned visitor id. Browser results are informational either way:
// signals are public JavaScript output and can be replayed or fabricated, so a
// backend that cares should verify the requestId server-to-server.

import { collectSignals } from './collector.js';
import { collectExtendedSignals } from './signals-extra.js';
import { toIdentifyPayload } from './identify-schema.js';
import { buildComponents, computeConfidence, computeVisitorId } from './identity.js';
import type {
  Agent,
  ConnectedResult,
  GetOptions,
  GetResult,
  LoadOptions,
  OfflineResult,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 10_000;

/** The longest delay a timer can hold (2^31 - 1 ms, about 24.8 days). */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * The delay to give the timer, or null for no timeout. A timer cannot hold
 * Infinity or anything past MAX_TIMER_MS: it fires at once instead, so get()
 * would give up before the request started. A value that is not a finite
 * positive number means no timeout, and one too large for a timer is capped.
 */
function timerDelay(timeout: number): number | null {
  if (!Number.isFinite(timeout) || timeout <= 0) return null;
  return Math.min(timeout, MAX_TIMER_MS);
}

// Captured at script load: document.currentScript is only valid during the
// initial synchronous execution of the bundle. Guarded so importing this
// module under SSR does not throw.
const scriptOrigin: string | null = (() => {
  try {
    const el = document.currentScript as HTMLScriptElement | null;
    if (el && el.src) return new URL(el.src).origin;
  } catch {
    /* no document, or an opaque src */
  }
  return null;
})();

interface ApiResponse {
  requestId: string;
  visitorId: string;
  similarity: number;
  isReturning: boolean;
}

async function postIdentify(
  endpoint: string,
  publicKey: string,
  signals: Record<string, unknown>,
  timeout: number
): Promise<ApiResponse> {
  // A hung API must not hang the page that called get(): abort the request
  // and the body read after the timeout.
  const timeoutMs = timerDelay(timeout);
  const controller = new AbortController();
  const timer = timeoutMs === null ? undefined : setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ publicKey, signals: toIdentifyPayload(signals) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      let message = `identify failed with status ${res.status}`;
      try {
        const body = await res.json();
        if (body && body.error) message = `identify failed: ${body.error}`;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(message);
    }
    return (await res.json()) as ApiResponse;
  } catch (err) {
    if (controller.signal.aborted) throw new Error(`identify timed out after ${timeoutMs} ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function load(options: LoadOptions = {}): Promise<Agent> {
  const endpoint =
    options.endpoint ?? (scriptOrigin ? `${scriptOrigin}/v1/identify` : '/v1/identify');
  const wantExtended = options.extendedSignals !== false;

  const agent: Agent = {
    async get(getOptions: GetOptions = {}): Promise<GetResult> {
      const durations: Record<string, number> = {};
      const signals = await collectSignals((name, ms) => {
        durations[name] = ms;
      });
      const extended = wantExtended ? await collectExtendedSignals() : {};

      const localVisitorId = computeVisitorId(signals, extended);
      const confidence = computeConfidence(signals);
      const components = buildComponents(signals, extended, durations);

      if (!options.publicKey) {
        const result: OfflineResult = {
          mode: 'offline',
          visitorId: localVisitorId,
          confidence,
          components,
        };
        return result;
      }

      const api = await postIdentify(
        endpoint,
        options.publicKey,
        signals,
        getOptions.timeout ?? DEFAULT_TIMEOUT_MS
      );
      const result: ConnectedResult = {
        mode: 'connected',
        visitorId: api.visitorId,
        localVisitorId,
        requestId: api.requestId,
        similarity: api.similarity,
        isReturning: api.isReturning,
        confidence,
        components,
      };
      return result;
    },
  };

  return Promise.resolve(agent);
}
