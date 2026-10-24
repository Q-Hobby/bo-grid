<script lang="ts">
  import { Grid, type ColumnDef, type GridApi } from 'bo-grid';
  import { connectFeed } from 'bo-grid/realtime';
  import { SYMBOLS, seed, type Tick } from './worker-feed-data';

  const rows = $state.raw(Array.from({ length: SYMBOLS }, (_, id) => ({ id, ...seed(id), change: 0, volume: 0 })));
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'price', key: 'price', header: 'Price', flash: 'auto' },
    { type: 'percent', key: 'change', header: 'Chg %' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];

  let perSecond = $state(5000);
  let worker = $state<Worker>();
  let api: GridApi | undefined;
  let stats = $state({ connected: false, applied: 0, pending: 0 });

  $effect(() => {
    const w = new Worker(new URL('./worker-feed.worker.ts', import.meta.url), { type: 'module' });
    // One batch a frame from the worker: at most 400 patches.
    const feed = connectFeed<number, Tick>(w, { apply: (batch) => api?.patchRows(batch) });
    feed.start();
    worker = w;
    const show = setInterval(() => (stats = { connected: feed.connected, applied: feed.applied, pending: feed.pending }), 250);
    return () => {
      clearInterval(show);
      feed.close();
      w.terminate();
    };
  });
  $effect(() => worker?.postMessage({ perSecond }));
</script>

<div class="bar">
  <label>In the worker <select bind:value={perSecond}><option value={1000}>1,000 messages / s</option><option value={5000}>5,000 messages / s</option><option value={20000}>20,000 messages / s</option></select></label>
  <span>{stats.connected ? 'connected' : 'connecting…'}</span>
  <span>{stats.applied.toLocaleString()} patches applied</span>
  <span>{stats.pending} waiting in the worker</span>
</div>
<Grid {rows} {columns} height={280} onReady={(a) => (api = a)} />

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 16px;
    margin: 0 0 8px;
    font-size: 12px;
  }
  select {
    font: inherit;
  }
</style>
