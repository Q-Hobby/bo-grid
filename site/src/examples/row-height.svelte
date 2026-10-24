<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', sub: 'name', width: 170 },
    { type: 'price', key: 'price', header: 'Price', width: 96 },
    { type: 'percent', key: 'change', header: 'Chg %', width: 90 },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];
  const densities = { Compact: 28, Default: 36, Roomy: 48 };

  let rows = $state(quotes());
  let rowHeight = $state(36);
</script>

<div class="bar" role="group" aria-label="Row height">
  {#each Object.entries(densities) as [label, h] (label)}
    <button aria-pressed={rowHeight === h} onclick={() => (rowHeight = h)}>{label} · {h}px</button>
  {/each}
</div>
<Grid {rows} {columns} {rowHeight} height={260} />

<style>
  .bar {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }
  button {
    padding: 4px 10px;
    font: inherit;
    font-size: 12.5px;
    color: inherit;
    background: none;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    border-radius: 6px;
    cursor: pointer;
  }
  button[aria-pressed='true'] {
    border-color: currentColor;
  }
</style>
