<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'price', key: 'price', header: 'Price', editable: true, groupAgg: 'avg' },
    { type: 'number', key: 'qty', header: 'Qty', decimals: 0, editable: true, groupAgg: 'sum' },
    { type: 'percent', key: 'change', header: 'Chg %', groupAgg: 'avg' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1, groupAgg: 'sum' },
  ];
  let rows = $state(quotes().map((q, i) => ({ ...q, qty: (i + 1) * 50 })));
</script>

<Grid
  {rows}
  {columns}
  height={300}
  fillHandle
  footer
  aggregations={['sum', 'avg', 'count']}
  onCellEdit={(e) => (e.row[e.column.key] = e.value)}
/>
