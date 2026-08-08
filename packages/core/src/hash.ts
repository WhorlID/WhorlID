// MurmurHash3 x64 128-bit, over UTF-8 bytes.
//
// Deliberately not crypto.subtle: that API is asynchronous and unavailable on
// insecure origins, and this has to run synchronously on http:// and file://
// pages. This is an identity hash, not a security primitive, so a fast
// non-cryptographic function is the right tool. Do not "upgrade" it: the
// output is a stable id that users store, and changing the algorithm changes
// every id in the world.

/** A 64-bit value as [high32, low32]. JS bitwise ops are 32-bit. */
type X64 = [number, number];

function x64Add(m: X64, n: X64): X64 {
  const mp: number[] = [m[0] >>> 16, m[0] & 0xffff, m[1] >>> 16, m[1] & 0xffff];
  const np: number[] = [n[0] >>> 16, n[0] & 0xffff, n[1] >>> 16, n[1] & 0xffff];
  const o = [0, 0, 0, 0];
  o[3]! += mp[3]! + np[3]!;
  o[2]! += o[3]! >>> 16;
  o[3]! &= 0xffff;
  o[2]! += mp[2]! + np[2]!;
  o[1]! += o[2]! >>> 16;
  o[2]! &= 0xffff;
  o[1]! += mp[1]! + np[1]!;
  o[0]! += o[1]! >>> 16;
  o[1]! &= 0xffff;
  o[0]! += mp[0]! + np[0]!;
  o[0]! &= 0xffff;
  return [(o[0]! << 16) | o[1]!, (o[2]! << 16) | o[3]!];
}

function x64Multiply(m: X64, n: X64): X64 {
  const mp: number[] = [m[0] >>> 16, m[0] & 0xffff, m[1] >>> 16, m[1] & 0xffff];
  const np: number[] = [n[0] >>> 16, n[0] & 0xffff, n[1] >>> 16, n[1] & 0xffff];
  const o = [0, 0, 0, 0];
  o[3]! += mp[3]! * np[3]!;
  o[2]! += o[3]! >>> 16;
  o[3]! &= 0xffff;
  o[2]! += mp[2]! * np[3]!;
  o[1]! += o[2]! >>> 16;
  o[2]! &= 0xffff;
  o[2]! += mp[3]! * np[2]!;
  o[1]! += o[2]! >>> 16;
  o[2]! &= 0xffff;
  o[1]! += mp[1]! * np[3]!;
  o[0]! += o[1]! >>> 16;
  o[1]! &= 0xffff;
  o[1]! += mp[2]! * np[2]!;
  o[0]! += o[1]! >>> 16;
  o[1]! &= 0xffff;
  o[1]! += mp[3]! * np[1]!;
  o[0]! += o[1]! >>> 16;
  o[1]! &= 0xffff;
  o[0]! += mp[0]! * np[3]! + mp[1]! * np[2]! + mp[2]! * np[1]! + mp[3]! * np[0]!;
  o[0]! &= 0xffff;
  return [(o[0]! << 16) | o[1]!, (o[2]! << 16) | o[3]!];
}

function x64Rotl(m: X64, n: number): X64 {
  n %= 64;
  if (n === 32) return [m[1], m[0]];
  if (n < 32) {
    return [(m[0] << n) | (m[1] >>> (32 - n)), (m[1] << n) | (m[0] >>> (32 - n))];
  }
  n -= 32;
  return [(m[1] << n) | (m[0] >>> (32 - n)), (m[0] << n) | (m[1] >>> (32 - n))];
}

function x64LeftShift(m: X64, n: number): X64 {
  n %= 64;
  if (n === 0) return m;
  if (n < 32) return [(m[0] << n) | (m[1] >>> (32 - n)), m[1] << n];
  return [m[1] << (n - 32), 0];
}

function x64Xor(m: X64, n: X64): X64 {
  return [m[0] ^ n[0], m[1] ^ n[1]];
}

function x64Fmix(h: X64): X64 {
  h = x64Xor(h, [0, h[0] >>> 1]);
  h = x64Multiply(h, [0xff51afd7, 0xed558ccd]);
  h = x64Xor(h, [0, h[0] >>> 1]);
  h = x64Multiply(h, [0xc4ceb9fe, 0x1a85ec53]);
  h = x64Xor(h, [0, h[0] >>> 1]);
  return h;
}

/** UTF-8 encode. TextEncoder when present, identical hand-rolled fallback otherwise. */
export function utf8Bytes(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);

  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdfff) {
      // Combine a well-formed surrogate pair into one code point. An unpaired
      // surrogate becomes U+FFFD, which is what TextEncoder does: the two
      // paths have to agree byte for byte or one browser would hash a string
      // differently from another.
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        code = ((code - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        i++;
      } else {
        code = 0xfffd;
      }
    }
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return new Uint8Array(out);
}

function hex32(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}

/** MurmurHash3 x64 128 of a string, as 32 lowercase hex characters. */
export function murmur128(input: string, seed = 0): string {
  const bytes = utf8Bytes(input);
  const len = bytes.length;
  const remainder = len % 16;
  const blocks = len - remainder;
  const b = (i: number): number => bytes[i]!;
  const u32 = (i: number): number => b(i) | (b(i + 1) << 8) | (b(i + 2) << 16) | (b(i + 3) << 24);

  const c1: X64 = [0x87c37b91, 0x114253d5];
  const c2: X64 = [0x4cf5ad43, 0x2745937f];
  let h1: X64 = [0, seed];
  let h2: X64 = [0, seed];

  for (let i = 0; i < blocks; i += 16) {
    let k1: X64 = [u32(i + 4), u32(i)];
    let k2: X64 = [u32(i + 12), u32(i + 8)];

    k1 = x64Multiply(k1, c1);
    k1 = x64Rotl(k1, 31);
    k1 = x64Multiply(k1, c2);
    h1 = x64Xor(h1, k1);
    h1 = x64Rotl(h1, 27);
    h1 = x64Add(h1, h2);
    h1 = x64Add(x64Multiply(h1, [0, 5]), [0, 0x52dce729]);

    k2 = x64Multiply(k2, c2);
    k2 = x64Rotl(k2, 33);
    k2 = x64Multiply(k2, c1);
    h2 = x64Xor(h2, k2);
    h2 = x64Rotl(h2, 31);
    h2 = x64Add(h2, h1);
    h2 = x64Add(x64Multiply(h2, [0, 5]), [0, 0x38495ab5]);
  }

  let k1: X64 = [0, 0];
  let k2: X64 = [0, 0];
  const t = blocks;

  /* eslint-disable no-fallthrough */
  switch (remainder) {
    case 15:
      k2 = x64Xor(k2, x64LeftShift([0, b(t + 14)], 48));
    case 14:
      k2 = x64Xor(k2, x64LeftShift([0, b(t + 13)], 40));
    case 13:
      k2 = x64Xor(k2, x64LeftShift([0, b(t + 12)], 32));
    case 12:
      k2 = x64Xor(k2, x64LeftShift([0, b(t + 11)], 24));
    case 11:
      k2 = x64Xor(k2, x64LeftShift([0, b(t + 10)], 16));
    case 10:
      k2 = x64Xor(k2, x64LeftShift([0, b(t + 9)], 8));
    case 9:
      k2 = x64Xor(k2, [0, b(t + 8)]);
      k2 = x64Multiply(k2, c2);
      k2 = x64Rotl(k2, 33);
      k2 = x64Multiply(k2, c1);
      h2 = x64Xor(h2, k2);
    case 8:
      k1 = x64Xor(k1, x64LeftShift([0, b(t + 7)], 56));
    case 7:
      k1 = x64Xor(k1, x64LeftShift([0, b(t + 6)], 48));
    case 6:
      k1 = x64Xor(k1, x64LeftShift([0, b(t + 5)], 40));
    case 5:
      k1 = x64Xor(k1, x64LeftShift([0, b(t + 4)], 32));
    case 4:
      k1 = x64Xor(k1, x64LeftShift([0, b(t + 3)], 24));
    case 3:
      k1 = x64Xor(k1, x64LeftShift([0, b(t + 2)], 16));
    case 2:
      k1 = x64Xor(k1, x64LeftShift([0, b(t + 1)], 8));
    case 1:
      k1 = x64Xor(k1, [0, b(t)]);
      k1 = x64Multiply(k1, c1);
      k1 = x64Rotl(k1, 31);
      k1 = x64Multiply(k1, c2);
      h1 = x64Xor(h1, k1);
  }
  /* eslint-enable no-fallthrough */

  h1 = x64Xor(h1, [0, len]);
  h2 = x64Xor(h2, [0, len]);
  h1 = x64Add(h1, h2);
  h2 = x64Add(h2, h1);
  h1 = x64Fmix(h1);
  h2 = x64Fmix(h2);
  h1 = x64Add(h1, h2);
  h2 = x64Add(h2, h1);

  return hex32(h1[0]) + hex32(h1[1]) + hex32(h2[0]) + hex32(h2[1]);
}
