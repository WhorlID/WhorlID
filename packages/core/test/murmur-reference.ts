// An independent MurmurHash3 x64 128 written with BigInt: slow, but a direct
// transcription of the reference algorithm with no 32-bit splitting to get
// wrong. The shipped implementation is checked against this one, which is a
// better regression guard than a hardcoded digest nobody can re-derive.

const MASK = (1n << 64n) - 1n;
const C1 = 0x87c37b91114253d5n;
const C2 = 0x4cf5ad432745937fn;

const rotl = (x: bigint, r: bigint): bigint => ((x << r) | (x >> (64n - r))) & MASK;
const mul = (a: bigint, b: bigint): bigint => (a * b) & MASK;

function fmix(k: bigint): bigint {
  k ^= k >> 33n;
  k = mul(k, 0xff51afd7ed558ccdn);
  k ^= k >> 33n;
  k = mul(k, 0xc4ceb9fe1a85ec53n);
  k ^= k >> 33n;
  return k;
}

const hex64 = (v: bigint): string => v.toString(16).padStart(16, '0');

export function murmur128Reference(bytes: Uint8Array, seed = 0): string {
  let h1 = BigInt(seed) & MASK;
  let h2 = BigInt(seed) & MASK;
  const nblocks = Math.floor(bytes.length / 16);

  const u64 = (off: number): bigint => {
    let v = 0n;
    for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(bytes[off + i]!);
    return v;
  };

  for (let i = 0; i < nblocks; i++) {
    let k1 = u64(i * 16);
    let k2 = u64(i * 16 + 8);

    k1 = mul(rotl(mul(k1, C1), 31n), C2);
    h1 ^= k1;
    h1 = rotl(h1, 27n);
    h1 = (h1 + h2) & MASK;
    h1 = (mul(h1, 5n) + 0x52dce729n) & MASK;

    k2 = mul(rotl(mul(k2, C2), 33n), C1);
    h2 ^= k2;
    h2 = rotl(h2, 31n);
    h2 = (h2 + h1) & MASK;
    h2 = (mul(h2, 5n) + 0x38495ab5n) & MASK;
  }

  const t = nblocks * 16;
  const rem = bytes.length & 15;
  const b = (i: number): bigint => BigInt(bytes[t + i]!);
  let k1 = 0n;
  let k2 = 0n;

  if (rem >= 15) k2 ^= b(14) << 48n;
  if (rem >= 14) k2 ^= b(13) << 40n;
  if (rem >= 13) k2 ^= b(12) << 32n;
  if (rem >= 12) k2 ^= b(11) << 24n;
  if (rem >= 11) k2 ^= b(10) << 16n;
  if (rem >= 10) k2 ^= b(9) << 8n;
  if (rem >= 9) {
    k2 ^= b(8);
    h2 ^= mul(rotl(mul(k2, C2), 33n), C1);
  }

  if (rem >= 8) k1 ^= b(7) << 56n;
  if (rem >= 7) k1 ^= b(6) << 48n;
  if (rem >= 6) k1 ^= b(5) << 40n;
  if (rem >= 5) k1 ^= b(4) << 32n;
  if (rem >= 4) k1 ^= b(3) << 24n;
  if (rem >= 3) k1 ^= b(2) << 16n;
  if (rem >= 2) k1 ^= b(1) << 8n;
  if (rem >= 1) {
    k1 ^= b(0);
    h1 ^= mul(rotl(mul(k1, C1), 31n), C2);
  }

  const len = BigInt(bytes.length);
  h1 ^= len;
  h2 ^= len;
  h1 = (h1 + h2) & MASK;
  h2 = (h2 + h1) & MASK;
  h1 = fmix(h1);
  h2 = fmix(h2);
  h1 = (h1 + h2) & MASK;
  h2 = (h2 + h1) & MASK;

  return hex64(h1) + hex64(h2);
}
