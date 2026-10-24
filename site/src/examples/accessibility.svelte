<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', sub: 'name', width: 170 },
    { type: 'text', key: 'sector', header: 'Sector', width: 130 },
    { type: 'price', key: 'price', header: 'Price' },
    { type: 'percent', key: 'change', header: 'Chg %' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];
  let rows = $state(quotes());
</script>

<!-- One tab stop: Tab in, then arrows, Space to tick a row, Alt+↓ for the column menu. -->
<Grid {rows} {columns} height={300} ariaLabel="Watchlist" rowSelection columnMenu filterMenu />
