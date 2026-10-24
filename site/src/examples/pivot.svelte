<script lang="ts">
  import { Grid, pivot, type AggKind } from 'bo-grid';
  import { trades } from './pivot-data';

  const data = trades();
  let agg = $state<AggKind>('sum');

  // Rows by desk and book, a column per month (plus Total), notional ($k) in each cell.
  const table = $derived(pivot(data, { rowFields: ['desk', 'book'], columnField: 'month', measure: 'notional', agg }));
</script>

<p style="margin: 0 0 10px">
  <label>
    Aggregate
    <select bind:value={agg}>
      <option value="sum">Sum</option>
      <option value="avg">Average</option>
      <option value="max">Max</option>
      <option value="count">Count</option>
    </select>
  </label>
</p>
<Grid rows={table.rows} columns={table.columns} height={180} />
