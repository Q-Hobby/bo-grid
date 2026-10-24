<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 90 },
    // An icon picked by threshold: the highest `at` not above the value wins.
    {
      type: 'percent',
      key: 'change',
      header: 'Chg %',
      width: 110,
      icons: [
        { at: -Infinity, icon: '▼', tone: 'down' },
        { at: -0.25, icon: '●', tone: 'neutral' },
        { at: 0.25, icon: '▲', tone: 'up' },
      ],
    },
    // A background tint across the column's range, diverging around zero.
    { type: 'percent', key: 'change', header: 'Heat', width: 96, colorScale: { mid: 0 } },
    // A bar behind the value, proportional from zero.
    { type: 'volume', key: 'volume', header: 'Volume', width: 150, dataBar: { min: 0 } },
    { type: 'price', key: 'price', header: 'Price', flex: 1 },
  ];

  let rows = $state(quotes());
</script>

<Grid {rows} {columns} height={300} />
