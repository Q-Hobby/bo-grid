// Copies the static API page (api.html, built by the demo's Vite config) and
// the assets it references from demo-dist into the docs site's build, so
// Pages serves both from one folder. Run after `pages:build`'s two builds.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const from = 'demo-dist';
const to = 'site/build';
const html = readFileSync(join(from, 'api.html'), 'utf8');
const assets = [...html.matchAll(/(?:href|src)="\/bo-grid\/(assets\/[^"]+)"/g)].map((m) => m[1]);

for (const file of ['api.html', ...assets]) {
  const src = join(from, file);
  if (!existsSync(src)) throw new Error(`site-assets: ${src} is missing (run the demo build first)`);
  mkdirSync(dirname(join(to, file)), { recursive: true });
  copyFileSync(src, join(to, file));
}
console.log(`site-assets: api.html and ${assets.length} asset(s) → ${to}`);
