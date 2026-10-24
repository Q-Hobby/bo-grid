<script lang="ts">
  import { Grid, type ColumnDef, type GridTheme } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', sub: 'name', width: 170 },
    { type: 'price', key: 'price', header: 'Price' },
    { type: 'percent', key: 'change', header: 'Chg %' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];
  let rows = $state(quotes());

  // Density and shape are tokens too. A partial theme keeps every other token.
  const looks: Record<string, { rowHeight: number; theme: GridTheme }> = {
    Compact: { rowHeight: 28, theme: { fontSize: '12px', cellPad: '6px', radius: '4px' } },
    Default: { rowHeight: 36, theme: {} },
    Roomy: { rowHeight: 46, theme: { fontSize: '14px', cellPad: '16px', radius: '14px' } },
  };
  let look = $state('Compact');
</script>

<p style="margin: 0 0 10px; display: flex; gap: 6px">
  {#each Object.keys(looks) as name (name)}
    <button aria-pressed={look === name} onclick={() => (look = name)}>{name}</button>
  {/each}
</p>
<Grid {rows} {columns} height={280} rowHeight={looks[look].rowHeight} theme={looks[look].theme} />
