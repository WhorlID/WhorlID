# whorlid

Browser fingerprinting that works with no backend. Read the signals a browser
exposes, turn them into a stable id, and get a plain object of everything that
went into it.

```bash
npm install @whorlid/whorlid
```

```js
import { load } from '@whorlid/whorlid';

const wh = await load();
const { visitorId, confidence, components } = await wh.get();
// visitorId  '4f2a91c0e83b17d95a6c40be2f118db3'
// confidence 1
// components { canvas: {…}, webgl: {…}, audio: {…}, … }
```

No account, no key, no request. Everything above happened in the tab.

**[See it run on your own browser →](https://whorlid.github.io/WhorlID/)**

- MIT licensed. Not source-available, not a delayed-open licence: MIT.
- Zero runtime dependencies. ~13 kB minified for the browser build.
- Works offline, or connects to a hosted API when you need cross-session accuracy.
- TypeScript types included. Ships ESM, CJS, and a plain `<script>` build.

## What you get

`get()` returns the id, a confidence value, and every component that was read:

```js
{
  mode: 'offline',
  visitorId: '4f2a91c0e83b17d95a6c40be2f118db3',
  confidence: 1,
  components: {
    canvas: { value: 'data:image/png;base64,…', duration: 12.4 },
    webgl:  { value: { renderer: 'ANGLE (NVIDIA…)', … }, duration: 4.6 },
    audio:  { value: '124.0434752', duration: 8.4 },
    fonts:  { value: ['Arial', 'Calibri', …], duration: 1.7 },
    userAgent: { value: 'Mozilla/5.0 …' },
    // …33 in total
  }
}
```

### Signals collected

Canvas, WebGL (vendor, renderer, unmasked renderer, extensions, 17 parameters),
audio (OfflineAudioContext), installed fonts, math/FPU constants, platform,
timezone, languages, screen geometry, colour depth, hardware concurrency,
device memory, touch points, plugins, storage availability, and an extended
pack: colour gamut, HDR, contrast and forced-colours preferences, inverted
colours, monochrome depth, and a bucketed storage quota.

Every probe is independent, and a blocked one returns `null` instead of
throwing. A browser that refuses canvas still produces the rest.

### What goes into the id

Only signals that stay put when the device does. Canvas, WebGL, audio, fonts,
math, platform, timezone, core counts, colour depth, colour gamut, and the
screen as an orientation-insensitive pair.

Everything else is reported but excluded, because it moves without the device
moving: the user agent changes on every browser update, `availHeight` changes
when a taskbar appears, `devicePixelRatio` changes when you zoom, the timezone
offset changes when you fly. Hashing those would mint a new id for the same
machine. The exact list is exported as `HASHED_SIGNALS`.

### Confidence

`confidence` counts how many high-entropy probes actually answered, scaled to
0..1, with a penalty for `navigator.webdriver`.

It is coverage, not probability. Nothing running in a single tab has seen
another visit, so nothing running in a single tab can tell you how likely two
visits are the same device. Any library that reports a cross-visit probability
from local data alone is reporting a guess.

## Honest limits

**The id moves when the browser does.** A major version bump, a GPU driver
update, or a hardened privacy mode can shift enough signals to produce a new
id. A local hash has no memory of the previous visit, so it cannot tell drift
from a genuinely different device. In practice, expect a stable id for weeks,
not years.

**It is not proof of identity.** Every signal is public JavaScript output. It
can be replayed or fabricated by anyone willing to script a browser. Treat the
id as one risk input, never as an authentication factor.

**Fingerprinting is regulated.** In the EU and UK, reading device
characteristics for identification generally needs a lawful basis and often
consent, the same as a cookie. Fraud prevention and account security are the
defensible uses. This library gives you the mechanism, not the compliance.

## Cross-session matching

Recognising a device *across* visits is a server problem: it needs the earlier
signals to compare against, so that one drifting probe does not read as a new
device. Pass a key and the same call does that instead:

```js
const wh = await load({ publicKey: 'pk_live_…' });
const { visitorId, similarity, isReturning } = await wh.get();
```

The signals go to the [WhorlID](https://whorlid.com) API, which compares them
component by component against previous visits and returns a server-assigned
id. `similarity` is a weighted agreement score, still not a calibrated
probability.

Browser results are informational either way. A backend that cares should
verify the `requestId` server-to-server rather than trusting what the page
reports:

```
GET /v1/events/{requestId}
Authorization: Bearer sk_live_…
```

## Install

### npm

```bash
npm install @whorlid/whorlid
```

### Script tag

```html
<script src="https://cdn.jsdelivr.net/npm/@whorlid/whorlid/dist/whorl.v1.js"></script>
<script>
  whorlid.load()
    .then((wh) => wh.get())
    .then(({ visitorId }) => console.log(visitorId));
</script>
```

### React

```bash
npm install @whorlid/react
```

```jsx
import { useVisitorId } from '@whorlid/react';

function Example() {
  const { visitorId, confidence, isLoading } = useVisitorId();
  if (isLoading) return <p>Identifying…</p>;
  return <p>{visitorId} ({confidence})</p>;
}
```

Collection runs once per mount, not on every render.

## API

### `load(options?): Promise<Agent>`

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `publicKey` | `string` | none | Supply it to use the WhorlID API instead of a local hash. |
| `endpoint` | `string` | script origin | Override the identify URL. |
| `extendedSignals` | `boolean` | `true` | Collect the extended pack. Local only either way. |

### `agent.get(options?): Promise<GetResult>`

Returns `OfflineResult` (`mode: 'offline'`) or `ConnectedResult`
(`mode: 'connected'`), discriminated on `mode`. The connected result adds
`requestId`, `similarity`, `isReturning`, and `localVisitorId` so you can
compare the two.

In connected mode `get()` rejects if the API has not answered after
`options.timeout` milliseconds (default 10000), so a slow or unreachable API
cannot hang your page. Treat a rejection as "no device signal" and carry on
with your normal flow. Offline mode makes no request and ignores the timeout.

### Also exported

`collectSignals`, `collectExtendedSignals`, `computeVisitorId`,
`computeConfidence`, `identityInput`, `HASHED_SIGNALS`, `murmur128`,
`stableStringify`, `toIdentifyPayload`, `COLLECTOR_VERSION`.

## Compared to FingerprintJS

FingerprintJS is the reference implementation in this space. It is older,
broader, and more battle-tested: more signals, native mobile SDKs, and years of
accuracy work behind its hosted tier. If you want the safest option, use it.

Licensing is not a reason to choose between them. Both are MIT. FingerprintJS
spent v4 under BUSL-1.1 and moved back to MIT in v5, so any comparison you read
claiming otherwise is out of date, including an earlier version of this one.

Honest reasons to use this library instead:

- It is small enough to read in one sitting. Every probe is in a single file
  and there is no build-time magic, so you can audit exactly what it takes from
  a visitor before you ship it.
- It reports what it excludes and why. `HASHED_SIGNALS` is exported, so the
  boundary between "identifies the device" and "merely observed" is inspectable
  rather than implied.
- The hosted tier, if you ever want one, is EU-operated, scopes identifiers per
  project so the same device gets unrelated ids across customers, and publishes
  its retention windows.

And a reason not to: this library is new, its signal set is narrower, and
nobody has yet run it at the scale FingerprintJS has.

## Development

```bash
pnpm install
pnpm build         # bundles + type declarations
pnpm test          # unit tests, happy-dom
pnpm test:e2e      # Playwright, real Chromium: canvas, WebGL, WebAudio
pnpm demo:build    # static demo into demo/dist
```

The hash is checked against an independent BigInt implementation of
MurmurHash3 rather than a hardcoded digest, so a regression in the optimised
32-bit version cannot pass quietly.

If you change what the probes measure, read [SYNC.md](SYNC.md) first. The probe
bodies are parity-locked against the hosted API, and editing them changes every
signal value for devices already recorded there.

## Licence

MIT. See [LICENSE](LICENSE).
