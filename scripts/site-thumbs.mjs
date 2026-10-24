// Captures a thumbnail of every live example for the docs site's gallery:
// serves site/build under /bo-grid/, opens each /examples/<id>/ in headless
// Chrome, waits for the example to run and saves its frame as WebP in
// public/media/examples/. Run by hand after `pnpm site:build` when an example
// changes its look: `node scripts/site-thumbs.mjs [id ...]`.
import http from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = 'site/build';
const OUT = 'public/media/examples';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && existsSync(p));
if (!CHROME) throw new Error('site-thumbs: no Chrome found (set CHROME_PATH)');

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (!p.startsWith('/bo-grid')) return res.writeHead(404).end();
  let file = join(ROOT, p.slice('/bo-grid'.length) || '/');
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/bo-grid`;

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [...readFileSync('src/demo/examples/catalog.ts', 'utf8').matchAll(/id: '([^']+)'/g)].map((m) => m[1]);
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  for (const id of ids) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1360, height: 1000, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.goto(`${origin}/examples/${id}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.preview .bo-grid, .preview canvas, .preview table', { timeout: 15000 }).catch(() => {});
    // Examples that start paused (a feed, a tape) are started, then left to tick.
    await page.$$eval('.preview button', (buttons) => {
      for (const b of buttons) if (/^\s*(Paused|Start feed)\s*$/.test(b.textContent ?? '')) b.click();
    });
    await new Promise((r) => setTimeout(r, 2600));
    const frame = await page.$('.preview');
    const box = await frame.boundingBox();
    const height = Math.min(box.height, box.width * 0.62);
    await page.screenshot({ path: `${OUT}/${id}.webp`, type: 'webp', quality: 72, clip: { x: box.x, y: box.y, width: box.width, height } });
    await page.close();
    console.log(`site-thumbs: ${id}`);
  }
} finally {
  await browser.close();
  server.close();
}
