<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';
  import { move } from './custom-filters-move';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', sub: 'name', width: 170 },
    { type: 'price', key: 'price', header: 'Price' },
    // This column's funnel opens the registered `move` editor.
    { type: 'percent', key: 'change', header: 'Chg %', filter: 'move' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];
  let rows = $state(quotes());
</script>

<Grid {rows} {columns} height={300} filterMenu filterTypes={{ move }} />
