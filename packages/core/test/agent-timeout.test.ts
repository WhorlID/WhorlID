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

  it('treats an infinite timeout as no timeout, not as zero', async () => {
    // A timer cannot hold Infinity: it fires at once, and get() used to give up
    // before the request had a chance.
    vi.stubGlobal('fetch', answerAfter(20));
    const agent = await load({ publicKey: 'pk_live_abc', endpoint: 'https://api.test/v1/identify' });
    await expect(agent.get({ timeout: Infinity })).resolves.toMatchObject({ mode: 'connected', visitorId: 'v_1' });
  });

  it('caps a timeout too long for a timer instead of letting it fire at once', async () => {
    vi.stubGlobal('fetch', answerAfter(20));
    const agent = await load({ publicKey: 'pk_live_abc', endpoint: 'https://api.test/v1/identify' });
    await expect(agent.get({ timeout: 2 ** 32 })).resolves.toMatchObject({ mode: 'connected', visitorId: 'v_1' });
  });
});

/** A fetch that answers after `ms`, and rejects on abort as the real one does. */
function answerAfter(ms: number) {
  const body = { requestId: 'req_1', visitorId: 'v_1', similarity: 1, isReturning: false };
  return (_url: string, init: { signal: AbortSignal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response(JSON.stringify(body))), ms);
      init.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
}
