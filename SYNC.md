# Sync obligations

This repo is public. The WhorlID API it optionally talks to is not. Three
things have to stay in lockstep, and nothing enforces two of them automatically.

## 1. Parity-locked probes (hard constraint)

`packages/core/src/collector.ts` collects the signals the WhorlID API scores.
The probe bodies are byte-identical to the private collector on purpose. In
connected mode the server compares a returning device against signals recorded
by earlier collector builds, and canvas is the highest-weighted signal it has.

Changing any of the following silently breaks matching for every existing
device on the paid service:

- the canvas draw calls, including the literal `whorlid \u{1F510} 9.87`
- the WebGL parameter list (names **and** order) and the extension sort
- the audio graph (10 kHz triangle, compressor settings, sum over samples
  4500-4999)
- the font list and the width/height detection method

These blocks are marked `DO NOT EDIT - parity-locked` in the source. Adding a
*new* signal is fine, as long as it goes in `signals-extra.ts` and stays out of
the connected payload (see below).

The canvas text is never displayed. It is drawn to an offscreen canvas and the
resulting pixels are the signal, so editing the words changes the fingerprint
of every device in the world. That is what happened between collector versions
1 and 2, and it cost every already-recorded device one new id.

## 2. The identify schema (mirrored by hand)

`packages/core/src/identify-schema.ts` vendors the key list from the private
`apps/api/src/identifySchema.ts`. That API validates with
`additionalProperties: false` and does **not** strip unknown fields, so one
extra key means a 400 for every connected user, not a warning.

`test/schema-compat.test.ts` asserts the connected payload only ever contains
vendored keys. That test protects against this repo drifting. It cannot see the
private repo, so when the API schema changes, the vendored copy has to be
updated here by hand.

Also: never emit `serverUserAgent`. The API rejects a client-supplied value on
purpose and derives it from the request header after validation.

## 3. Extended signals stay local

Everything in `signals-extra.ts` lands under `extended` in the components map
and is stripped before anything is sent to the API. It feeds the local
`visitorId` only.

## Future

Once this package is stable, the private collector can be replaced by a
dependency on the published `whorlid` package, which removes items 1 and 2 from
this list entirely. Until then, changes to shared probe code are a two-repo
edit.
