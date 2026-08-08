export { load } from './agent.js';
export { collectSignals, COLLECTOR_VERSION } from './collector.js';
export type { CollectedSignals, TimingSink } from './collector.js';
export { collectExtendedSignals } from './signals-extra.js';
export type { ExtendedSignals } from './signals-extra.js';
export {
  buildComponents,
  computeConfidence,
  computeVisitorId,
  identityInput,
  HASHED_SIGNALS,
} from './identity.js';
export { murmur128 } from './hash.js';
export { stableStringify } from './stable-stringify.js';
export { toIdentifyPayload, SIGNAL_KEYS } from './identify-schema.js';
export type {
  Agent,
  Component,
  Components,
  ConnectedResult,
  GetResult,
  LoadOptions,
  OfflineResult,
} from './types.js';
