<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'number', key: 'id', header: '#', decimals: 0, width: 70 },
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'price', key: 'price', header: 'Price', width: 96 },
    { type: 'percent', key: 'change', header: 'Chg %', width: 96 },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];

  // 120 rows: ten copies of the quotes, each with its own id.
  let rows = $state(
    Array.from({ length: 10 }, (_, n) => quotes().map((q) => ({ ...q, id: n * 12 + q.id, price: q.price + n }))).flat(),
  );
</script>

<Grid {rows} {columns} pageSize={10} pageSizeOptions={[10, 25, 50]} height={360} />
