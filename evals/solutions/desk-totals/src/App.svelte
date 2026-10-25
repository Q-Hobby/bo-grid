<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { trades } from './trades';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'desk', header: 'Desk' },
    { type: 'text', key: 'symbol', header: 'Symbol' },
    { type: 'number', key: 'notional', header: 'Notional', decimals: 0, groupAgg: 'sum' },
  ];
  const rows: GridRow[] = trades;
</script>

<main>
  <h1>Trades by desk</h1>
  <Grid {rows} {columns} groupBy={['desk']} footer height={400} />
</main>
