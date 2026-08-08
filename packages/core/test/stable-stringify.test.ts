import { describe, expect, it } from 'vitest';
import { stableStringify } from '../src/stable-stringify.js';

describe('stableStringify', () => {
  it('is insensitive to key insertion order', () => {
    const a = { canvas: 'x', audio: '1', platform: 'Win32' };
    const b = { platform: 'Win32', audio: '1', canvas: 'x' };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('sorts nested object keys too', () => {
    const a = { webgl: { vendor: 'v', renderer: 'r' } };
    const b = { webgl: { renderer: 'r', vendor: 'v' } };
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(stableStringify(a)).toBe('{"webgl":{"renderer":"r","vendor":"v"}}');
  });

  it('preserves array order, which is meaningful', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('sorts keys inside array elements', () => {
    expect(stableStringify([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it('handles primitives and null', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(0)).toBe('0');
    expect(stableStringify('')).toBe('""');
    expect(stableStringify(false)).toBe('false');
  });

  it('distinguishes an absent key from a null one', () => {
    expect(stableStringify({ a: null })).not.toBe(stableStringify({}));
  });
});
