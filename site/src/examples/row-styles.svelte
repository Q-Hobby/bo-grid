<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'text', key: 'name', header: 'Company', width: 150 },
    { type: 'price', key: 'price', header: 'Price', width: 96 },
    // A class on this column's cells, chosen by value.
    { type: 'percent', key: 'change', header: 'Chg %', width: 96, cellClass: (v) => (Number(v) >= 1 ? 'hot' : undefined) },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];

  let rows = $state(quotes());
  let last = $state('');

  // A class on the whole row, chosen by its data.
  const rowClass = (r: GridRow) => (Number(r.change) < 0 ? 'falling' : undefined);
  const rowMenu = (r: GridRow) => [
    { label: `Copy ${r.symbol}`, onSelect: () => navigator.clipboard?.writeText(String(r.symbol)) },
    { label: 'Remove row', onSelect: () => (rows = rows.filter((x) => x.id !== r.id)) },
  ];
</script>

<p class="state">Click a row or press Enter on it; right-click for its menu. Last opened: {last || 'none'}</p>
<Grid {rows} {columns} {rowClass} {rowMenu} onRowClick={(r) => (last = String(r.symbol))} height={260} />

<style>
  .state {
    margin: 0 0 10px;
    font-size: 12.5px;
    opacity: 0.8;
  }
  :global(.bo-grid .row.falling) {
    opacity: 0.6;
  }
  :global(.bo-grid .c.hot) {
    font-weight: 700;
  }
</style>
