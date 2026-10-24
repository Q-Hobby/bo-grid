<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  // Drag a header's right edge to resize (only that column changes);
  // double-click the edge to reset it, or use Reset widths in a column menu.
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 90, minWidth: 70, maxWidth: 160 },
    { type: 'text', key: 'name', header: 'Company', width: 150 },
    { type: 'price', key: 'price', header: 'Price', width: 90 },
    { type: 'percent', key: 'change', header: 'Chg %', width: 90 },
    // Widens on its own when a value no longer fits.
    { type: 'volume', key: 'volume', header: 'Volume', width: 70, autoWidth: true },
    // A fixed action-like column: no resize grip.
    { type: 'text', key: 'sector', header: 'Sector', width: 120, resizable: false },
  ];

  let rows = $state(quotes());
  // Off: only flex columns take up a width change. On: every column scales.
  let fit = $state(true);
</script>

<label class="opt"><input type="checkbox" bind:checked={fit} /> fitColumns</label>
<Grid {rows} {columns} fitColumns={fit} columnMenu height={260} />

<style>
  .opt {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 10px;
    font-size: 13px;
  }
</style>
