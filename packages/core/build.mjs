// Builds four artifacts:
//   dist/index.mjs      - ESM for npm consumers and bundlers
//   dist/index.cjs      - CJS for older toolchains
//   dist/whorl.v1.js    - IIFE for a <script> tag, exposes window.whorlid
//   dist/whorl.v1.esm.js - ESM for <script type="module"> and CDNs
// Type declarations come from tsc (see the build script in package.json).
import { build } from 'esbuild';

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  target: ['es2018'],
  legalComments: 'none',
};

// npm builds stay readable: a bundler will minify them in the consuming app.
await build({ ...shared, format: 'esm', outfile: 'dist/index.mjs' });
await build({ ...shared, format: 'cjs', outfile: 'dist/index.cjs' });

// CDN builds are minified and self-contained.
await build({
  ...shared,
  entryPoints: ['src/global.ts'],
  minify: true,
  format: 'iife',
  globalName: 'whorlid',
  // Keeps the older WhorlID snippet working, which documented window.fpjs.
  footer: {
    js: 'typeof window!=="undefined"&&(window.fpjs=window.fpjs||window.whorlid);',
  },
  outfile: 'dist/whorl.v1.js',
});

await build({
  ...shared,
  minify: true,
  format: 'esm',
  outfile: 'dist/whorl.v1.esm.js',
});

console.log('whorlid bundles written to dist/');
