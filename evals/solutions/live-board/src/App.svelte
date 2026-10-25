<script lang="ts">
  import { Grid, type ColumnDef, type GridApi, type GridRow } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';
  import { SYMBOLS, subscribe, type Quote } from './feed';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'id', header: 'Symbol' },
    { type: 'price', key: 'last', header: 'Last', flash: 'auto' },
    { type: 'volume', key: 'volume', header: 'Volume' },
  ];
  const rows: GridRow[] = $state.raw(SYMBOLS.map((symbol) => ({ id: symbol, last: 0, volume: 0 })));
  let api: GridApi | undefined;
  const stream = createTickStream<string, Partial<Quote>>({ apply: (batch) => api?.patchRows(batch) });

  $effect(() => {
    stream.start();
    const stop = subscribe((q) => stream.push(q.symbol, { last: q.last, volume: q.volume }));
    return () => {
      stop();
      stream.stop();
    };
  });
</script>

<main>
  <h1>Live board</h1>
  <Grid {rows} {columns} onReady={(a) => (api = a)} height={400} />
</main>
