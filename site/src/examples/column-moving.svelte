<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 90 },
    { type: 'text', key: 'name', header: 'Company', width: 140 },
    { type: 'price', key: 'price', header: 'Price', width: 90 },
    { type: 'percent', key: 'change', header: 'Chg %', width: 90 },
    { type: 'volume', key: 'volume', header: 'Volume', width: 100 },
    { type: 'text', key: 'sector', header: 'Sector', flex: 1 },
  ];

  let rows = $state(quotes());
  let order = $state(columns.map((c) => c.key));
  let hidden = $state<string[]>([]);
</script>

<p class="state">
  Order: {order.join(' · ')}<br />
  Hidden: {hidden.length ? hidden.join(', ') : 'none'}
</p>
<Grid
  {rows}
  {columns}
  columnMenu
  columnsPanel
  height={260}
  onColumnReorder={(keys) => (order = keys)}
  onColumnVisibilityChange={(keys) => (hidden = keys)}
/>

<style>
  .state {
    margin: 0 0 10px;
    font-size: 12.5px;
    line-height: 1.6;
    opacity: 0.8;
  }
</style>
