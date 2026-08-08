export interface Component {
  /** The collected value. `null` means the probe was blocked or unavailable. */
  value: unknown;
  /** Milliseconds the probe took, when measured. */
  duration?: number;
}

export interface Components {
  [name: string]: Component;
}

export interface LoadOptions {
  /**
   * A WhorlID public key (`pk_live_...`). Omit it and everything stays in the
   * browser; supply it and `get()` also asks the WhorlID API to match this
   * device against previous visits.
   */
  publicKey?: string;
  /** Override the identify endpoint. Defaults to the origin the script loaded from. */
  endpoint?: string;
  /**
   * Collect the extended signal pack (display and accessibility properties).
   * These never leave the browser. Default true.
   */
  extendedSignals?: boolean;
}

export interface OfflineResult {
  mode: 'offline';
  /** 32 hex characters, computed in this browser. */
  visitorId: string;
  /** How much evidence backs the id, 0..1. A coverage measure, not a probability. */
  confidence: number;
  components: Components;
}

export interface ConnectedResult {
  mode: 'connected';
  /** Assigned by the WhorlID API from server-side matching. */
  visitorId: string;
  /** The id computed locally, for comparison. */
  localVisitorId: string;
  requestId: string;
  /** Weighted signal-agreement score in 0..1. Not a calibrated probability. */
  similarity: number;
  isReturning: boolean;
  confidence: number;
  components: Components;
}

export type GetResult = OfflineResult | ConnectedResult;

export interface Agent {
  get(): Promise<GetResult>;
}
