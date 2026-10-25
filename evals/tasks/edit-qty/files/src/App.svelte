<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { orders } from './orders';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol' },
    { type: 'text', key: 'side', header: 'Side' },
    { type: 'number', key: 'qty', header: 'Qty', decimals: 0 },
    { type: 'price', key: 'price', header: 'Price' },
  ];
  let rows: GridRow[] = $state(orders);
</script>

<main>
  <h1>Orders</h1>
  <Grid {rows} {columns} height={400} />
</main>
