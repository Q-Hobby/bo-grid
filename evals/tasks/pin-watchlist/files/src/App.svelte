<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol' },
    { type: 'text', key: 'name', header: 'Name' },
    { type: 'price', key: 'last', header: 'Last' },
    { type: 'percent', key: 'chg', header: 'Change' },
  ];
  const rows: GridRow[] = [
    { id: 1, symbol: 'AAPL', name: 'Apple', last: 189.3, chg: 0.012 },
    { id: 2, symbol: 'MSFT', name: 'Microsoft', last: 415.1, chg: -0.004 },
    { id: 3, symbol: 'NVDA', name: 'NVIDIA', last: 121.75, chg: 0.031 },
    { id: 4, symbol: 'TSLA', name: 'Tesla', last: 262.4, chg: -0.018 },
    { id: 5, symbol: 'AMZN', name: 'Amazon', last: 186, chg: 0.002 },
  ];
</script>

<main>
  <h1>Watchlist</h1>
  <Grid {rows} {columns} height={300} />
</main>
