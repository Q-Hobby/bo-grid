<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', sub: 'name', width: 160 },
    { type: 'price', key: 'price', header: 'Price' },
    { type: 'percent', key: 'change', header: 'Chg %' },
    { type: 'volume', key: 'volume', header: 'Volume' },
    { type: 'text', key: 'sector', header: 'Sector', flex: 1 },
  ];
  let rows = $state(quotes());
</script>

<Grid {rows} {columns} height={300} />
