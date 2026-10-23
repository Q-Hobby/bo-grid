// Browser frame-cost benchmark: the price-board demo in headless Chrome,
// measured as the main-thread work of a frame.
//
//   pnpm bench:browser                       builds demo-dist, measures it
//   node scripts/bench-browser.mjs --dir <build>
//   node scripts/bench-browser.mjs --base <build> --head <build>
//
// Compare mode is the CI gate. Each round runs every workload on both builds
// back to back, in alternating order (ABBA), and the change is the MEDIAN OF
// THE PER-ROUND RATIOS head / base: a slow spell on the machine that spans a
// pair cancels out, where comparing two medians would not. Two kinds of
// workload, because they differ in noise:
//   - sync: deterministic frames rendered synchronously (the same events, the
//     same work every run; no paint, no running animations). These GATE: the
//     run fails when head is slower by more than BOTH --threshold and
//     --min-ms.
//   - live: the real pipeline in real time, flashes and paint included.
//     Noisier, so these only WARN, past --live-threshold.
// On a GitHub runner, identical builds came out within 2% (sync) and 8%
// (live) of each other, with single rounds between 0.88x and 1.16x. A busy
// desktop is far noisier: rounds there have differed by 1.5x.
//
// What is measured is the work per frame, not the frame rate: a frame that
// takes 4 ms and one that takes 14 ms both make 60 fps on a fast machine; only
// the work shows the headroom left. Each run reports its MEDIAN frame, as timed
// by the board's own bench hooks, so a GC pause or an interrupt does not move
// it. Pages are served cross-origin isolated, which takes performance.now()
// from 0.1 ms steps down to a few microseconds (the hooks report 0.01 ms), and
// requests to other hosts (the web fonts) are blocked, so both builds lay out
// with the same fonts. Chrome's
// main-thread task time per frame (Performance.getMetrics) is recorded beside
// it, a mean that does include pauses; `--trace` cross-checks it against a
// trace.
//
// Options: --rounds N sync rounds (default 10), --live-rounds N (default 4),
// --seconds S per live run (default 3), --only <substring,...>,
// --threshold 0.10, --min-ms 0.2, --live-threshold 0.25, --json <file>,
// --trace, --no-gate (report without failing: for a change to the bench hooks
// themselves, where base and head would run different workloads). Chrome comes
// from CHROME_PATH or the usual install locations.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const args = parseArgs(process.argv.slice(2));
const ROUNDS = Number(args.rounds ?? 10);
const LIVE_ROUNDS = Number(args['live-rounds'] ?? 4);
const SECONDS = Number(args.seconds ?? 3);
const THRESHOLD = Number(args.threshold ?? 0.1);
const MIN_MS = Number(args['min-ms'] ?? 0.2);
const LIVE_THRESHOLD = Number(args['live-threshold'] ?? 0.25);
const GATE = !args['no-gate'];
const builds = args.base || args.head ? { base: args.base, head: args.head } : { current: args.dir ?? 'demo-dist' };
for (const [name, dir] of Object.entries(builds)) {
  if (!dir || !fs.existsSync(path.join(dir, 'index.html'))) {
    console.error(`✗ ${name}: no index.html in "${dir}". Build the demo first (vite build --base=./ --outDir <dir>).`);
    process.exit(2);
  }
}
const compare = 'base' in builds;

// Each workload opens a fresh page, so one run's flashes and caches never leak
// into the next. `motion` is the board's flashMotion for the run; every `run`
// resolves to the frames it rendered and the median frame's work in ms.
const WORKLOADS = [
  { name: 'sync: board 10k ev/s', gate: true, motion: 'hold', run: (page) => syncBoard(page, 10_000) },
  { name: 'sync: board 30k ev/s', gate: true, motion: 'hold', run: (page) => syncBoard(page, 30_000) },
  { name: 'sync: scroll 3 rows/frame', gate: true, motion: 'hold', run: (page) => syncScroll(page, 3) },
  { name: 'live: board 10k ev/s (hold)', motion: 'hold', run: (page) => live(page, 10_000) },
  { name: 'live: board 30k ev/s (auto)', motion: 'auto', run: (page) => live(page, 30_000) },
  { name: 'live: board 10k ev/s (fade)', motion: 'fade', run: (page) => live(page, 10_000) },
]
  .filter((w) => !args.only || String(args.only).split(',').some((s) => w.name.includes(s)))
  .map((w) => ({ ...w, rounds: w.gate ? ROUNDS : LIVE_ROUNDS }))
  .filter((w) => w.rounds > 0);

const results = {}; // workload -> build -> [sample per round]
let failed = false;
let server;
let browser;
try {
  server = await serve(builds);
  browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    // GitHub's Ubuntu runners block Chrome's sandbox; the page is our own build.
    args: ['--window-size=1400,1000', ...(process.env.CI ? ['--no-sandbox'] : [])],
  });
  const maxRounds = Math.max(...WORKLOADS.map((w) => w.rounds));
  for (let r = 0; r < maxRounds; r++) {
    const order = Object.keys(builds);
    if (r % 2) order.reverse();
    for (const w of WORKLOADS) {
      if (r >= w.rounds) continue;
      for (const name of order) {
        const sample = await measure(name, w);
        ((results[w.name] ??= {})[name] ??= [])[r] = sample;
        const extra = `task ${fmt(sample.task)}${sample.traceMs ? `, trace ${fmt(sample.traceMs)}` : ''}`;
        process.stderr.write(`round ${r + 1}/${w.rounds} · ${w.name} · ${name}: ${fmt(sample.ms)} ms/frame (${extra})\n`);
      }
    }
  }
} finally {
  await browser?.close().catch(() => {});
  server?.close();
}

const report = compare ? compareReport() : singleReport();
console.log(`\n${report}`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
if (args.json) fs.writeFileSync(args.json, JSON.stringify({ seconds: SECONDS, results }, null, 2));
process.exit(failed ? 1 : 0);

// ---- Workloads -------------------------------------------------------------

/** The real feed path in real time: events pushed every frame, drained once
    per frame by the tick stream, flashes running. A frame's work runs from
    its start until a task posted from it, after style, layout and paint. */
async function live(page, eventsPerSec) {
  const res = await page.evaluate(
    (eps, s) => window.__priceBoard.benchLive({ seconds: s, eventsPerSec: eps }),
    eventsPerSec,
    SECONDS,
  );
  return { frames: res.framesTotal, ms: res.work.p50 };
}

/** Deterministic frames: apply a frame's ticks, render synchronously, force
    style and layout. Seeded, so both builds see the same events. */
async function syncBoard(page, eventsPerSec) {
  const res = await page.evaluate((eps) => window.__priceBoard.bench({ frames: 240, eventsPerSec: eps }), eventsPerSec);
  return { frames: res.frames, ms: res.total.p50 };
}

/** A fast wheel through the board, each step rendered synchronously. */
async function syncScroll(page, rows) {
  const res = await page.evaluate((n) => window.__priceBoard.benchScroll({ frames: 120, rowsPerFrame: n }), rows);
  return { frames: res.frames, ms: res.total.p50 };
}

// ---- Measuring -------------------------------------------------------------

async function measure(build, workload) {
  const page = await openBoard(build, workload.motion);
  try {
    const cdp = await page.createCDPSession();
    await cdp.send('Performance.enable');
    if (args.trace) await page.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
    const before = await metrics(cdp);
    const { frames, ms } = await workload.run(page);
    const after = await metrics(cdp);
    const traceMs = args.trace ? traceTaskMs(Buffer.from(await page.tracing.stop()).toString()) / frames : undefined;
    const per = (k) => ((after[k] - before[k]) * 1000) / frames;
    return {
      ms,
      task: per('TaskDuration'),
      frames,
      ...(traceMs !== undefined ? { traceMs } : {}),
    };
  } finally {
    await page.close();
  }
}

/** Opens the demo with only the price board on the page, motion allowed. */
async function openBoard(build, motion) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  await page.setRequestInterception(true);
  page.on('request', (req) => (req.url().startsWith(server.url) ? req.continue() : req.abort()));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // Flash animations are skipped under reduced motion, and some machines
  // report it: the board would measure a lighter workload than users see.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(`${server.url}/${build}/index.html#ex-priceboard`, { waitUntil: 'load' });
  try {
    // The demo mounts each example when it scrolls near the viewport, and on a
    // slow machine the section may not exist yet at `load`: keep scrolling it
    // into view until the board reports its grid handle.
    await page.waitForFunction(
      () => {
        if (window.__priceBoard?.api?.()) return true;
        document.getElementById('ex-priceboard')?.scrollIntoView();
        return false;
      },
      { timeout: 30_000, polling: 250 },
    );
  } catch (e) {
    const state = await page.evaluate(() => {
      const el = document.getElementById('ex-priceboard');
      if (!el) return 'no #ex-priceboard element';
      const hooks = window.__priceBoard;
      const missing = ['api', 'bench', 'benchScroll', 'benchLive', 'setFlashMotion'].filter((k) => typeof hooks?.[k] !== 'function');
      return `${el.querySelectorAll('.row').length} rows rendered; ${hooks ? `hooks missing: ${missing.join(', ') || 'none'}` : 'no window.__priceBoard'}`;
    });
    throw new Error(`the price board did not mount (${state}). Page errors: ${errors.join(' | ') || 'none'}`, { cause: e });
  }
  await page.evaluate(() => {
    // Hide every sibling along the board's ancestor chain.
    let el = document.getElementById('ex-priceboard');
    while (el && el !== document.body) {
      for (const s of el.parentElement.children) if (s !== el && s.tagName !== 'SCRIPT') s.style.display = 'none';
      el = el.parentElement;
    }
    window.scrollTo(0, 0);
  });
  await page.evaluate((m) => window.__priceBoard.setFlashMotion(m), motion);
  await new Promise((r) => setTimeout(r, 400));
  if (!(await page.evaluate(() => globalThis.crossOriginIsolated))) {
    throw new Error('the page is not cross-origin isolated; frame timings would be rounded to 0.1 ms');
  }
  if (await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    throw new Error('reduced motion is still active; flash animations would not run');
  }
  return page;
}

async function metrics(cdp) {
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(list.map((m) => [m.name, m.value]));
}

/** Total RunTask time (ms) on the busiest renderer main thread: the page's
    (the trace also holds other renderers, idle ones included). */
function traceTaskMs(trace) {
  const events = JSON.parse(trace).traceEvents;
  const mains = new Set(events.filter((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map((e) => `${e.pid}:${e.tid}`));
  const busy = new Map();
  for (const e of events) {
    const key = `${e.pid}:${e.tid}`;
    if (e.ph === 'X' && e.name === 'RunTask' && mains.has(key)) busy.set(key, (busy.get(key) ?? 0) + e.dur);
  }
  return Math.max(0, ...busy.values()) / 1000;
}

// ---- Reports ---------------------------------------------------------------

function singleReport() {
  const lines = [
    `### Browser frame cost (median frame; median of ${ROUNDS} sync and ${LIVE_ROUNDS} live runs)`,
    '',
    '| Workload | median frame, ms | range | task ms / frame |',
    '| --- | ---: | --- | ---: |',
  ];
  for (const [workload, byBuild] of Object.entries(results)) {
    const s = byBuild.current;
    const ms = s.map((x) => x.ms);
    lines.push(`| ${workload} | ${fmt(median(ms))} | ${fmt(Math.min(...ms))}–${fmt(Math.max(...ms))} | ${fmt(median(s.map((x) => x.task)))} |`);
  }
  return lines.join('\n');
}

function compareReport() {
  const lines = [
    `### Browser frame cost: head vs base`,
    '',
    `Median frame per run. The change is the median of the per-round ratios head / base (${ROUNDS} sync rounds, ${LIVE_ROUNDS} live).`,
    '',
    '| Workload | base ms | head ms | change | |',
    '| --- | ---: | ---: | ---: | --- |',
  ];
  const warnings = [];
  for (const w of WORKLOADS) {
    const { base, head } = results[w.name];
    const b = median(base.map((x) => x.ms));
    const h = median(head.map((x) => x.ms));
    const ratios = base.flatMap((x, i) => (x.ms > 0 ? [head[i].ms / x.ms] : []));
    const change = median(ratios) - 1;
    let verdict = 'ok';
    if (w.gate && change > THRESHOLD && change * b > MIN_MS) {
      failed = GATE;
      verdict = GATE ? '**slower**' : 'slower (not gated)';
    } else if (!w.gate && change > LIVE_THRESHOLD) {
      warnings.push(w.name);
      verdict = 'check';
    }
    lines.push(`| ${w.name} | ${fmt(b)} | ${fmt(h)} | ${change >= 0 ? '+' : ''}${(change * 100).toFixed(1)}% | ${verdict} |`);
  }
  if (!GATE) lines.push('', 'Not gated: this change edits the bench hooks, so base and head ran different workloads. Compare by hand.');
  lines.push(
    '',
    failed
      ? `A sync workload is more than ${THRESHOLD * 100}% and ${MIN_MS} ms per frame slower: a regression in script, style or layout work. Re-run once to rule out a noisy runner.`
      : `No sync workload fails the gate (more than ${THRESHOLD * 100}% and ${MIN_MS} ms per frame slower).`,
  );
  if (warnings.length > 0) {
    lines.push(`Live runs more than ${LIVE_THRESHOLD * 100}% slower: ${warnings.join(', ')}. Live runs are noisy; measure locally before trusting this.`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning::Live frame cost more than ${LIVE_THRESHOLD * 100}% higher: ${warnings.join(', ')}`);
  }
  return lines.join('\n');
}

// ---- Plumbing --------------------------------------------------------------

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function fmt(n) {
  return n.toFixed(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    out[a.slice(2)] = next === undefined || next.startsWith('--') ? true : (i++, next);
  }
  return out;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((p) => p && fs.existsSync(p));
  if (!found) {
    console.error('✗ Chrome not found. Set CHROME_PATH to a Chrome or Chromium executable.');
    process.exit(2);
  }
  return found;
}

/** Serves each build under /<name>/ on a free local port. */
function serve(dirs) {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.txt': 'text/plain', '.woff2': 'font/woff2' };
  const roots = Object.fromEntries(Object.entries(dirs).map(([k, d]) => [k, path.resolve(d)]));
  const srv = http.createServer((req, res) => {
    let file;
    try {
      const [, name, ...rest] = decodeURIComponent(new URL(req.url, 'http://x').pathname).split('/');
      const root = roots[name];
      file = root && path.join(root, ...rest);
      if (!file || !file.startsWith(root + path.sep) || file.includes('\0')) return res.writeHead(404).end();
    } catch {
      return res.writeHead(400).end();
    }
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res
        .writeHead(200, {
          'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
          // Cross-origin isolation: microsecond performance.now() in the page.
          'cross-origin-opener-policy': 'same-origin',
          'cross-origin-embedder-policy': 'require-corp',
        })
        .end(data);
    });
  });
  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => {
      srv.url = `http://127.0.0.1:${srv.address().port}`;
      resolve(srv);
    });
  });
}
