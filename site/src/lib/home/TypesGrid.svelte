<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { ui } from '$demo/theme.svelte';

  // Built-in cell types, side by side, for the features grid.
  const columns: ColumnDef[] = [
    { type: 'text', key: 'desk', header: 'Desk', width: 78 },
    { type: 'badge', key: 'status', header: 'Status', width: 84, tones: { Live: 'up', Halted: 'down', Auction: 'amber' } },
    { type: 'progress', key: 'fill', header: 'Filled', flex: 1, width: 64, min: 0, max: 100 },
    { type: 'heatmap', key: 'pnl', header: 'P&L %', width: 64, min: -3, max: 3, decimals: 1 },
  ];
  const rows = [
    { id: 1, desk: 'Rates', status: 'Live', fill: 82, pnl: 1.8 },
    { id: 2, desk: 'FX', status: 'Auction', fill: 46, pnl: -0.6 },
    { id: 3, desk: 'Equities', status: 'Live', fill: 64, pnl: 2.6 },
    { id: 4, desk: 'Crypto', status: 'Halted', fill: 18, pnl: -2.4 },
  ];
</script>

<Grid {rows} {columns} height={148} rowHeight={34} theme={ui.grid} cellSelection={false} ariaLabel="Cell types" />
