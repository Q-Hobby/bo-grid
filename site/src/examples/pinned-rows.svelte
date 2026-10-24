<script lang="ts">
  import { Grid, type ColumnDef, type GridApi } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 110 },
    { type: 'text', key: 'name', header: 'Company', width: 150 },
    { type: 'price', key: 'price', header: 'Price', width: 96 },
    { type: 'percent', key: 'change', header: 'Chg %', width: 96 },
    { type: 'text', key: 'sector', header: 'Sector', flex: 1 },
  ];

  let rows = $state(quotes());
  // A row of your own, always on top: its id (0) must not clash with the rows' (1–12).
  const benchmark = { id: 0, symbol: 'INDEX', name: 'Market index', price: 1288.4, change: 0.42, sector: '—' };

  let api: GridApi | undefined;
  let pinned = $state<(string | number)[]>([]);
</script>

<p class="bar">
  Right-click a row to pin it.
  <button onclick={() => api?.pinRow(2, !pinned.includes(2))}>{pinned.includes(2) ? 'Unpin' : 'Pin'} FPT</button>
  <span>Pinned: {pinned.length ? pinned.join(', ') : 'none'}</span>
</p>
<Grid {rows} {columns} height={300} pinnedRows={[benchmark]} rowPinning onRowPinChange={(ids) => (pinned = ids)} onReady={(a) => (api = a)} />

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
    margin: 0 0 8px;
    font-size: 12px;
  }
</style>
