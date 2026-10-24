<script lang="ts">
  import { Grid, type ColumnDef, type DefaultColumn } from 'bo-grid';
  import { quotes } from './data';

  // Each column names a row field (`key`), a header, and a `type` that picks
  // how the value shows, sorts and filters. Widths are fixed (`width`) or
  // share the space left over (`flex`).
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', sub: 'name', width: 170 },
    { type: 'price', key: 'price', header: 'Price', width: 96 },
    { type: 'percent', key: 'change', header: 'Chg %', width: 90 },
    { type: 'heatmap', key: 'change', header: 'Heat', min: -2, max: 2, width: 80 },
    { type: 'volume', key: 'volume', header: 'Volume', width: 100 },
    { type: 'text', key: 'sector', header: 'Sector', flex: 1, sortable: false },
  ];

  // Settings every column starts from; a column's own fields win.
  const defaultColumn: DefaultColumn = { tooltip: true, minWidth: 64 };

  let rows = $state(quotes());
</script>

<Grid {rows} {columns} {defaultColumn} height={300} />
