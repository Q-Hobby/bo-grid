<script lang="ts">
  import { flushSync } from 'svelte';
  import { Grid, type ColumnDef, type GridApi, type GridRow, type SortState } from '../../lib';
  import { createTickStream, createRowIndex, applyPatches, createViewportSubscriptions } from '../../lib/realtime';
  import { vnBands, vnTickSize } from '../../lib/trading';
  import { ui } from '../theme.svelte';
  import { FpsMeter } from '../perf/fps.svelte';
  import { FrameCostMeter } from '../perf/framecost.svelte';

  // A full VN-style price board (bảng giá) under a busy-market load: hundreds of
  // symbols, three bid/ask levels, match, high/low, foreign flow — every changed
  // cell flashes and prices colour by ceiling/floor/reference. Ticks go through
  // bo-grid/realtime's coalescing stream, the recommended feed path.
  // `window.__priceBoard.bench()` measures the cost of one frame, split into
  // applying the data, Svelte updating the DOM, and style + layout.
  interface Quote extends GridRow {
    symbol: string;
    ref: number;
    ceil: number;
    floor: number;
    bp3: number; bv3: number; bp2: number; bv2: number; bp1: number; bv1: number;
    mp: number; mv: number; chg: number;
    ap1: number; av1: number; ap2: number; av2: number; ap3: number; av3: number;
    hi: number; lo: number; tv: number; fb: number; fs: number;
  }

  // Deterministic PRNG so every benchmark run sees the same ticks.
  function prng(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rand = prng(42);
  const rint = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const code = (i: number) =>
    String.fromCharCode(65 + (Math.floor(i / 676) % 26), 65 + (Math.floor(i / 26) % 26), 65 + (i % 26));

  function build(n: number): Quote[] {
    rand = prng(42);
    return Array.from({ length: n }, (_, id) => {
      const ref = Math.round(rint(10_000, 150_000) / 100) * 100;
      const { ceiling, floor } = vnBands(ref, 'HOSE');
      const t = vnTickSize(ref, 'HOSE');
      return {
        id, symbol: code(id), ref, ceil: ceiling ?? ref, floor: floor ?? ref,
        bp3: ref - 3 * t, bv3: rint(1, 900) * 10, bp2: ref - 2 * t, bv2: rint(1, 900) * 10, bp1: ref - t, bv1: rint(1, 900) * 10,
        mp: ref, mv: 0, chg: 0,
        ap1: ref + t, av1: rint(1, 900) * 10, ap2: ref + 2 * t, av2: rint(1, 900) * 10, ap3: ref + 3 * t, av3: rint(1, 900) * 10,
        hi: ref, lo: ref, tv: 0, fb: 0, fs: 0,
      };
    });
  }

  // One market event for a symbol: a match, the touch moving, sometimes depth.
  function event(q: Quote): Partial<Quote> {
    const t = vnTickSize(q.mp, 'HOSE');
    const mp = Math.min(q.ceil, Math.max(q.floor, q.mp + Math.round((rand() - 0.5) * 4) * t));
    const mv = rint(1, 500) * 10;
    const p: Partial<Quote> = {
      mp, mv, chg: mp - q.ref, tv: q.tv + mv, hi: Math.max(q.hi, mp), lo: Math.min(q.lo, mp),
      bp1: mp - t, bv1: rint(1, 900) * 10, ap1: mp + t, av1: rint(1, 900) * 10,
    };
    if (rand() < 0.5) Object.assign(p, { bp2: mp - 2 * t, bv2: rint(1, 900) * 10, ap2: mp + 2 * t, av2: rint(1, 900) * 10 });
    if (rand() < 0.25) Object.assign(p, { bp3: mp - 3 * t, bv3: rint(1, 900) * 10, ap3: mp + 3 * t, av3: rint(1, 900) * 10 });
    if (rand() < 0.2) Object.assign(p, rand() < 0.5 ? { fb: q.fb + mv } : { fs: q.fs + mv });
    return p;
  }

  // Two ways to feed the grid, for comparison:
  //  - 'patch' (recommended for busy feeds): rows are plain objects and the grid
  //    writes ticks into them through api.patchRows, repainting only rendered rows.
  //  - 'state': rows are deep $state proxies and ticks are written through them.
  let mode = $state<'patch' | 'state'>('patch');
  let n = $state(1000);
  let plainRows = $state.raw<Quote[]>(build(1000));
  let stateRows = $state<Quote[]>([]);
  const rows = $derived(mode === 'patch' ? plainRows : stateRows);
  let index = new Map<number, Quote>();
  let api: GridApi | null = null;
  // Stream only the symbols on screen: the grid reports its viewport and the
  // helper turns it into subscribe / unsubscribe calls. Here the "socket" is
  // a Set; a real board would send sub / unsub messages to its feed.
  const streamed = new Set<string>();
  let watching = $state(0);
  const subs = createViewportSubscriptions<Quote, string>({
    key: (q) => q.symbol,
    subscribe: (syms) => {
      for (const s of syms) streamed.add(s);
      watching = streamed.size;
    },
    unsubscribe: (syms) => {
      for (const s of syms) streamed.delete(s);
      watching = streamed.size;
    },
  });
  $effect(() => () => subs.clear());
  // A block trade (a fill of 4,950+ shares) flashes its symbol: api.flashCells
  // marks an event the values alone don't show.
  const BLOCK = 4950;
  function flagBlocks(b: Array<[number, Partial<Quote>]>) {
    const ids: number[] = [];
    for (const [id, p] of b) if ((p.mv ?? 0) >= BLOCK) ids.push(id);
    if (ids.length > 0) api?.flashCells({ rows: ids, columns: ['symbol'], ms: 1200 });
  }
  const stream = createTickStream<number, Partial<Quote>>({
    cap: 2000,
    apply: (b) => {
      if (mode === 'patch') api?.patchRows(b);
      else applyPatches(index, b);
      flagBlocks(b);
    },
  });
  function load(nextMode: 'patch' | 'state', size: number) {
    stream.stop({ discard: true });
    mode = nextMode;
    n = size;
    if (nextMode === 'patch') {
      plainRows = build(size);
      stateRows = [];
    } else {
      stateRows = build(size);
      plainRows = [];
      index = createRowIndex(stateRows, (r) => r.id);
    }
  }
  const setSize = (size: number) => load(mode, size);

  const k = (v: unknown) => (Number(v) ? (Number(v) / 1000).toFixed(2) : '');
  const vol = (v: unknown) => (Number(v) ? String(v) : '');
  function tone(v: unknown, r: GridRow): string {
    const q = r as Quote;
    const p = Number(v);
    if (!p) return '';
    if (p >= q.ceil) return 'pb-ceil';
    if (p <= q.floor) return 'pb-floor';
    if (p === q.ref) return 'pb-ref';
    return p > q.ref ? 'pb-up' : 'pb-down';
  }
  const price = (key: string, header: string): ColumnDef =>
    ({ type: 'price', key, header, width: 62, format: k, cellClass: tone, flash: 'auto', flashColor: false, sortable: false }) as ColumnDef;
  const qty = (key: string, header: string): ColumnDef =>
    ({ type: 'number', key, header, width: 64, format: vol, flash: 'auto', sortable: false }) as ColumnDef;

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Mã', width: 56, pinned: 'left', cellClass: (_v, r) => tone((r as Quote).mp, r) },
    { type: 'price', key: 'ref', header: 'TC', width: 62, format: k, cellClass: 'pb-ref', sortable: false },
    { type: 'price', key: 'ceil', header: 'Trần', width: 62, format: k, cellClass: 'pb-ceil', sortable: false },
    { type: 'price', key: 'floor', header: 'Sàn', width: 62, format: k, cellClass: 'pb-floor', sortable: false },
    price('bp3', 'G3'), qty('bv3', 'KL3'), price('bp2', 'G2'), qty('bv2', 'KL2'), price('bp1', 'G1'), qty('bv1', 'KL1'),
    { ...price('mp', 'Giá'), width: 104, showChange: true }, qty('mv', 'KL'),
    { type: 'number', key: 'chg', header: '+/-', width: 56, format: (v) => (Number(v) ? (Number(v) / 1000).toFixed(2) : ''), cellClass: (_v, r) => tone((r as Quote).mp, r) },
    price('ap1', 'G1'), qty('av1', 'KL1'), price('ap2', 'G2'), qty('av2', 'KL2'), price('ap3', 'G3'), qty('av3', 'KL3'),
    // Totals change on every trade and are read at a glance: four repaints a
    // second is plenty (updateMs), where the prices repaint on every tick.
    price('hi', 'Cao'), price('lo', 'Thấp'),
    { ...qty('tv', 'Tổng KL'), width: 76, autoWidth: true, updateMs: 250 },
    { ...qty('fb', 'NN mua'), updateMs: 250 },
    { ...qty('fs', 'NN bán'), updateMs: 250 },
  ];

  // ---- Live mode: a feed at `rate` events/s, drained once per frame ----
  let rate = $state(3000);
  // Board height: a laptop pane, a desktop board, a wall-mounted trading screen.
  let gridHeight = $state(620);
  // "Top movers": sorted by change and kept in order as the feed runs: liveSort
  // merges the rows a tick moved back into place, twice a second.
  let movers = $state(false);
  // A busy board holds its flashes: a static tint, a fraction of a fade's cost.
  let flashMotion = $state<'fade' | 'hold' | 'auto'>('hold');
  function setFlashMotion(m: 'fade' | 'hold' | 'auto') {
    flashMotion = m;
    flushSync();
  }
  let sort = $state<SortState[]>([]);
  function setMovers(on: boolean) {
    movers = on;
    sort = on ? [{ key: 'chg', dir: 'desc' }] : [];
    flushSync();
  }
  function setHeight(h: number) {
    gridHeight = h;
    flushSync();
  }
  let live = $state(false);
  const fps = new FpsMeter();
  // The frame's time while the feed runs, measured as the CI gate's live
  // runs measure it (framecost.svelte.ts). The benchmarks below turn the
  // feed off and flush before they measure, which stops it.
  const cost = new FrameCostMeter();
  const ms = (x: number) => (x < 10 ? x.toFixed(1) : Math.round(x).toString());
  $effect(() => {
    if (!live) return;
    stream.start();
    fps.start();
    cost.start();
    let last = performance.now();
    let carry = 0;
    const h = setInterval(() => {
      const now = performance.now();
      carry += ((now - last) / 1000) * rate;
      last = now;
      for (; carry >= 1; carry--) {
        const q = rows[rint(0, rows.length - 1)];
        stream.push(q.id, event(q));
      }
    }, 10);
    return () => {
      clearInterval(h);
      stream.stop();
      fps.stop();
      cost.stop();
    };
  });

  // ---- Benchmark: deterministic frames, each fully rendered synchronously ----
  let host: HTMLDivElement;
  let result = $state<string>('');
  let lastResult: unknown = null;
  const pct = (xs: number[], p: number) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  };
  async function bench(opts: { frames?: number; eventsPerSec?: number } = {}) {
    const frames = opts.frames ?? 240;
    const perFrame = Math.round((opts.eventsPerSec ?? rate) / 60);
    live = false;
    flushSync();
    rand = prng(7);
    const apply: number[] = [], render: number[] = [], layout: number[] = [], total: number[] = [];
    for (let f = 0; f < frames; f++) {
      for (let i = 0; i < perFrame; i++) {
        const q = rows[rint(0, rows.length - 1)];
        stream.push(q.id, event(q));
      }
      const t0 = performance.now();
      stream.flushNow();
      const t1 = performance.now();
      flushSync();
      const t2 = performance.now();
      void host.offsetHeight;
      void getComputedStyle(host.querySelector('.row .c') ?? host).color;
      const t3 = performance.now();
      apply.push(t1 - t0); render.push(t2 - t1); layout.push(t3 - t2); total.push(t3 - t0);
      if (f % 20 === 19) await Promise.resolve();
    }
    const stat = (xs: number[]) => ({
      avg: +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2),
      p50: +pct(xs, 50).toFixed(2),
      p95: +pct(xs, 95).toFixed(2),
      max: +Math.max(...xs).toFixed(2),
    });
    const out = {
      mode,
      symbols: rows.length,
      eventsPerFrame: perFrame,
      visibleRows: host.querySelectorAll('.viewport .row').length,
      apply: stat(apply), render: stat(render), layout: stat(layout), total: stat(total),
      over16ms: total.filter((t) => t > 16.7).length,
      frames,
    };
    lastResult = out;
    result = `${mode} · ${out.symbols} symbols · ${perFrame} events/frame · frame p50 ${out.total.p50} ms / p95 ${out.total.p95} ms (apply ${out.apply.p50} · render ${out.render.p50} · layout ${out.layout.p50}) · ${out.over16ms}/${frames} over 16.7 ms`;
    return out;
  }
  // Sorted-board benchmark: ticks every frame, and a re-sort (api.refresh) every
  // `refreshEvery` frames — 60 ≈ once a second. Refresh frames and ordinary
  // frames are reported separately.
  async function benchSorted(opts: { frames?: number; eventsPerSec?: number; refreshEvery?: number } = {}) {
    const frames = opts.frames ?? 240;
    const every = opts.refreshEvery ?? 60;
    const perFrame = Math.round((opts.eventsPerSec ?? rate) / 60);
    live = false;
    setMovers(true);
    rand = prng(11);
    const plain: number[] = [], resort: number[] = [];
    for (let f = 0; f < frames; f++) {
      for (let i = 0; i < perFrame; i++) {
        const q = rows[rint(0, rows.length - 1)];
        stream.push(q.id, event(q));
      }
      const t0 = performance.now();
      stream.flushNow();
      const doRefresh = f % every === every - 1;
      if (doRefresh) api?.refresh();
      flushSync();
      void host.offsetHeight;
      (doRefresh ? resort : plain).push(performance.now() - t0);
      if (f % 20 === 19) await Promise.resolve();
    }
    const stat = (xs: number[]) => ({ n: xs.length, p50: +pct(xs, 50).toFixed(2), p95: +pct(xs, 95).toFixed(2), max: +Math.max(...xs).toFixed(2) });
    return { symbols: rows.length, eventsPerFrame: perFrame, refreshEvery: every, plain: stat(plain), refresh: stat(resort) };
  }

  // Scroll benchmark: step the viewport `rowsPerFrame` rows at a time (a fast
  // wheel/drag through the board), rendering each step synchronously.
  async function benchScroll(opts: { frames?: number; rowsPerFrame?: number } = {}) {
    const frames = opts.frames ?? 120;
    const step = (opts.rowsPerFrame ?? 3) * 36;
    live = false;
    flushSync();
    const vp = host.querySelector('.viewport') as HTMLElement;
    vp.scrollTop = 0;
    vp.dispatchEvent(new Event('scroll'));
    flushSync();
    const render: number[] = [], layout: number[] = [], total: number[] = [];
    for (let f = 0; f < frames; f++) {
      const t0 = performance.now();
      vp.scrollTop += step;
      vp.dispatchEvent(new Event('scroll'));
      flushSync();
      const t1 = performance.now();
      void host.offsetHeight;
      const t2 = performance.now();
      render.push(t1 - t0); layout.push(t2 - t1); total.push(t2 - t0);
      if (f % 20 === 19) await Promise.resolve();
    }
    const stat = (xs: number[]) => ({ p50: +pct(xs, 50).toFixed(2), p95: +pct(xs, 95).toFixed(2), max: +Math.max(...xs).toFixed(2) });
    return { rowsPerFrame: opts.rowsPerFrame ?? 3, render: stat(render), layout: stat(layout), total: stat(total), over16ms: total.filter((t) => t > 16.7).length, frames };
  }
  // Live benchmark: the real pipeline in real time — events at `eventsPerSec`,
  // drained once per frame by the tick stream, flash animations running. Each
  // frame is timed from its start to a task posted from it, which runs after
  // the frame has rendered, so style, layout and paint are included (the
  // synchronous benches above cannot see paint or running animations). Needs a
  // visible tab: hidden tabs get no animation frames.
  async function benchLive(opts: { seconds?: number; eventsPerSec?: number } = {}) {
    const seconds = opts.seconds ?? 6;
    const eps = opts.eventsPerSec ?? rate;
    live = false;
    flushSync();
    rand = prng(13);
    const work: number[] = [];
    const gaps: number[] = [];
    const probe = new MessageChannel();
    let frameStart = 0;
    probe.port1.onmessage = () => work.push(performance.now() - frameStart);
    stream.start();
    await new Promise<void>((resolve) => {
      const t0 = performance.now();
      let lastGen = t0;
      let carry = 0;
      let prev = 0;
      const frame = (ts: number) => {
        if (prev) gaps.push(ts - prev);
        prev = frameStart = ts;
        const now = performance.now();
        carry += ((now - lastGen) / 1000) * eps;
        lastGen = now;
        for (; carry >= 1; carry--) {
          const q = rows[rint(0, rows.length - 1)];
          stream.push(q.id, event(q));
        }
        probe.port2.postMessage(0);
        if (now - t0 < seconds * 1000) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    stream.stop({ discard: true });
    probe.port1.close();
    // Skip the first half second, or a quarter of the run if frames are slow.
    const warmup = Math.min(30, Math.floor(gaps.length / 4));
    const w = work.slice(warmup);
    const g = gaps.slice(warmup);
    const interval = pct(g, 50);
    const stat = (xs: number[]) => ({ p50: +pct(xs, 50).toFixed(2), p95: +pct(xs, 95).toFixed(2), max: +Math.max(...xs).toFixed(2) });
    return {
      symbols: rows.length,
      eventsPerSec: eps,
      framesTotal: gaps.length + 1,
      frames: g.length,
      interval: +interval.toFixed(2),
      work: stat(w),
      dropped: g.filter((x) => x > interval * 1.5).length,
    };
  }
  $effect(() => {
    (window as unknown as Record<string, unknown>).__priceBoard = { bench, benchScroll, benchSorted, benchLive, watching: () => watching, streamed: () => [...streamed], setMovers, setFlashMotion, setSize, setHeight, load, last: () => lastResult, rows: () => rows, api: () => api };
  });
</script>

<div class="pb-controls">
  <label>Symbols
    <select value={n} onchange={(e) => setSize(Number(e.currentTarget.value))}>
      {#each [400, 1000, 1600] as v (v)}<option value={v}>{v}</option>{/each}
    </select>
  </label>
  <label>Rows
    <select value={mode} onchange={(e) => load(e.currentTarget.value as 'patch' | 'state', n)}>
      <option value="patch">plain + patchRows</option>
      <option value="state">$state proxies</option>
    </select>
  </label>
  <label>Feed
    <select bind:value={rate}>
      {#each [1000, 3000, 10000, 30000] as v (v)}<option value={v}>{v.toLocaleString()} events/s</option>{/each}
    </select>
  </label>
  <label>Height
    <select value={gridHeight} onchange={(e) => setHeight(Number(e.currentTarget.value))}>
      {#each [620, 1400, 2400] as v (v)}<option value={v}>{v}px</option>{/each}
    </select>
  </label>
  <label>Flash
    <select value={flashMotion} onchange={(e) => setFlashMotion(e.currentTarget.value as 'fade' | 'hold' | 'auto')}>
      <option value="hold">hold (busy boards)</option>
      <option value="auto">auto</option>
      <option value="fade">fade</option>
    </select>
  </label>
  <button class="pb-btn" class:on={movers} onclick={() => setMovers(!movers)}>Top movers</button>
  <button class="pb-btn" class:on={live} onclick={() => (live = !live)}>{live ? 'Stop feed' : 'Start feed'}</button>
  <button class="pb-btn" onclick={() => bench()}>Benchmark</button>
  <span class="pb-stat">streaming {watching} of {rows.length.toLocaleString()} symbols</span>
  {#if live}
    <span class="pb-stat">{fps.fps} fps · {stream.pending} pending</span>
    <span class="pb-stat pb-cost" title="Frame time, from the frame's start to a task after its paint, over the last 120 frames: measured as the CI perf gate's live runs measure it">
      frame <strong>{ms(cost.p50)}</strong> ms · p95 {ms(cost.p95)} ms · {cost.over} over {ms(cost.budget)} ms
      {#if cost.recent.length > 0}
        {@const top = Math.max(cost.budget * 1.25, ...cost.recent)}
        <svg class="pb-spark" viewBox="0 0 60 20" preserveAspectRatio="none" aria-hidden="true">
          {#each cost.recent as w, i (i)}
            <rect x={i} y={20 - (20 * w) / top} width="0.8" height={(20 * w) / top} class:over={w > cost.budget} />
          {/each}
          <line x1="0" x2="60" y1={20 - (20 * cost.budget) / top} y2={20 - (20 * cost.budget) / top} />
        </svg>
      {/if}
    </span>
  {/if}
  {#if result}<span class="pb-stat">{result}</span>{/if}
</div>
<div class="gridwrap" bind:this={host}>
  <Grid rows={rows as unknown as GridRow[]} {columns} height={gridHeight} theme={ui.grid} ariaLabel="Price board" {sort} {flashMotion} liveSort={movers ? 500 : false} columnHover rowPinning findBar onSortChange={(s) => (sort = s)} onReady={(a) => (api = a)} onViewportChange={subs.update} />
</div>

<style>
  .pb-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    font-size: 12px;
    color: var(--text-dim, #8a8a8a);
  }
  .pb-controls select {
    margin-left: 4px;
    font: inherit;
  }
  .pb-btn {
    padding: 4px 10px;
    font: inherit;
    color: inherit;
    background: transparent;
    border: 0.5px solid currentColor;
    border-radius: 6px;
    cursor: pointer;
  }
  .pb-btn.on {
    color: var(--accent);
  }
  .pb-stat {
    font-variant-numeric: tabular-nums;
  }
  .pb-cost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .pb-cost strong {
    color: var(--text, inherit);
  }
  .pb-spark {
    width: 90px;
    height: 20px;
  }
  .pb-spark rect {
    fill: var(--text-dim, #8a8a8a);
  }
  .pb-spark rect.over {
    fill: var(--down);
  }
  .pb-spark line {
    stroke: var(--accent);
    stroke-width: 0.5;
    stroke-dasharray: 1.5 1;
    vector-effect: non-scaling-stroke;
  }
  .gridwrap :global(.pb-up) { color: var(--up); }
  .gridwrap :global(.pb-down) { color: var(--down); }
  .gridwrap :global(.pb-ref) { color: var(--accent); }
  .gridwrap :global(.pb-ceil) { color: var(--ceil); }
  .gridwrap :global(.pb-floor) { color: var(--floor); }
</style>
