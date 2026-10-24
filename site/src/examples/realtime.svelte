<script lang="ts">
  import { Grid, type ColumnDef, type GridApi, type SortState } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';
  import { quotes } from './data';
  import { simulateFeed, type Tick } from './feed';

  // Plain rows ($state.raw): the grid writes each tick into them in place.
  const rows = $state.raw(quotes());
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', sub: 'name', width: 150 },
    { type: 'price', key: 'price', header: 'Price', flash: 'auto', showChange: true, width: 130 },
    { type: 'percent', key: 'change', header: 'Chg %', flash: 'auto' },
    { type: 'volume', key: 'volume', header: 'Volume', updateMs: 500 },
    { type: 'text', key: 'sector', header: 'Sector', flex: 1 },
  ];
  let sort = $state<SortState[]>([{ key: 'change', dir: 'desc' }]);

  let api: GridApi | undefined;
  let applied = $state(0);
  // Coalesces ticks per row and hands the grid one batch a frame.
  const stream = createTickStream<number, Tick>({
    apply: (batch) => {
      api?.patchRows(batch);
      applied = stream.applied;
    },
  });

  $effect(() => {
    stream.start();
    const stop = simulateFeed(rows, (id, tick) => stream.push(id, tick), 40);
    return () => {
      stop();
      stream.stop();
    };
  });
</script>

<p class="note">{applied.toLocaleString()} ticks applied · sorted by Chg %, kept in order as prices move</p>
<Grid {rows} {columns} height={300} {sort} onSortChange={(s) => (sort = s)} liveSort={800} onReady={(a) => (api = a)} />

<style>
  .note {
    margin: 0 0 8px;
    font-size: 12px;
    opacity: 0.7;
  }
</style>
