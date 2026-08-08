/**
 * JSON stringify with recursively sorted object keys.
 *
 * The visitor id is a hash of a JSON string, so key order has to be fixed.
 * Two browsers can enumerate the same object's keys in a different order and
 * would otherwise hash to two different ids for one device.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
