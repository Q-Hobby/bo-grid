<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { applyPatches, createRowIndex, createTickStream } from 'bo-grid/realtime';
  import { quotes } from './data';
  import { simulateFeed, type Tick } from './feed';

  // $state rows, written by applyPatches: only the fields that changed, and
  // only the latest tick for each row, once a frame.
  const rows = $state(quotes());
  const index = createRowIndex(rows, (r) => r.id);
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'price', key: 'price', header: 'Price', flash: 'auto' },
    { type: 'percent', key: 'change', header: 'Chg %' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];

  let rate = $state(1000);
  let received = 0;
  let stats = $state({ received: 0, applied: 0, pending: 0 });
  const stream = createTickStream<number, Tick>({ apply: (batch) => applyPatches(index, batch) });

  $effect(() => {
    stream.start();
    // The simulated feed walks its own copy of the quotes (reading `rows`
    // here would make this effect re-run on every write).
    const stop = simulateFeed(quotes(), (id, tick) => {
      received++;
      stream.push(id, tick); // cheap: merges into the row's pending patch
    }, rate);
    const show = setInterval(() => (stats = { received, applied: stream.applied, pending: stream.pending }), 250);
    return () => {
      stop();
      clearInterval(show);
      stream.stop();
    };
  });
</script>

<div class="bar">
  <label>Feed <select bind:value={rate}><option value={100}>100 / s</option><option value={1000}>1,000 / s</option><option value={5000}>5,000 / s</option></select></label>
  <span>{stats.received.toLocaleString()} messages in</span>
  <span>{stats.applied.toLocaleString()} patches applied</span>
  <span>{stats.pending} waiting</span>
</div>
<Grid {rows} {columns} height={280} />

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
