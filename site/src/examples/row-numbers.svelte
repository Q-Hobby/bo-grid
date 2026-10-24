<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'text', key: 'name', header: 'Company', width: 150 },
    { type: 'price', key: 'price', header: 'Price', width: 96 },
    { type: 'percent', key: 'change', header: 'Chg %', width: 96 },
    { type: 'text', key: 'sector', header: 'Sector', flex: 1 },
  ];

  let rows = $state(quotes());
</script>

<!-- The numbers follow the view: sort a column and they stay 1, 2, 3… -->
<Grid {rows} {columns} rowNumbers height={280} />
