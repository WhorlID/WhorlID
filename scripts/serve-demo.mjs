// Minimal static server for demo/dist, used by the Playwright smoke test.
// Deliberately dependency-free: the demo is static files and nothing more.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'demo', 'dist');
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

createServer(async (req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const relative = normalize(path === '/' ? 'index.html' : path.replace(/^\/+/, ''));
  if (relative.startsWith('..')) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(join(root, relative));
    res.writeHead(200, { 'content-type': TYPES[extname(relative)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => {
  console.log(`demo served on http://localhost:${port}`);
});
