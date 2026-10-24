<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 90 },
    // A styled tooltip shows the full name when it is cut off.
    { type: 'text', key: 'name', header: 'Company', width: 120, tooltip: true },
    { type: 'price', key: 'price', header: 'Price', width: 90 },
    // `custom`: the grid hands the cell to the `cell` snippet below.
    {
      type: 'custom',
      key: 'change',
      header: 'Move',
      width: 120,
      headerTooltip: 'Change since the previous close, in percent.',
      headerInfo: true,
    },
    // A `format` function covers text-only cases without a snippet.
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1, format: (v) => `${(Number(v) / 1e6).toFixed(2)} M` },
  ];

  let rows = $state(quotes());
</script>

{#snippet cell({ row }: { row: GridRow; column: ColumnDef; value: unknown })}
  {@const up = Number(row.change) >= 0}
  <span class="move" class:up>
    {up ? '▲' : '▼'}
    {Math.abs(Number(row.change)).toFixed(2)}%
  </span>
{/snippet}

<Grid {rows} {columns} {cell} height={300} />

<style>
  .move {
    padding: 1px 8px;
    font-weight: 600;
    color: var(--bo-down);
    background: color-mix(in srgb, currentColor 14%, transparent);
    border-radius: 999px;
  }
  .move.up {
    color: var(--bo-up);
  }
</style>
