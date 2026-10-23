<script lang="ts">
  import { flushSync } from 'svelte';
  import { Grid, type ColumnDef, type GridApi, type GridRow, type SortState } from '../../lib';
  import { ui } from '../theme.svelte';

  // A live order blotter at desk scale: up to 100,000 orders in memory, newest
  // first, fills streaming in, new orders arriving and filled ones leaving,
  // with a live totals row. Orders arrive and leave the Svelte way (a new
  // `rows` array); fills go through api.patchRows.
  // `window.__liveBlotter.bench()` times frames of that load, rendered
  // synchronously, split into applying the data, the grid's work and layout.
  interface Order extends GridRow {
    sym: string;
    side: 'Buy' | 'Sell';
    px: number;
    qty: number;
    filled: number;
    status: 'Working' | 'Partial' | 'Filled';
    time: number;
  }

  function prng(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rand = prng(5);
  const SYMS = ['VCB', 'FPT', 'HPG', 'VNM', 'MWG', 'TCB', 'SSI', 'VIC', 'GAS', 'MSN'];
  const T0 = Date.UTC(2026, 9, 23, 2, 0, 0);
  let nextId = 0;
  function order(): Order {
    const id = nextId++;
    const qty = (1 + Math.floor(rand() * 50)) * 100;
    return {
      id,
      sym: SYMS[Math.floor(rand() * SYMS.length)],
      side: rand() < 0.5 ? 'Buy' : 'Sell',
      px: Math.round((10 + rand() * 140) * 10) * 100,
      qty,
      filled: 0,
      status: 'Working',
      time: T0 + id * 250,
    };
  }
  function build(n: number): Order[] {
    rand = prng(5);
    nextId = 0;
    return Array.from({ length: n }, order);
  }

  let size = $state(100_000);
  let rows = $state.raw<Order[]>(build(100_000));
  let api: GridApi | null = null;
  const sort: SortState[] = [{ key: 'time', dir: 'desc' }];

  const columns: ColumnDef[] = [
    { type: 'date', key: 'time', header: 'Time', width: 92 },
    { type: 'text', key: 'sym', header: 'Symbol', width: 72 },
    { type: 'text', key: 'side', header: 'Side', width: 60, cellClass: (v) => (v === 'Buy' ? 'lb-buy' : 'lb-sell') },
    { type: 'price', key: 'px', header: 'Price', width: 84 },
    { type: 'number', key: 'qty', header: 'Qty', width: 80, groupAgg: 'sum' },
    { type: 'number', key: 'filled', header: 'Filled', width: 120, flash: 'auto', dataBar: {}, groupAgg: 'sum' },
    { type: 'text', key: 'status', header: 'Status', width: 84 },
    {
      type: 'number',
      key: 'notional',
      header: 'Notional',
      flex: 1,
      value: (r) => (r as Order).px * (r as Order).filled,
      groupAgg: 'sum',
    },
  ];

  /** One frame of desk traffic: `fills` orders fill a little, `adds` new
      orders arrive and `removes` filled or old orders leave. */
  function step(fills: number, adds: number, removes: number) {
    const patches: Array<[number, Partial<Order>]> = [];
    for (let i = 0; i < fills; i++) {
      const o = rows[Math.floor(rand() * rows.length)];
      if (!o || o.filled >= o.qty) continue;
      const filled = Math.min(o.qty, o.filled + 100 * (1 + Math.floor(rand() * 5)));
      patches.push([o.id, { filled, status: filled >= o.qty ? 'Filled' : 'Partial' }]);
    }
    if (patches.length) api?.patchRows(patches);
    if (adds || removes) {
      const gone = new Set<Order>();
      for (let i = 0; i < removes; i++) gone.add(rows[Math.floor(rand() * rows.length)]);
      const added = Array.from({ length: adds }, order);
      rows = [...(gone.size ? rows.filter((r) => !gone.has(r)) : rows), ...added];
    }
  }

  function load(n: number) {
    size = n;
    rows = build(n);
  }

  let host: HTMLDivElement;
  let result = $state('');
  const pct = (xs: number[], p: number) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  };
  async function bench(opts: { frames?: number; fills?: number; adds?: number; removes?: number } = {}) {
    const frames = opts.frames ?? 120;
    const fills = opts.fills ?? 200;
    const adds = opts.adds ?? 5;
    const removes = opts.removes ?? 5;
    rand = prng(9);
    const apply: number[] = [], render: number[] = [], layout: number[] = [], total: number[] = [];
    for (let f = 0; f < frames; f++) {
      const t0 = performance.now();
      step(fills, adds, removes);
      const t1 = performance.now();
      flushSync();
      const t2 = performance.now();
      void host.offsetHeight;
      const t3 = performance.now();
      apply.push(t1 - t0); render.push(t2 - t1); layout.push(t3 - t2); total.push(t3 - t0);
      if (f % 20 === 19) await Promise.resolve();
    }
    const stat = (xs: number[]) => ({ p50: +pct(xs, 50).toFixed(2), p95: +pct(xs, 95).toFixed(2) });
    const out = { rows: rows.length, fills, adds, removes, frames, apply: stat(apply), render: stat(render), layout: stat(layout), total: stat(total) };
    result = `${out.rows.toLocaleString('en-US')} orders · ${fills} fills + ${adds} new + ${removes} gone per frame · frame p50 ${out.total.p50} ms / p95 ${out.total.p95} ms (apply ${out.apply.p50} · grid ${out.render.p50} · layout ${out.layout.p50})`;
    return out;
  }

  $effect(() => {
    (window as unknown as Record<string, unknown>).__liveBlotter = { bench, load, step, api: () => api, rows: () => rows };
  });
</script>

<div class="lb-controls">
  <label>Orders
    <select value={size} onchange={(e) => load(Number(e.currentTarget.value))}>
      {#each [10_000, 50_000, 100_000] as v (v)}<option value={v}>{v.toLocaleString('en-US')}</option>{/each}
    </select>
  </label>
  <button class="lb-btn" onclick={() => bench()}>Benchmark</button>
  {#if result}<span class="lb-result">{result}</span>{/if}
</div>
<div bind:this={host}>
  <Grid rows={rows as unknown as GridRow[]} {columns} {sort} liveSort flashNewRows flashMotion="auto" footer height={480} theme={ui.grid} ariaLabel="Order blotter" onReady={(a) => (api = a)} />
</div>

<style>
  .lb-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    font-size: 12px;
    color: var(--text-dim, #8a8a8a);
  }
  .lb-controls select {
    margin-left: 4px;
    font: inherit;
  }
  .lb-btn {
    font: inherit;
    padding: 3px 10px;
    cursor: pointer;
  }
  .lb-result {
    font-variant-numeric: tabular-nums;
  }
  :global(.lb-buy) {
    color: var(--bo-up, #34d399);
  }
  :global(.lb-sell) {
    color: var(--bo-down, #f87171);
  }
</style>
