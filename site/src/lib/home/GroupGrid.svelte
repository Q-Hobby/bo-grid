<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { ui } from '$demo/theme.svelte';

  // Rows grouped by sector with a subtotal on each group, for the features grid.
  const columns: ColumnDef[] = [
    { type: 'text', key: 'sector', header: 'Sector', width: 110 },
    { type: 'text', key: 'sym', header: 'Symbol', flex: 1, width: 70 },
    { type: 'volume', key: 'value', header: 'Value', width: 90, groupAgg: 'sum' },
  ];
  const rows = [
    { id: 1, sector: 'Technology', sym: 'NVDA', value: 4_210_000 },
    { id: 2, sector: 'Technology', sym: 'MSFT', value: 2_960_000 },
    { id: 3, sector: 'Energy', sym: 'XOM', value: 1_180_000 },
    { id: 4, sector: 'Energy', sym: 'CVX', value: 870_000 },
  ];
</script>

<Grid {rows} {columns} groupBy={['sector']} height={182} rowHeight={30} theme={ui.grid} cellSelection={false} ariaLabel="Grouped rows" />
