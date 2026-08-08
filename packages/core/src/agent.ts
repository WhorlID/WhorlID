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
import type { Agent, ConnectedResult, GetResult, LoadOptions, OfflineResult } from './types.js';

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
  signals: Record<string, unknown>
): Promise<ApiResponse> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey, signals: toIdentifyPayload(signals) }),
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
}

export function load(options: LoadOptions = {}): Promise<Agent> {
  const endpoint =
    options.endpoint ?? (scriptOrigin ? `${scriptOrigin}/v1/identify` : '/v1/identify');
  const wantExtended = options.extendedSignals !== false;

  const agent: Agent = {
    async get(): Promise<GetResult> {
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

      const api = await postIdentify(endpoint, options.publicKey, signals);
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
