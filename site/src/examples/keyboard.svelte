<script lang="ts">
  import { Grid, type ColumnDef, type Hotkeys } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', sub: 'name', width: 170 },
    { type: 'price', key: 'price', header: 'Price' },
    { type: 'percent', key: 'change', header: 'Chg %' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];
  let rows = $state(quotes());
  let log = $state('Click a row, then press B, S, Delete or Shift+R.');

  // App keys, run before the grid's own, with the focused row.
  const hotkeys: Hotkeys = {
    b: ({ row }) => {
      if (row) log = `Buy ticket for ${row.symbol}`;
    },
    s: ({ row }) => {
      if (row) log = `Sell ticket for ${row.symbol}`;
    },
    Delete: ({ row }) => {
      if (!row) return;
      rows = rows.filter((r) => r.id !== row.id);
      log = `Removed ${row.symbol}`;
    },
    'Shift+R': () => {
      rows = quotes();
      log = 'All rows back';
    },
  };
</script>

<p style="margin: 0 0 10px; opacity: 0.8" aria-live="polite">{log}</p>
<Grid {rows} {columns} height={280} {hotkeys} ariaLabel="Watchlist" />
