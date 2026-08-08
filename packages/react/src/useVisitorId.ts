import { useEffect, useState } from 'react';
import { load } from 'whorlid';
import type { GetResult, LoadOptions } from 'whorlid';

export interface UseVisitorIdResult {
  /** null until collection finishes, or if it failed. */
  visitorId: string | null;
  confidence: number | null;
  /** The full result, including every collected component. */
  data: GetResult | null;
  isLoading: boolean;
  error: Error | null;
}

interface State {
  data: GetResult | null;
  error: Error | null;
  isLoading: boolean;
}

const INITIAL: State = { data: null, error: null, isLoading: true };

/**
 * Identify the current browser once per mount.
 *
 *   const { visitorId, isLoading } = useVisitorId();
 *
 * Collection runs once and is not repeated on re-render. It re-runs only if
 * one of the options actually changes, so passing a fresh object literal every
 * render is fine.
 */
export function useVisitorId(options: LoadOptions = {}): UseVisitorIdResult {
  const { publicKey, endpoint, extendedSignals } = options;
  const [state, setState] = useState<State>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev.isLoading ? prev : { ...prev, isLoading: true }));

    load({ publicKey, endpoint, extendedSignals })
      .then((agent) => agent.get())
      .then((data) => {
        if (!cancelled) setState({ data, error: null, isLoading: false });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const error = cause instanceof Error ? cause : new Error(String(cause));
        setState({ data: null, error, isLoading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey, endpoint, extendedSignals]);

  return {
    visitorId: state.data?.visitorId ?? null,
    confidence: state.data?.confidence ?? null,
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
  };
}
