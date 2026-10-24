<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', sub: 'name', width: 180 },
    { type: 'text', key: 'sector', header: 'Sector', width: 130 },
    // Group headers show these aggregates, live.
    { type: 'price', key: 'price', header: 'Avg price', groupAgg: 'avg' },
    { type: 'percent', key: 'change', header: 'Avg chg %', groupAgg: 'avg' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1, groupAgg: 'sum' },
  ];
  let rows = $state(quotes());
</script>

<Grid {rows} {columns} height={320} groupBy={['sector']} />
