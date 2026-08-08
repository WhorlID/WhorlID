// npm renders the README and LICENSE that sit inside each published package,
// so copy the canonical root ones in at publish time. Keeping one source of
// truth in git beats keeping three copies in sync by hand.
import { cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packages = ['core', 'react'];

for (const name of packages) {
  await cp(join(root, 'LICENSE'), join(root, 'packages', name, 'LICENSE'));
}

// The core package is the npm landing page for the project.
await cp(join(root, 'README.md'), join(root, 'packages', 'core', 'README.md'));

console.log('copied LICENSE and README into packages/');
