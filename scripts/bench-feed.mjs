// Feed ingestion on the main thread vs in a worker, in headless Chrome.
//
// The same feed (1,600 symbols, JSON messages at 10k / 30k / 100k a second)
// reaches the grid's rows two ways, both with bo-grid/realtime as built in
// lib-dist (run `pnpm bench:feed`, which builds it first):
//   - main: a worker stands in for the socket and posts every message to the
//     page, one task each as a WebSocket's messages are; the page parses each
//     and pushes it into createTickStream, which applies a batch a frame.
//   - worker: the socket stand-in posts every message to a second worker
//     (one task each there), which parses it and pushes it into serveFeed;
//     the page's connectFeed applies a batch a frame.
// Reported per mode: the renderer main thread's busy time (CDP TaskDuration,
// as the perf gate records it); for the main mode, how much of that the
// parse and merge took (the rest is the per-message dispatch); the frame time
// as the gate's live workloads measure it (frame start to a task after the
// frame); the latency from a message's time stamp to its patch applied; and
// the patches applied (at most 400 a frame).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const SECONDS = Number(process.env.SECONDS ?? 5);
const RATES = (process.env.RATES ?? '10000,30000,100000').split(',').map(Number);
const lib = path.resolve('lib-dist/realtime.js');
if (!fs.existsSync(lib)) {
  console.error('✗ lib-dist/realtime.js missing: run `pnpm bench:feed` (it builds the library first)');
  process.exit(2);
}

const page = `<!doctype html><meta charset="utf-8"><script type="module">
import { createTickStream, connectFeed } from '/realtime.js';
const SYMS = 1600;
// A stand-in socket: messages at \`rate\` a second, as JSON strings.
const socket = \`
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const message = () => JSON.stringify({ s: 'S' + Math.floor(rand() * \${SYMS}), p: 50 + rand() * 50, v: Math.floor(rand() * 1e4), b: 49 + rand() * 50, a: 51 + rand() * 50, t: Date.now() });
  function run(rate, seconds, each) {
    const t0 = performance.now();
    let last = t0, carry = 0;
    const h = setInterval(() => {
      const now = performance.now();
      carry += ((now - last) / 1000) * rate;
      last = now;
      for (; carry >= 1; carry--) each(message());
      if (now - t0 > seconds * 1000) clearInterval(h);
    }, 4);
  }\`;
const workerOf = (src, type) => new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), { type });
const rows = new Map();
for (let i = 0; i < SYMS; i++) rows.set('S' + i, { s: 'S' + i, p: 0, v: 0, b: 0, a: 0, t: 0 });
let lat = [];
const apply = (batch) => {
  const now = Date.now();
  for (const [k, patch] of batch) { Object.assign(rows.get(k), patch); lat.push(now - patch.t); }
};
function frames(seconds) {
  return new Promise((resolve) => {
    const work = [];
    const probe = new MessageChannel();
    probe.port1.onmessage = (e) => work.push(performance.now() - e.data);
    const t0 = performance.now();
    const frame = (ts) => {
      probe.port2.postMessage(ts);
      if (performance.now() - t0 < seconds * 1000) requestAnimationFrame(frame);
      else resolve(work.slice(30));
    };
    requestAnimationFrame(frame);
  });
}
globalThis.runMain = async (rate, seconds) => {
  lat = [];
  const w = workerOf(socket + 'onmessage = (e) => run(e.data.rate, e.data.seconds, (m) => postMessage(m));', 'classic');
  const stream = createTickStream({ apply });
  let parse = 0;
  w.onmessage = (e) => { const t = performance.now(); const o = JSON.parse(e.data); stream.push(o.s, o); parse += performance.now() - t; };
  stream.start();
  w.postMessage({ rate, seconds: seconds + 0.5 });
  const work = await frames(seconds);
  stream.stop({ discard: true });
  w.terminate();
  return { applied: stream.applied, work, lat, parseMs: parse };
};
globalThis.runWorker = async (rate, seconds) => {
  lat = [];
  // The socket stand-in posts each message to the feed worker, one task each
  // there, as a WebSocket in that worker would deliver them.
  const sock = workerOf(socket + 'onmessage = (e) => { const port = e.ports[0]; run(e.data.rate, e.data.seconds, (m) => port.postMessage(m)); };', 'classic');
  const src = "import { serveFeed } from '" + location.origin + "/realtime.js';" +
    'const feed = serveFeed(); addEventListener("message", (e) => { if (e.data && e.data.socket) e.ports[0].onmessage = (m) => { const o = JSON.parse(m.data); feed.push(o.s, o); }; });';
  const w = workerOf(src, 'module');
  const feed = connectFeed(w, { apply });
  const line = new MessageChannel();
  w.postMessage({ socket: true }, [line.port2]);
  feed.start();
  sock.postMessage({ rate, seconds: seconds + 0.5 }, [line.port1]);
  const work = await frames(seconds);
  feed.close();
  sock.terminate();
  w.terminate();
  return { applied: feed.applied, work, lat };
};
globalThis.ready = true;
</script>`;

const server = http.createServer((req, res) => {
  const headers = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
  if (req.url === '/realtime.js') {
    res.writeHead(200, { ...headers, 'Content-Type': 'text/javascript' });
    res.end(fs.readFileSync(lib));
  } else {
    res.writeHead(200, { ...headers, 'Content-Type': 'text/html' });
    res.end(page);
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((p) => p && fs.existsSync(p));
if (!chrome) {
  console.error('✗ Chrome not found. Set CHROME_PATH to a Chrome or Chromium executable.');
  process.exit(2);
}
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const tab = await browser.newPage();
  tab.on('pageerror', (e) => console.error(`page error: ${e.message}`));
  const cdp = await tab.createCDPSession();
  await cdp.send('Performance.enable');
  const busy = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration').value;
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForFunction(() => globalThis.ready === true);
  if (!(await tab.evaluate(() => crossOriginIsolated))) throw new Error('the page is not cross-origin isolated; timings would be coarse');
  const q = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? 0;
  const lines = [
    '| Feed | Reading it on | Main thread busy | of it, parse + merge | Frame p50 | Frame p95 | Latency p50 | Patches applied |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const rate of RATES) {
    for (const [mode, label] of [['runMain', 'the main thread'], ['runWorker', 'a worker (serveFeed)']]) {
      const before = await busy();
      const r = await tab.evaluate((m, rate, s) => globalThis[m](rate, s), mode, rate, SECONDS);
      const pct = (((await busy()) - before) / SECONDS) * 100;
      if (r.applied === 0) throw new Error(`${label} at ${rate}/s applied no patches`);
      const parse = r.parseMs === undefined ? '–' : `${((r.parseMs / SECONDS) / 10).toFixed(1)}%`;
      const row = `| ${rate.toLocaleString('en-US')}/s | ${label} | ${pct.toFixed(1)}% | ${parse} | ${q(r.work, 0.5).toFixed(2)} ms | ${q(r.work, 0.95).toFixed(2)} ms | ${q(r.lat, 0.5).toFixed(0)} ms | ${r.applied.toLocaleString('en-US')} |`;
      lines.push(row);
      process.stderr.write(row + '\n');
    }
  }
  console.log(`\n### Feed ingestion: main thread vs worker (${SECONDS} s a run, headless Chrome)\n\n${lines.join('\n')}`);
} finally {
  await browser.close();
  server.close();
}
