// Library-only size guard: measures the bundled library with Svelte and the
// optional xlsx peer externalized — i.e. what a consumer pays on top of Svelte.
// This is the number the "tiny" claim rests on; keep it honest.
//
// Heavy optional UI (the filter menu, etc.) is dynamic-imported by Grid, so it
// code-splits into its own chunk and a consumer only downloads it on use. To
// reflect that, the budget counts the EAGER core only — the entry plus the
// chunks it statically imports — and reports lazy chunks separately.
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { gzipSync } from 'node:zlib';

const DIR = 'lib-dist';
// Sizes are REPORTED on every run so optimization work has a number to move;
// growth from new features is expected and is not a failure. The ceilings only
// catch accidents — a dependency or an optional peer (xlsx is ~140 KB) bundled
// into an entry by mistake — so they sit far above the current sizes.
// `realtime`, `trading` and `ladder` are separate entries: a consumer pays for
// them only when importing them, and they never add to the core number. The
// ladder builds on the grid: it counts only the code it adds.
// realtime went from 6 to 8 KB with the order book, alerts and the worker
// feed (2.7.0 onward); its modules tree-shake, so an app pays for what it
// imports.
const CEILING_KB = { js: 80, css: 12, realtime: 8, trading: 6, ladder: 8 }; // gzipped, Svelte excluded

const gzipKb = (path) => gzipSync(readFileSync(path)).length / 1024;
const jsFiles = readdirSync(DIR).filter((f) => f.endsWith('.js'));

// Static imports only: `import ... from './x'` / `export ... from './x'` and the
// bare `import './x'`. A dynamic `import('./x')` has a `(` after `import`, so it
// is deliberately NOT matched — that's how we separate lazy chunks from the core.
function staticDeps(code) {
  const deps = new Set();
  for (const m of code.matchAll(/from\s*["']\.\/([^"']+)["']/g)) deps.add(m[1]);
  for (const m of code.matchAll(/import\s*["']\.\/([^"']+)["']/g)) deps.add(m[1]);
  return [...deps];
}

// Eager closure: BFS from an entry, following static imports only.
function eagerClosure(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f) || !jsFiles.includes(f)) continue;
    seen.add(f);
    for (const d of staticDeps(readFileSync(`${DIR}/${f}`, 'utf8'))) {
      if (jsFiles.includes(d)) queue.push(d);
    }
  }
  return seen;
}

const core = eagerClosure('bo-grid.js');
const realtimeSet = jsFiles.includes('realtime.js') ? eagerClosure('realtime.js') : new Set();
const tradingSet = jsFiles.includes('trading.js') ? eagerClosure('trading.js') : new Set();
const ladderSet = jsFiles.includes('ladder.js') ? eagerClosure('ladder.js') : new Set();

let coreJs = 0;
let realtimeJs = 0;
let tradingJs = 0;
let ladderJs = 0;
let lazyJs = 0;
const lazy = [];
for (const f of jsFiles) {
  const kb = gzipKb(`${DIR}/${f}`);
  if (core.has(f)) coreJs += kb;
  else if (realtimeSet.has(f)) realtimeJs += kb;
  else if (tradingSet.has(f)) tradingJs += kb;
  else if (ladderSet.has(f)) ladderJs += kb;
  else {
    lazyJs += kb;
    lazy.push([f, kb]);
  }
}
let css = 0;
for (const f of readdirSync(DIR)) if (f.endsWith('.css')) css += gzipKb(`${DIR}/${f}`);

const rows = [
  ['JS   ', coreJs, CEILING_KB.js],
  ['CSS  ', css, CEILING_KB.css],
];
if (realtimeSet.size) rows.push(['realtime', realtimeJs, CEILING_KB.realtime]);
if (tradingSet.size) rows.push(['trading', tradingJs, CEILING_KB.trading]);
if (ladderSet.size) rows.push(['ladder', ladderJs, CEILING_KB.ladder]);

let failed = false;
console.log('library size (gzip, Svelte external — eager core)');
for (const [name, kb, ceiling] of rows) {
  const ok = kb <= ceiling;
  failed ||= !ok;
  console.log(`  ${ok ? '✓' : '✗'} ${name}  ${kb.toFixed(2)} KB  (regression ceiling ${ceiling} KB)`);
}
console.log(`  · Grid only (import { Grid }, the rest tree-shaken): ${(await gridOnlyKb()).toFixed(2)} KB`);
if (lazy.length) {
  console.log(`  · lazy (loaded on use): ${lazyJs.toFixed(2)} KB`);
  for (const [f, kb] of lazy) console.log(`      ${f.replace(/-[^.]+(?=\.js$)/, '')}  ${kb.toFixed(2)} KB`);
}

if (failed) {
  console.error('\n✗ an entry blew past its regression ceiling — something bundled by accident?');
  process.exit(1);
}
console.log('\n✓ no size regression');

/** What an app that imports only the component ships: a separate build, so
    its chunks do not change how the full API above is split. */
async function gridOnlyKb() {
  const out = 'lib-dist-grid';
  await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [svelte()],
    publicDir: false,
    build: {
      outDir: out,
      emptyOutDir: true,
      minify: 'esbuild',
      lib: { entry: { grid: 'scripts/size-entry-grid.ts' }, formats: ['es'] },
      rollupOptions: { external: ['svelte', /^svelte\//, 'xlsx'] },
    },
  });
  const files = readdirSync(out).filter((f) => f.endsWith('.js'));
  const seen = new Set();
  const queue = ['grid.js'];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f) || !files.includes(f)) continue;
    seen.add(f);
    for (const d of staticDeps(readFileSync(`${out}/${f}`, 'utf8'))) queue.push(d);
  }
  let kb = 0;
  for (const f of seen) kb += gzipKb(`${out}/${f}`);
  rmSync(out, { recursive: true, force: true });
  return kb;
}

