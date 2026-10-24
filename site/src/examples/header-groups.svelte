<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { quotes } from './data';

  const bid = (r: GridRow) => Number(r.price) - 0.05;
  const ask = (r: GridRow) => Number(r.price) + 0.05;

  // Consecutive columns with the same `group` sit under one spanning header.
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 90 },
    { type: 'price', key: 'bid', header: 'Price', width: 90, group: 'Bid', value: bid },
    { type: 'volume', key: 'bidVol', header: 'Vol', width: 90, group: 'Bid', value: (r) => Math.round(Number(r.volume) * 0.04) },
    { type: 'price', key: 'ask', header: 'Price', width: 90, group: 'Ask', value: ask },
    { type: 'volume', key: 'askVol', header: 'Vol', width: 90, group: 'Ask', value: (r) => Math.round(Number(r.volume) * 0.03) },
    { type: 'price', key: 'price', header: 'Last', width: 90, group: 'Match' },
    { type: 'percent', key: 'change', header: 'Chg %', width: 90, group: 'Match' },
    { type: 'volume', key: 'volume', header: 'Vol', flex: 1, group: 'Match' },
  ];

  let rows = $state(quotes());
</script>

<Grid {rows} {columns} height={300} />
