import { afterEach, describe, expect, it, vi } from 'vitest';
import { load } from '../src/agent.js';

describe('connected mode timeout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gives up after the timeout instead of hanging the page', async () => {
    vi.stubGlobal(
      'fetch',
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
        ),
    );
    const agent = await load({ publicKey: 'pk_live_abc', endpoint: 'https://api.test/v1/identify' });
    await expect(agent.get({ timeout: 50 })).rejects.toThrow(/timed out after 50 ms/);
  });
});
