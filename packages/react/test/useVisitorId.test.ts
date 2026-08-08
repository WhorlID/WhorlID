import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVisitorId } from '../src/useVisitorId.js';

const mocks = vi.hoisted(() => ({ get: vi.fn(), load: vi.fn() }));

vi.mock('@whorlid/whorlid', () => ({
  load: mocks.load,
}));

function mockResult(visitorId = 'a'.repeat(32)) {
  return { mode: 'offline' as const, visitorId, confidence: 0.85, components: {} };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('useVisitorId', () => {
  it('starts loading, then resolves to an id', async () => {
    mocks.get.mockResolvedValue(mockResult());
    mocks.load.mockResolvedValue({ get: mocks.get });

    const { result } = renderHook(() => useVisitorId());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.visitorId).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.visitorId).toBe('a'.repeat(32));
    expect(result.current.confidence).toBe(0.85);
    expect(result.current.error).toBeNull();
  });

  it('collects once, not on every render', async () => {
    mocks.get.mockResolvedValue(mockResult());
    mocks.load.mockResolvedValue({ get: mocks.get });

    const { result, rerender } = renderHook(() => useVisitorId());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender();
    rerender();

    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it('does not re-collect when given a fresh options object each render', async () => {
    mocks.get.mockResolvedValue(mockResult());
    mocks.load.mockResolvedValue({ get: mocks.get });

    const { result, rerender } = renderHook(() => useVisitorId({ extendedSignals: true }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it('re-collects when an option actually changes', async () => {
    mocks.get.mockResolvedValue(mockResult());
    mocks.load.mockResolvedValue({ get: mocks.get });

    const { result, rerender } = renderHook(
      ({ publicKey }: { publicKey?: string }) => useVisitorId({ publicKey }),
      { initialProps: { publicKey: undefined as string | undefined } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ publicKey: 'pk_live_abc' });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  });

  it('reports a failure without throwing', async () => {
    mocks.get.mockRejectedValue(new Error('usage_limit_exceeded'));
    mocks.load.mockResolvedValue({ get: mocks.get });

    const { result } = renderHook(() => useVisitorId({ publicKey: 'pk_live_abc' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('usage_limit_exceeded');
    expect(result.current.visitorId).toBeNull();
  });

  it('ignores a result that arrives after unmount', async () => {
    let resolve!: (value: unknown) => void;
    mocks.get.mockReturnValue(new Promise((r) => { resolve = r; }));
    mocks.load.mockResolvedValue({ get: mocks.get });

    const { unmount } = renderHook(() => useVisitorId());
    unmount();
    resolve(mockResult());

    // A setState after unmount would surface as an act/console error here.
    await new Promise((r) => setTimeout(r, 0));
  });
});
