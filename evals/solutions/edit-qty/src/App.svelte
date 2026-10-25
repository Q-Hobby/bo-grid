<script lang="ts">
  import { Grid, type CellEditEvent, type ColumnDef, type GridRow } from 'bo-grid';
  import { saveQty } from './api';
  import { orders } from './orders';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol' },
    { type: 'text', key: 'side', header: 'Side' },
    { type: 'number', key: 'qty', header: 'Qty', decimals: 0, editable: true, validate: (v) => Number.isInteger(v) && Number(v) > 0 },
    { type: 'price', key: 'price', header: 'Price' },
  ];
  let rows: GridRow[] = $state(orders);

  function onCellEdit({ row, column, value }: CellEditEvent) {
    row[column.key] = value;
    if (column.key === 'qty') saveQty(String(row.symbol), Number(value));
  }
</script>

<main>
  <h1>Orders</h1>
  <Grid {rows} {columns} height={400} {onCellEdit} />
</main>
