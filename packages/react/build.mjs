import { build } from 'esbuild';

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  target: ['es2018'],
  legalComments: 'none',
  // Both are the consuming app's copies, never bundled in.
  external: ['react', 'whorlid'],
};

await build({ ...shared, format: 'esm', outfile: 'dist/index.mjs' });
await build({ ...shared, format: 'cjs', outfile: 'dist/index.cjs' });

console.log('@whorlid/react bundles written to dist/');
