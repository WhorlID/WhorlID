// A copy of the WhorlID API's request schema for POST /v1/identify, used to
// prove connected-mode payloads validate before they reach the network.
//
// Test-only: this never ships in the bundle. When the API schema changes, this
// copy has to be updated by hand. See SYNC.md.

const SHORT = 64;
const MEDIUM = 256;
const LONG = 512;

const nullable = (schema: Record<string, unknown>) => ({
  ...schema,
  type: Array.isArray(schema.type)
    ? [...(schema.type as string[]), 'null']
    : [schema.type, 'null'],
});

const nullableString = (maxLength: number) => nullable({ type: 'string', maxLength });
const nullableNumber = (minimum: number, maximum: number) =>
  nullable({ type: 'number', minimum, maximum });
const nullableBoolean = () => nullable({ type: 'boolean' });
const nullableStringArray = (maxItems: number, itemMaxLength: number) =>
  nullable({
    type: 'array',
    maxItems,
    items: { type: 'string', maxLength: itemMaxLength },
  });

const screenSchema = nullable({
  type: 'object',
  additionalProperties: false,
  properties: {
    width: nullableNumber(0, 1_000_000),
    height: nullableNumber(0, 1_000_000),
    availWidth: nullableNumber(0, 1_000_000),
    availHeight: nullableNumber(0, 1_000_000),
    colorDepth: nullableNumber(0, 1024),
    pixelDepth: nullableNumber(0, 1024),
    devicePixelRatio: nullableNumber(0, 100),
  },
});

const webglSchema = nullable({
  type: 'object',
  additionalProperties: false,
  properties: {
    vendor: nullableString(MEDIUM),
    renderer: nullableString(MEDIUM),
    version: nullableString(MEDIUM),
    shadingLanguageVersion: nullableString(MEDIUM),
    unmaskedVendor: nullableString(MEDIUM),
    unmaskedRenderer: nullableString(MEDIUM),
    extensions: nullableStringArray(256, 128),
    params: nullable({
      type: 'object',
      maxProperties: 64,
      additionalProperties: {
        anyOf: [
          { type: ['string', 'number', 'boolean', 'null'], maxLength: MEDIUM },
          { type: 'array', maxItems: 8, items: { type: 'number' } },
        ],
      },
    }),
  },
});

const signalsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    collectorVersion: nullableString(SHORT),
    userAgent: nullableString(LONG),
    platform: nullableString(SHORT),
    webdriver: nullableBoolean(),
    languages: nullableStringArray(32, 32),
    language: nullableString(32),
    timezone: nullableString(SHORT),
    timezoneOffset: nullableNumber(-1440, 1440),
    hardwareConcurrency: nullableNumber(0, 4096),
    deviceMemory: nullableNumber(0, 1024),
    maxTouchPoints: nullableNumber(0, 256),
    cookieEnabled: nullableBoolean(),
    vendor: nullableString(MEDIUM),
    screen: screenSchema,
    colorScheme: nullableString(16),
    reducedMotion: nullableBoolean(),
    touchSupport: nullableBoolean(),
    plugins: nullableStringArray(64, MEDIUM),
    canvas: nullableString(20_000),
    webgl: webglSchema,
    audio: nullable({ type: ['string', 'number'], maxLength: SHORT }),
    fonts: nullableStringArray(512, 128),
    math: nullable({
      type: 'object',
      maxProperties: 32,
      additionalProperties: { type: ['number', 'null'] },
    }),
    localStorage: nullableBoolean(),
    sessionStorage: nullableBoolean(),
    indexedDB: nullableBoolean(),
  },
};

export const identifyBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['signals'],
  properties: {
    publicKey: { type: 'string', maxLength: 128, pattern: '^pk_' },
    signals: signalsSchema,
  },
};

export const IDENTIFY_BODY_LIMIT = 64 * 1024;

/** The signal keys the API knows about, derived from the schema itself. */
export const SCHEMA_SIGNAL_KEYS = Object.keys(signalsSchema.properties);
