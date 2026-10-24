<script lang="ts">
  import { Grid, type ColumnDef, type GridApi, type GridRow } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';
  import { ui } from '$demo/theme.svelte';
  import { marketRows, rand, tick, type MarketRow } from './market';
  import { onScreen } from './reveal';

  // The hero's board, fed the way a production one is: plain rows, a
  // coalescing tick stream, api.patchRows. It pauses off screen and in a
  // hidden tab. `rate` is ticks a second.
  let { rate = 40, height = 384 }: { rate?: number; height?: number } = $props();

  const rows = $state.raw<MarketRow[]>(marketRows());
  const tone = (v: unknown) => (Number(v) > 0 ? 'lb-up' : Number(v) < 0 ? 'lb-down' : undefined);
  const signed = (v: unknown) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2)}`;
  const columns: ColumnDef[] = [
    { type: 'text', key: 'sym', header: 'Symbol', sub: 'name', width: 128, sortable: false },
    { type: 'price', key: 'last', header: 'Last', width: 104, flash: 'auto', showChange: true, sortable: false },
    { type: 'number', key: 'chg', header: 'Chg', width: 76, format: signed, cellClass: tone, sortable: false },
    { type: 'percent', key: 'pct', header: 'Chg %', width: 82, sortable: false },
    { type: 'price', key: 'bid', header: 'Bid', width: 90, flash: 'auto', sortable: false },
    { type: 'price', key: 'ask', header: 'Ask', width: 90, flash: 'auto', sortable: false },
    { type: 'volume', key: 'vol', header: 'Volume', width: 92, sortable: false },
    { type: 'sparkline', key: 'trend', sparkKey: 'trend', header: 'Trend', flex: 1, width: 200, sortable: false },
  ];

  let api: GridApi | null = null;
  const stream = createTickStream<number, Partial<MarketRow>>({ apply: (batch) => api?.patchRows(batch) });

  let visible = $state(false);
  let tabVisible = $state(true);
  $effect(() => {
    const vis = () => (tabVisible = document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  });

  $effect(() => {
    if (!visible || !tabVisible) return;
    stream.start();
    const every = 50;
    const perBeat = Math.max(1, Math.round((rate * every) / 1000));
    const h = setInterval(() => {
      for (let n = 0; n < perBeat; n++) {
        const row = rows[Math.floor(rand() * rows.length)];
        // patchRows writes the fields, so the grid sees each change.
        stream.push(row.id, tick(row));
      }
    }, every);
    return () => {
      clearInterval(h);
      stream.stop();
    };
  });
</script>

<div class="live-board" use:onScreen={(v) => (visible = v)}>
  <Grid rows={rows as unknown as GridRow[]} {columns} {height} rowHeight={40} theme={ui.grid} ariaLabel="Live market board" cellSelection={false} onReady={(a) => (api = a)} />
</div>

<style>
  .live-board :global(.bo-grid .c.lb-up) {
    color: var(--bo-grid-up, var(--up));
  }
  .live-board :global(.bo-grid .c.lb-down) {
    color: var(--bo-grid-down, var(--down));
  }
</style>
