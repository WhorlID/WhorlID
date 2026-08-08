import { afterEach, describe, expect, it, vi } from 'vitest';
import { murmur128, utf8Bytes } from '../src/hash.js';
import { murmur128Reference } from './murmur-reference.js';

/** Deterministic pseudo-random strings, so a failure is always reproducible. */
function seededStrings(count: number): string[] {
  let state = 12345;
  const next = (): number => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state;
  };
  const alphabet = 'abcXYZ019 {}":,\\/é中\u{1F510}';
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    // Lengths 0..47 cover every tail remainder and multi-block inputs.
    const len = next() % 48;
    let s = '';
    for (let j = 0; j < len; j++) s += alphabet[next() % alphabet.length];
    out.push(s);
  }
  return out;
}

describe('murmur128', () => {
  it('hashes the empty string to zero', () => {
    expect(murmur128('')).toBe('0'.repeat(32));
  });

  it('always returns 32 lowercase hex characters', () => {
    for (const input of seededStrings(50)) {
      expect(murmur128(input)).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it('matches an independent BigInt implementation across tail lengths', () => {
    for (const input of seededStrings(400)) {
      expect(murmur128(input), `input: ${JSON.stringify(input)}`).toBe(
        murmur128Reference(utf8Bytes(input))
      );
    }
  });

  it('matches the reference on inputs spanning many blocks', () => {
    const long = 'data:image/png;base64,' + 'QUJDREVG'.repeat(500);
    expect(murmur128(long)).toBe(murmur128Reference(utf8Bytes(long)));
  });

  it('is deterministic', () => {
    expect(murmur128('whorlid')).toBe(murmur128('whorlid'));
  });

  it('changes when the input changes by one character', () => {
    expect(murmur128('whorlid')).not.toBe(murmur128('whorlie'));
  });

  it('respects the seed', () => {
    expect(murmur128('whorlid', 1)).not.toBe(murmur128('whorlid', 0));
    expect(murmur128('whorlid', 1)).toBe(murmur128Reference(utf8Bytes('whorlid'), 1));
  });
});

describe('utf8Bytes', () => {
  it('encodes ASCII one byte per character', () => {
    expect(Array.from(utf8Bytes('abc'))).toEqual([0x61, 0x62, 0x63]);
  });

  it('encodes multi-byte code points', () => {
    expect(Array.from(utf8Bytes('é'))).toEqual([0xc3, 0xa9]);
    expect(Array.from(utf8Bytes('中'))).toEqual([0xe4, 0xb8, 0xad]);
    expect(Array.from(utf8Bytes('\u{1F510}'))).toEqual([0xf0, 0x9f, 0x94, 0x90]);
  });

  describe('without TextEncoder', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('falls back to an encoder that agrees byte for byte', () => {
      const inputs = ['', 'abc', 'é中', '\u{1F510}', ...seededStrings(50)];
      const expected = inputs.map((s) => Array.from(utf8Bytes(s)));
      vi.stubGlobal('TextEncoder', undefined);
      inputs.forEach((s, i) => {
        expect(Array.from(utf8Bytes(s)), `input: ${JSON.stringify(s)}`).toEqual(expected[i]);
      });
    });

    it('encodes a lone surrogate without throwing', () => {
      vi.stubGlobal('TextEncoder', undefined);
      expect(() => utf8Bytes('\ud800')).not.toThrow();
    });
  });
});
