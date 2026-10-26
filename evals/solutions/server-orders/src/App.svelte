<script lang="ts">
  import { Grid, type ColumnDef, type RowSource } from 'bo-grid';
  import { fetchOrders, type OrderSort } from './api';

  const columns: ColumnDef[] = [
    { type: 'number', key: 'id', header: 'Order #', decimals: 0 },
    { type: 'text', key: 'symbol', header: 'Symbol' },
    { type: 'number', key: 'qty', header: 'Qty', decimals: 0 },
    { type: 'price', key: 'price', header: 'Price' },
  ];
  // The grid asks for the rows in view; the server sorts.
  const source: RowSource = {
    getRows: ({ range, sort }) => fetchOrders(range.start, range.end, sort ? { key: sort.key as OrderSort['key'], dir: sort.dir } : undefined),
  };
</script>

<main>
  <h1>Orders</h1>
  <Grid rows={[]} {columns} {source} height={480} />
</main>
