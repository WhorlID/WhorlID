// Assembles the static demo into demo/dist: the page plus the built ESM
// bundle, nothing else. No backend, no build tooling for consumers to install.
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'demo', 'dist');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await cp(join(root, 'demo', 'index.html'), join(out, 'index.html'));
await cp(join(root, 'demo', 'demo.css'), join(out, 'demo.css'));
await cp(join(root, 'demo', 'demo.js'), join(out, 'demo.js'));
await cp(
  join(root, 'packages', 'core', 'dist', 'whorl.v1.esm.js'),
  join(out, 'whorl.v1.esm.js')
);

console.log(`demo written to ${out}`);
