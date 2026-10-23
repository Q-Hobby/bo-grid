// Hot-path benchmarks backing the "tiny + fast" claim with real numbers.
//
// The differentiator is virtualization: the grid positions any row and finds the
// first visible row in O(1) (uniform) or O(log n) (variable height) — so scroll
// stays smooth whether the dataset is 1k rows or 1M. These measure that core plus
// the other per-dataset hot paths (aggregate, multi-key sort, tree flatten).
//
// Standalone Vite SSR (like ssr.mjs / smoke.mjs) so it can load the TS modules.
// Deterministic inputs (no Math.random) so runs are comparable. Node, single
// thread. Run: pnpm bench
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const server = await createServer({
  configFile: false,
  plugins: [svelte()],
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  // Load TS via ssrLoadModule only — don't let the dep-scanner crawl built output
  // (demo-dist/dist) and choke on its dynamic imports.
  optimizeDeps: { entries: [], noDiscovery: true },
});

const fmt = (n) => n.toLocaleString('en-US');
const ms = (n) => `${n.toFixed(2)} ms`;
const results = [];
let failed = false;
// `ceiling` (ms) is a deliberately generous regression guard (~15-30× the real
// time) — machine variance won't trip it, but an algorithmic regression (e.g.
// O(log n) → O(n)) blows past it. Catches drift without flaky absolute thresholds.
function time(label, detail, fn, ceiling) {
  const t0 = performance.now();
  const out = fn();
  const t1 = performance.now();
  results.push({ label, detail, t: t1 - t0, ceiling });
  return out;
}

try {
  const { uniformHeights, variableHeights } = await server.ssrLoadModule(
    '/src/lib/grid/rowheight.ts',
  );
  const { aggregate } = await server.ssrLoadModule('/src/lib/grid/aggregate.ts');
  const { compareBySorts, sortRows } = await server.ssrLoadModule('/src/lib/grid/column.ts');
  const { mergeChanged, rowOrder } = await server.ssrLoadModule('/src/lib/grid/livesort.ts');
  const { buildTreeRows } = await server.ssrLoadModule('/src/lib/grid/tree.ts');
  const { TickBuffer, createRowIndex, applyPatches } = await server.ssrLoadModule(
    '/src/lib/realtime/ticks.ts',
  );
  const { FlashTracker } = await server.ssrLoadModule('/src/lib/grid/flash.ts');
  const { TradeTape } = await server.ssrLoadModule('/src/lib/realtime/tape.ts');

  const N = 1_000_000;

  // --- Virtual scroll: variable row heights (prefix sums + binary search) ---
  const heights = new Array(N);
  for (let i = 0; i < N; i++) heights[i] = 28 + (i % 5) * 8;
  let vModel;
  time('build variable-height model', `${fmt(N)} rows → Float64 prefix sums`, () => {
    vModel = variableHeights(heights);
  }, 200);
  const LOOKUPS = 1_000_000;
  time('variable indexAt() lookups', `${fmt(LOOKUPS)} × binary search O(log n)`, () => {
    let acc = 0;
    const total = vModel.total;
    for (let i = 0; i < LOOKUPS; i++) acc += vModel.indexAt((i * 6151) % total);
    if (acc < 0) throw new Error('unreachable');
  }, 1500);

  // --- Virtual scroll: uniform row heights (O(1)) ---
  const uModel = uniformHeights(N, 36);
  time('uniform indexAt() lookups', `${fmt(N)} × O(1)`, () => {
    let acc = 0;
    for (let i = 0; i < N; i++) acc += uModel.indexAt(i * 36);
    if (acc < 0) throw new Error('unreachable');
  }, 200);

  // --- Range aggregation over a full column ---
  const vals = new Array(N);
  for (let i = 0; i < N; i++) vals[i] = ((i * 7) % 1000) / 3;
  time('aggregate()', `sum/avg/count/min/max over ${fmt(N)} numbers`, () => aggregate(vals), 400);

  // --- Multi-key sort ---
  const M = 100_000;
  const rows = new Array(M);
  for (let i = 0; i < M; i++) rows[i] = { id: i, sector: `S${i % 20}`, px: (i * 13) % 1000 };
  const sorts = [
    { key: 'sector', dir: 'asc' },
    { key: 'px', dir: 'desc' },
  ];
  time('multi-key sort', `${fmt(M)} rows by 2 keys (compareBySorts)`, () => {
    rows.sort((a, b) => compareBySorts(a, b, sorts));
  }, 2500);

  // --- Live sort: re-sort a board after a frame's ticks (liveSort) ---
  // A movers board sorted by change: 500 of 100,000 rows changed since the last
  // re-sort. A full re-sort (what api.refresh does) against merging just the
  // changed rows back in (mergeChanged); both give the same order.
  const liveCols = [{ type: 'number', key: 'chg', header: 'Chg' }];
  const liveSorts = [{ key: 'chg', dir: 'desc' }];
  const board = Array.from({ length: M }, (_, i) => ({ id: i, chg: ((i * 7919) % 2001) - 1000 }));
  const boardPos = new Map(board.map((r, i) => [r, i]));
  let boardView = sortRows(board, liveSorts, liveCols);
  const moved = new Set();
  for (let k = 0; k < 500; k++) {
    const row = board[(k * 7877) % M];
    row.chg = ((k * 104729) % 2001) - 1000;
    moved.add(row);
  }
  let full;
  time('live sort: full re-sort', `${fmt(M)} rows, 500 changed (sortRows)`, () => {
    full = sortRows(board, liveSorts, liveCols);
  }, 3000);
  time('live sort: merge changed', `${fmt(M)} rows, 500 changed (mergeChanged)`, () => {
    boardView = mergeChanged(boardView, moved, null, rowOrder(liveSorts, liveCols, (r) => boardPos.get(r)));
  }, 600);
  if (boardView.some((r, i) => r !== full[i])) throw new Error('mergeChanged disagrees with sortRows');

  // --- Tree flatten (pre-order DFS) ---
  const roots = [];
  for (let r = 0; r < 1000; r++) {
    const kids = [];
    for (let c = 0; c < 10; c++) {
      const gk = [];
      for (let g = 0; g < 5; g++) gk.push({ id: `${r}.${c}.${g}` });
      kids.push({ id: `${r}.${c}`, children: gk });
    }
    roots.push({ id: `${r}`, children: kids });
  }
  const NODES = 1000 * (1 + 10 * (1 + 5)); // 61,000
  let flat;
  time('buildTreeRows()', `${fmt(NODES)} nodes, all expanded`, () => {
    flat = buildTreeRows(roots, {
      childrenOf: (row) => row.children,
      hasChildren: (row) => !!row.children?.length,
      isExpanded: () => true,
    });
  }, 300);

  // --- Realtime: tick ingestion (bo-grid/realtime) ---
  // A feed pushes far more messages than the screen can show. These measure the
  // library's own overhead on the path from socket message to reactive write:
  // coalescing many messages per symbol, then applying one frame's worth.
  const SYMBOLS = 5_000;
  const TICKS = 1_000_000;
  const buffer = new TickBuffer();
  time('TickBuffer.push()', `${fmt(TICKS)} ticks coalescing onto ${fmt(SYMBOLS)} symbols`, () => {
    for (let i = 0; i < TICKS; i++) {
      buffer.push(i % SYMBOLS, { last: i * 0.01, volume: i });
    }
  }, 2000);
  const coalesced = buffer.size;

  const feedRows = new Array(SYMBOLS);
  for (let i = 0; i < SYMBOLS; i++) feedRows[i] = { id: i, last: 0, volume: 0 };
  const index = createRowIndex(feedRows, (r) => r.id);
  const frameBatch = buffer.drain(SYMBOLS);
  const FRAMES = 200;
  time('applyPatches()', `${fmt(FRAMES)} frames × ${fmt(SYMBOLS)} keyed row writes`, () => {
    for (let f = 0; f < FRAMES; f++) {
      // Vary the value so the unchanged-field skip doesn't make this a no-op.
      for (const entry of frameBatch) entry[1].last += 0.01;
      applyPatches(index, frameBatch);
    }
  }, 2000);

  // --- Realtime: derived per-cell flash ---
  // Runs once per rendered cell per update, so it has to stay trivial.
  const tracker = new FlashTracker();
  const OBSERVES = 1_000_000;
  time('FlashTracker.observe()', `${fmt(OBSERVES)} cell observations`, () => {
    for (let i = 0; i < OBSERVES; i++) {
      tracker.observe(i % SYMBOLS, 'last', i * 0.01, 'up-down', i);
    }
  }, 2500);

  // --- Realtime: capped trade tape (time & sales) ---
  // push() must stay O(1) regardless of how long a session runs — a ring
  // buffer, not a shift-and-truncate array. toArray() is O(capacity), meant to
  // be called once per render, not per trade.
  const tape = new TradeTape(500);
  const TRADES = 1_000_000;
  time('TradeTape.push()', `${fmt(TRADES)} trades into a 500-cap ring buffer`, () => {
    for (let i = 0; i < TRADES; i++) tape.push({ price: i * 0.01, size: i });
  }, 300);
  const TOARRAY_CALLS = 10_000;
  time('TradeTape.toArray()', `${fmt(TOARRAY_CALLS)} snapshots of a full 500-trade tape`, () => {
    for (let i = 0; i < TOARRAY_CALLS; i++) tape.toArray();
  }, 500);

  // --- Report ---
  const wLabel = Math.max(...results.map((r) => r.label.length));
  console.log('\nbo-grid hot-path benchmarks — Node, single thread, deterministic inputs\n');
  for (const { label, detail, t, ceiling } of results) {
    const over = ceiling != null && t > ceiling;
    failed ||= over;
    const tail = over ? `  ✗ OVER ${ms(ceiling)} ceiling` : '';
    console.log(`  ${ms(t).padStart(10)}   ${label.padEnd(wLabel)}  ${detail}${tail}`);
  }
  const vLookup = results.find((r) => r.label === 'variable indexAt() lookups');
  const perLookupNs = (vLookup.t * 1e6) / LOOKUPS;
  console.log(
    `\n  → ${perLookupNs.toFixed(0)} ns per variable-height row lookup ` +
      `(the per-frame cost of finding the first visible row at any scroll position).`,
  );
  console.log(`  → tree rows flattened: ${fmt(flat.length)}`);
  const push = results.find((r) => r.label === 'TickBuffer.push()');
  console.log(
    `  → ${fmt(Math.round((TICKS / push.t) * 1000))} ticks/sec ingested and coalesced ` +
      `(${fmt(TICKS)} messages collapsed to ${fmt(coalesced)} pending writes — ` +
      `the work a frame is spared).`,
  );
  const apply = results.find((r) => r.label === 'applyPatches()');
  console.log(
    `  → ${(apply.t / FRAMES).toFixed(2)} ms to apply a ${fmt(SYMBOLS)}-row frame ` +
      `(a 16.7 ms frame budget; the default cap is 400 rows/frame).`,
  );
  const tapePush = results.find((r) => r.label === 'TradeTape.push()');
  console.log(`  → ${fmt(Math.round((TRADES / tapePush.t) * 1000))} trades/sec appended to the tape (O(1) per push).`);
  console.log(
    failed
      ? '\n✗ bench: a hot path exceeded its regression ceiling — likely an algorithmic regression.\n'
      : '\n✓ bench: all hot paths within their (generous) regression ceilings.\n',
  );
} finally {
  await server.close();
}
if (failed) process.exit(1);
