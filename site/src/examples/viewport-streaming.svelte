<script lang="ts">
  import { Grid, type ColumnDef, type GridApi } from 'bo-grid';
  import { createTickStream, createViewportSubscriptions } from 'bo-grid/realtime';

  type Row = { id: number; symbol: string; price: number; volume: number };
  const rows = $state.raw<Row[]>(Array.from({ length: 1000 }, (_, id) => ({ id, symbol: `S${String(id).padStart(4, '0')}`, price: 10 + (id % 90), volume: 0 })));
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 110 },
    { type: 'price', key: 'price', header: 'Price', flash: 'auto' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];

  let api: GridApi | undefined;
  const stream = createTickStream<number, Partial<Row>>({ apply: (batch) => api?.patchRows(batch) });

  // The "server": it sends ticks only for the symbols subscribed.
  const live = new Set<number>();
  let streaming = $state(0);
  const subs = createViewportSubscriptions<Row, number>({
    key: (row) => row.id,
    subscribe: (ids) => ids.forEach((id) => live.add(id)),
    unsubscribe: (ids) => ids.forEach((id) => live.delete(id)),
  });

  $effect(() => {
    stream.start();
    const timer = setInterval(() => {
      for (const id of live) {
        if (Math.random() > 0.15) continue;
        const r = rows[id];
        stream.push(id, { price: Math.round((r.price + (Math.random() - 0.5) * 0.2) * 100) / 100, volume: r.volume + 100 });
      }
      streaming = live.size;
    }, 100);
    return () => {
      clearInterval(timer);
      stream.stop();
      subs.clear();
    };
  });
</script>

<p class="note">Streaming {streaming} of {rows.length.toLocaleString()} symbols: scroll, and the feed follows the rows on screen.</p>
<Grid {rows} {columns} height={280} onViewportChange={subs.update} onReady={(a) => (api = a)} />

<style>
  .note {
    margin: 0 0 8px;
    font-size: 12px;
    opacity: 0.7;
  }
</style>
